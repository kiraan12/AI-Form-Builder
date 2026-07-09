import base64
import json
import os

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from google import genai

router = APIRouter(prefix="/api/extract", tags=["extract"])

ALLOWED_MIME = {
    "application/pdf": "document",
    "image/png": "image",
    "image/jpeg": "image",
    "image/jpg": "image",
}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB

_client = None


def get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
    return _client


def build_prompt(fields: list[dict]) -> str:
    lines = []
    for f in fields:
        opts = f", options: [{', '.join(f['options'])}]" if f.get("options") else ""
        lines.append(f'- id: "{f["id"]}", label: "{f["label"]}", type: "{f["type"]}"{opts}')
    field_descriptions = "\n".join(lines)

    return f"""You are extracting structured data from an uploaded document to fill a user-defined form.

The form has exactly these fields. Do not invent fields that aren't listed here:
{field_descriptions}

Instructions:
- Read the document and find the value for each field above, if present.
- For "number" fields, return a plain numeric value (no currency symbols, no commas) or null if no clear number is found.
- For "date" fields, return an ISO date string (YYYY-MM-DD) if you can determine it, or null.
- For "checkbox" fields, return true or false only if the document clearly indicates it; otherwise null.
- For "dropdown" fields, only return one of the listed options, matched by meaning, or null if none fit.
- If you cannot find a value, or you are not confident, return null for "value" — never guess.
- For every field, also return a "confidence" of "high", "medium", or "low" describing how sure you are (use "low" whenever value is null due to uncertainty).

Respond with ONLY a JSON object, no other text, no markdown fences, in this exact shape:
{{
  "<field_id>": {{ "value": <string|number|boolean|null>, "confidence": "high"|"medium"|"low" }},
  ...
}}"""


def validate_and_coerce(fields: list[dict], raw: dict) -> dict:
    result = {}
    for f in fields:
        field_id = f["id"]
        entry = raw.get(str(field_id)) or raw.get(field_id) or {"value": None, "confidence": "low"}
        value = entry.get("value")
        confidence = entry.get("confidence") if entry.get("confidence") in ("high", "medium", "low") else "low"

        if f["type"] == "number":
            try:
                value = float(value) if value is not None else None
                if value is not None and value.is_integer():
                    value = int(value)
            except (TypeError, ValueError):
                value = None
            if value is None:
                confidence = "low"
        elif f["type"] == "checkbox":
            value = value if isinstance(value, bool) else None
        elif isinstance(value, str):
            value = value.strip() or None
        elif value is not None and not isinstance(value, (int, float)):
            value = None

        result[field_id] = {"value": value, "confidence": "low" if value is None else confidence}
    return result


@router.post("")
async def extract(file: UploadFile = File(...), schema: str = Form(...)):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400, detail="Unsupported file type. Please upload a PDF, PNG, or JPEG file."
        )

    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File is too large. Maximum size is 15MB.")
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="No file was uploaded.")

    try:
        fields = json.loads(schema)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Missing or invalid form schema.")
    if not isinstance(fields, list) or len(fields) == 0:
        raise HTTPException(status_code=400, detail="Build the form before uploading a document.")

    kind = ALLOWED_MIME[file.content_type]
    b64 = base64.b64encode(raw_bytes).decode("utf-8")
    content_block = (
        {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
        if kind == "document"
        else {"type": "image", "source": {"type": "base64", "media_type": file.content_type, "data": b64}}
    )

    try:
        if kind == "document":
            # For PDFs, we need to use the file upload approach
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                tmp_file.write(raw_bytes)
                tmp_file.flush()
                tmp_path = tmp_file.name
            
            client = get_client()
            sample_file = client.files.upload(file=tmp_path)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[sample_file, build_prompt(fields)]
            )
            client.files.delete(name=sample_file.name)
            os.unlink(tmp_path)
        else:
            # For images, we can use base64 directly
            import PIL.Image
            import io
            image = PIL.Image.open(io.BytesIO(raw_bytes))
            client = get_client()
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[image, build_prompt(fields)]
            )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Extraction failed: {str(e)}. The document may be corrupted or unreadable. Please try again.",
        )

    cleaned = response.text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned[4:] if cleaned.startswith("json") else cleaned

    try:
        raw = json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="The document could not be understood. Please try again.")

    values = validate_and_coerce(fields, raw)
    return {"values": values}

import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai

router = APIRouter(prefix="/api/generate", tags=["generate"])

VALID_TYPES = ["text", "textarea", "number", "date", "dropdown", "checkbox"]

_client = None


def get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
    return _client


class GenerateRequest(BaseModel):
    description: str


def build_generation_prompt(description: str) -> str:
    return f"""You are an expert form builder. Generate a form schema based on the user's description.

User description: {description}

Generate a JSON object with this exact structure:
{{
  "title": "Form title based on the description",
  "fields": [
    {{
      "label": "Field label",
      "type": "field_type",
      "required": true/false,
      "options": ["option1", "option2"]  // Only for dropdown fields, omit for other types
    }}
  ]
}}

Rules:
- Field types must be one of: {", ".join(VALID_TYPES)}
- Use "text" for short text inputs (names, emails, phone numbers)
- Use "textarea" for longer text (descriptions, comments)
- Use "number" for numeric values (age, salary, quantity)
- Use "date" for dates (birth date, start date)
- Use "dropdown" for selecting from predefined options (gender, country, status)
- Use "checkbox" for boolean yes/no questions
- Include "options" array only for dropdown fields
- Set "required" to true for essential fields, false for optional
- Generate 3-8 relevant fields based on the description
- Be practical and realistic

Respond with ONLY the JSON object, no other text, no markdown fences."""


@router.post("")
async def generate_form(request: GenerateRequest):
    if not request.description or len(request.description.strip()) < 10:
        raise HTTPException(
            status_code=400, 
            detail="Please provide a more detailed description (at least 10 characters)."
        )

    try:
        client = get_client()
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=build_generation_prompt(request.description)
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Form generation failed: {str(e)}. Please try again."
        )

    cleaned = response.text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned[7:] if cleaned.startswith("json") else cleaned

    try:
        schema = json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="The AI response could not be parsed. Please try again.")

    # Validate the generated schema
    if not isinstance(schema, dict):
        raise HTTPException(status_code=502, detail="Invalid schema format.")
    
    if "title" not in schema or not isinstance(schema["title"], str):
        raise HTTPException(status_code=502, detail="Missing or invalid title in schema.")
    
    if "fields" not in schema or not isinstance(schema["fields"], list):
        raise HTTPException(status_code=502, detail="Missing or invalid fields in schema.")
    
    if len(schema["fields"]) == 0:
        raise HTTPException(status_code=502, detail="No fields generated in schema.")

    # Validate each field
    for field in schema["fields"]:
        if not isinstance(field, dict):
            raise HTTPException(status_code=502, detail="Invalid field format.")
        
        if "label" not in field or not isinstance(field["label"], str):
            raise HTTPException(status_code=502, detail="Missing or invalid field label.")
        
        if "type" not in field or field["type"] not in VALID_TYPES:
            raise HTTPException(status_code=502, detail=f"Invalid field type: {field.get('type')}")
        
        if field["type"] == "dropdown" and ("options" not in field or not isinstance(field["options"], list)):
            raise HTTPException(status_code=502, detail="Dropdown field must have options.")
        
        # Set defaults
        if "required" not in field:
            field["required"] = False

    return schema

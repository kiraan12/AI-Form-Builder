import json

from fastapi import APIRouter, HTTPException

from ..db import get_connection
from ..schemas import FormCreate, SubmissionCreate

router = APIRouter(prefix="/api/forms", tags=["forms"])


def serialize_form(conn, form_row) -> dict:
    field_rows = conn.execute(
        "SELECT * FROM fields WHERE form_id = ? ORDER BY sort_order ASC", (form_row["id"],)
    ).fetchall()
    fields = [
        {
            "id": f["id"],
            "label": f["label"],
            "type": f["type"],
            "required": bool(f["required"]),
            "options": json.loads(f["options"]) if f["options"] else [],
        }
        for f in field_rows
    ]
    return {
        "id": form_row["id"],
        "title": form_row["title"],
        "createdAt": form_row["created_at"],
        "fields": fields,
    }


@router.get("")
def list_forms():
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM forms ORDER BY created_at DESC").fetchall()
        return [serialize_form(conn, r) for r in rows]
    finally:
        conn.close()


@router.get("/{form_id}")
def get_form(form_id: int):
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM forms WHERE id = ?", (form_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Form not found.")
        return serialize_form(conn, row)
    finally:
        conn.close()


@router.post("", status_code=201)
def create_form(payload: FormCreate):
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Form title is required.")
    if not payload.fields:
        raise HTTPException(status_code=400, detail="At least one field is required.")
    for f in payload.fields:
        if not f.label.strip():
            raise HTTPException(status_code=400, detail="Every field needs a label.")

    conn = get_connection()
    try:
        cur = conn.execute("INSERT INTO forms (title) VALUES (?)", (payload.title.strip(),))
        form_id = cur.lastrowid
        for idx, f in enumerate(payload.fields):
            conn.execute(
                """INSERT INTO fields (form_id, label, type, required, options, sort_order)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    form_id,
                    f.label.strip(),
                    f.type,
                    1 if f.required else 0,
                    json.dumps(f.options) if f.options else None,
                    idx,
                ),
            )
        conn.commit()
        row = conn.execute("SELECT * FROM forms WHERE id = ?", (form_id,)).fetchone()
        return serialize_form(conn, row)
    finally:
        conn.close()


@router.post("/{form_id}/submissions", status_code=201)
def create_submission(form_id: int, payload: SubmissionCreate):
    conn = get_connection()
    try:
        form = conn.execute("SELECT * FROM forms WHERE id = ?", (form_id,)).fetchone()
        if not form:
            raise HTTPException(status_code=404, detail="Form not found.")
        cur = conn.execute(
            "INSERT INTO submissions (form_id, values_json) VALUES (?, ?)",
            (form_id, json.dumps(payload.values)),
        )
        conn.commit()
        return {"id": cur.lastrowid, "formId": form_id, "values": payload.values}
    finally:
        conn.close()


@router.get("/{form_id}/submissions")
def list_submissions(form_id: int):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM submissions WHERE form_id = ? ORDER BY created_at DESC", (form_id,)
        ).fetchall()
        return [
            {
                "id": r["id"],
                "formId": r["form_id"],
                "values": json.loads(r["values_json"]),
                "createdAt": r["created_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()

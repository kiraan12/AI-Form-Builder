from typing import Optional
from pydantic import BaseModel, field_validator

VALID_TYPES = {"text", "textarea", "number", "date", "dropdown", "checkbox"}


class FieldIn(BaseModel):
    label: str
    type: str
    required: bool = False
    options: Optional[list[str]] = None

    @field_validator("type")
    @classmethod
    def check_type(cls, v: str) -> str:
        if v not in VALID_TYPES:
            raise ValueError(f"Invalid field type: {v}")
        return v


class FormCreate(BaseModel):
    title: str
    fields: list[FieldIn]


class SubmissionCreate(BaseModel):
    values: dict

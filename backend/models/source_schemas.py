from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, validator


class SourceItem(BaseModel):
    id: str
    name: str
    path: str
    enabled: bool = True
    read_only: bool = True
    source_type: str = "local"
    is_default: bool = False


class CreateSourceRequest(BaseModel):
    name: str
    path: str
    enabled: bool = True
    read_only: bool = True
    source_type: str = "local"

    @validator("name", "path", "source_type")
    def validate_required_strings(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Field is required")
        return value


class UpdateSourceRequest(BaseModel):
    name: Optional[str] = None
    path: Optional[str] = None
    enabled: Optional[bool] = None
    read_only: Optional[bool] = None
    source_type: Optional[str] = None
    is_default: Optional[bool] = None

    @validator("name", "path", "source_type")
    def validate_optional_strings(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Field must not be empty")
        return value


class SourceListResponse(BaseModel):
    sources: List[SourceItem] = Field(default_factory=list)


class SourceMessageResponse(BaseModel):
    message: str
    source: SourceItem
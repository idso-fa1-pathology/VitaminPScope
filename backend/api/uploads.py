from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, File, Form, UploadFile

from dependencies.auth import get_current_user_key
from models.upload_schemas import UploadResponse
from services.upload_service import upload_many_files

router = APIRouter(tags=["uploads"])


@router.post("/uploads", response_model=UploadResponse)
async def upload_files(
    files: List[UploadFile] = File(...),
    target_path: str = Form(default=""),
    overwrite: bool = Form(default=False),
    user_key: str = Depends(get_current_user_key),
) -> UploadResponse:
    return upload_many_files(
        user_key=user_key,
        files=files,
        target_path=target_path,
        overwrite=overwrite,
    )
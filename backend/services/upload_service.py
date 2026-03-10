from __future__ import annotations

from pathlib import Path
from typing import Iterable

from fastapi import UploadFile

from models.upload_schemas import UploadFailure, UploadResponse, UploadedItem
from services.storage_service import (
    StorageError,
    normalize_relative_path,
    save_upload_stream,
)

ALLOWED_EXTENSIONS = {
    ".svs",
    ".ndpi",
    ".tif",
    ".tiff",
    ".png",
    ".jpg",
    ".jpeg",
    ".czi",
    ".mrxs",
    ".scn",
    ".vms",
    ".vmu",
    ".dcm",
    ".dicom",
}

OME_SUFFIXES = {
    ".ome.tif",
    ".ome.tiff",
}

MAX_FILE_SIZE_MB = 8192  # 8 GB
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


class UploadValidationError(Exception):
    pass


def detect_slide_type(filename: str) -> str:
    lower = filename.lower()

    if lower.endswith(".ome.tif") or lower.endswith(".ome.tiff"):
        return "ome-tiff"

    suffix = Path(lower).suffix.lower().lstrip(".")
    return suffix or "unknown"


def is_allowed_filename(filename: str) -> bool:
    lower = filename.lower()

    if any(lower.endswith(suffix) for suffix in OME_SUFFIXES):
        return True

    ext = Path(lower).suffix.lower()
    return ext in ALLOWED_EXTENSIONS


def validate_upload_file(upload: UploadFile) -> None:
    filename = upload.filename or ""
    if not filename.strip():
        raise UploadValidationError("Missing filename.")

    if not is_allowed_filename(filename):
        raise UploadValidationError(f"Unsupported file type for '{filename}'.")


def upload_many_files(
    files: list[UploadFile],
    target_path: str = "",
    overwrite: bool = False,
) -> UploadResponse:
    normalized_target = normalize_relative_path(target_path)
    uploaded_items: list[UploadedItem] = []
    failed_items: list[UploadFailure] = []

    for upload in files:
        try:
            validate_upload_file(upload)

            result = save_upload_stream(
                file_obj=upload.file,
                filename=upload.filename or "upload.bin",
                target_dir=normalized_target,
                overwrite=overwrite,
            )

            uploaded_items.append(
                UploadedItem(
                    name=result["name"],
                    path=result["path"],
                    type=detect_slide_type(result["name"]),
                    size=result["size"],
                    kind="slide",
                    overwritten=result["overwritten"],
                )
            )
        except (UploadValidationError, StorageError) as exc:
            failed_items.append(
                UploadFailure(
                    name=upload.filename or "unknown",
                    error=str(exc),
                )
            )
        except Exception as exc:
            failed_items.append(
                UploadFailure(
                    name=upload.filename or "unknown",
                    error=f"Unexpected upload error: {exc}",
                )
            )
        finally:
            try:
                upload.file.close()
            except Exception:
                pass

    message = None
    if uploaded_items and not failed_items:
        message = f"Uploaded {len(uploaded_items)} file(s) successfully."
    elif uploaded_items and failed_items:
        message = f"Uploaded {len(uploaded_items)} file(s), {len(failed_items)} failed."
    elif failed_items:
        message = "All uploads failed."

    return UploadResponse(
        uploaded=uploaded_items,
        failed=failed_items,
        target_path=normalized_target,
        message=message,
    )
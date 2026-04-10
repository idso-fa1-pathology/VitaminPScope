from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import BinaryIO

from services.workspace_service import get_user_uploads_root


_FILENAME_SANITIZE_RE = re.compile(r"[^A-Za-z0-9._()\- ]+")


class StorageError(Exception):
    pass


class InvalidPathError(StorageError):
    pass


class FileConflictError(StorageError):
    pass


def get_data_root(user_key: str) -> Path:
    """
    Per-user upload root.

    Old behavior used one shared global data root.
    New behavior isolates each user's uploaded content under:
      users/<user>/uploads/
    """
    return get_user_uploads_root(user_key).resolve()


def ensure_data_root(user_key: str) -> Path:
    root = get_data_root(user_key)
    root.mkdir(parents=True, exist_ok=True)
    return root


def normalize_relative_path(relative_path: str | None) -> str:
    if not relative_path:
        return ""

    cleaned = str(relative_path).replace("\\", "/").strip().strip("/")
    cleaned = re.sub(r"/+", "/", cleaned)

    if cleaned in {"", "."}:
        return ""

    if cleaned.startswith("../") or cleaned == "..":
        raise InvalidPathError("Path traversal is not allowed.")

    return cleaned


def resolve_directory(user_key: str, relative_dir: str | None = "") -> Path:
    root = ensure_data_root(user_key)
    rel = normalize_relative_path(relative_dir)
    target = (root / rel).resolve()

    if root != target and root not in target.parents:
        raise InvalidPathError("Resolved path is outside the user data root.")

    return target


def ensure_directory(user_key: str, relative_dir: str | None = "") -> Path:
    target = resolve_directory(user_key, relative_dir)
    target.mkdir(parents=True, exist_ok=True)
    return target


def sanitize_filename(filename: str) -> str:
    if not filename:
        raise StorageError("Missing filename.")

    base_name = Path(filename).name.strip()
    if not base_name:
        raise StorageError("Invalid filename.")

    sanitized = _FILENAME_SANITIZE_RE.sub("_", base_name)
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    sanitized = sanitized.strip(".")

    if not sanitized:
        raise StorageError("Filename became empty after sanitization.")

    return sanitized


def resolve_collision(target_path: Path, overwrite: bool = False) -> tuple[Path, bool]:
    if overwrite:
        return target_path, target_path.exists()

    if not target_path.exists():
        return target_path, False

    stem = target_path.stem
    suffix = target_path.suffix
    parent = target_path.parent

    counter = 1
    while True:
        candidate = parent / f"{stem} ({counter}){suffix}"
        if not candidate.exists():
            return candidate, False
        counter += 1


def write_stream_to_path(
    file_obj: BinaryIO,
    destination: Path,
    chunk_size: int = 1024 * 1024,
) -> int:
    total_written = 0

    with destination.open("wb") as out_file:
        while True:
            chunk = file_obj.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            total_written += len(chunk)

    return total_written


def save_upload_stream(
    user_key: str,
    file_obj: BinaryIO,
    filename: str,
    target_dir: str | None = "",
    overwrite: bool = False,
) -> dict:
    safe_name = sanitize_filename(filename)
    target_directory = ensure_directory(user_key, target_dir)
    final_path, was_overwritten = resolve_collision(
        target_directory / safe_name,
        overwrite=overwrite,
    )
    size = write_stream_to_path(file_obj, final_path)

    data_root = ensure_data_root(user_key)
    relative_path = final_path.relative_to(data_root).as_posix()

    return {
        "name": final_path.name,
        "path": relative_path,
        "size": size,
        "absolute_path": str(final_path),
        "overwritten": was_overwritten,
    }


def create_folder(user_key: str, relative_dir: str | None = "") -> Path:
    return ensure_directory(user_key, relative_dir)


def delete_path(user_key: str, relative_path: str) -> None:
    target = resolve_directory(user_key, relative_path)

    if target.is_dir():
        shutil.rmtree(target)
    elif target.exists():
        target.unlink()
    else:
        raise StorageError("Path does not exist.")
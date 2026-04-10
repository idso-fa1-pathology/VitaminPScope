from __future__ import annotations

import os
import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_APP_DATA_ROOT = PROJECT_ROOT / "data"

_USER_KEY_SANITIZE_RE = re.compile(r"[^A-Za-z0-9._@\-]+")


class WorkspaceError(Exception):
    pass


def get_app_data_root() -> Path:
    """
    Base application data root.

    This is intentionally broader than the current VITAMINP_DATA_ROOT,
    because internal usage will need separate areas for:
      - users
      - shared sources
      - sessions
      - exports
    """
    env_value = os.getenv("VITAMINPSCOPE_APP_DATA_ROOT", "").strip()
    if env_value:
        return Path(env_value).expanduser().resolve()
    return DEFAULT_APP_DATA_ROOT.resolve()


def ensure_app_data_root() -> Path:
    root = get_app_data_root()
    root.mkdir(parents=True, exist_ok=True)
    return root


def sanitize_user_key(user_key: str) -> str:
    """
    Convert institution-provided user identity into a filesystem-safe key.

    Example:
      john.doe@mdanderson.org -> john.doe@mdanderson.org
      domain\\john.doe -> domain_john.doe
    """
    raw = (user_key or "").strip()
    if not raw:
        raise WorkspaceError("Missing user key.")

    safe = raw.replace("\\", "_").replace("/", "_")
    safe = _USER_KEY_SANITIZE_RE.sub("_", safe).strip(" .")

    if not safe:
        raise WorkspaceError("User key became empty after sanitization.")

    return safe


def get_users_root() -> Path:
    root = ensure_app_data_root() / "users"
    root.mkdir(parents=True, exist_ok=True)
    return root


def get_user_root(user_key: str) -> Path:
    safe_user = sanitize_user_key(user_key)
    user_root = get_users_root() / safe_user
    user_root.mkdir(parents=True, exist_ok=True)
    return user_root


def get_user_uploads_root(user_key: str) -> Path:
    path = get_user_root(user_key) / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_user_sessions_root(user_key: str) -> Path:
    path = get_user_root(user_key) / "sessions"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_user_exports_root(user_key: str) -> Path:
    path = get_user_root(user_key) / "exports"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_user_temp_root(user_key: str) -> Path:
    path = get_user_root(user_key) / "temp"
    path.mkdir(parents=True, exist_ok=True)
    return path


def ensure_standard_workspace_dirs(user_key: str) -> dict[str, str]:
    """
    Create the standard per-user workspace layout and return absolute paths.
    """
    return {
        "user_root": str(get_user_root(user_key)),
        "uploads_root": str(get_user_uploads_root(user_key)),
        "sessions_root": str(get_user_sessions_root(user_key)),
        "exports_root": str(get_user_exports_root(user_key)),
        "temp_root": str(get_user_temp_root(user_key)),
    }
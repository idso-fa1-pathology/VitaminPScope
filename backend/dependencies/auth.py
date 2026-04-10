from __future__ import annotations

from fastapi import Header

from core.runtime_context import get_runtime_user_key


def get_current_user_key(
    x_user_key: str | None = Header(default=None, alias="X-User-Key"),
) -> str:
    """
    Temporary current-user resolver.

    Priority:
    1. Explicit request header (for future proxy/auth integration)
    2. Runtime fallback user from environment/config

    Later, replace this with real MD Anderson authentication context.
    """
    if x_user_key and x_user_key.strip():
        return x_user_key.strip()

    return get_runtime_user_key()
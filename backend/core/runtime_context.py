from __future__ import annotations

import os


def get_runtime_user_key() -> str:
    """
    Temporary runtime user identity until real authentication is integrated.

    Keep this neutral for the public/core app.
    Later this function should read the authenticated user from request context.
    """
    return os.getenv("VITAMINPSCOPE_DEV_USER", "demo-user")
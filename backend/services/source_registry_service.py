from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import List, Optional

from models.source_schemas import CreateSourceRequest, SourceItem, UpdateSourceRequest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REGISTRY_PATH = PROJECT_ROOT / "data" / "source_registry.json"

ALLOWED_SOURCE_ROOTS = [
    "/data",
    "/mnt/slides",
]

DEFAULT_SOURCE_NAME = "Local Samples"
DEFAULT_SOURCE_TYPE = "local"
DEFAULT_SOURCE_PATH = os.getenv("VITAMINP_DATA_ROOT", "/data/sample_slides")


class SourceRegistryError(Exception):
    pass


class SourceNotFoundError(SourceRegistryError):
    pass


class SourceValidationError(SourceRegistryError):
    pass


def get_registry_path() -> Path:
    env_value = os.getenv("VITAMINP_SOURCE_REGISTRY", "").strip()
    if env_value:
        return Path(env_value).expanduser().resolve()
    return DEFAULT_REGISTRY_PATH.resolve()


def ensure_registry_parent_dir() -> None:
    registry_path = get_registry_path()
    registry_path.parent.mkdir(parents=True, exist_ok=True)


def normalize_source_path(path: str) -> str:
    candidate = (path or "").strip()
    if not candidate:
        raise SourceValidationError("Source path is required.")

    candidate_path = Path(candidate).expanduser().resolve()
    return str(candidate_path)


def normalize_allowed_roots() -> List[Path]:
    roots: list[Path] = []

    env_value = os.getenv("VITAMINP_ALLOWED_SOURCE_ROOTS", "").strip()
    raw_roots = (
        [part.strip() for part in env_value.split(",") if part.strip()]
        if env_value
        else ALLOWED_SOURCE_ROOTS
    )

    for root in raw_roots:
        try:
            roots.append(Path(root).expanduser().resolve())
        except Exception:
            continue

    return roots


def validate_source_path(path: str) -> str:
    normalized_path = normalize_source_path(path)
    path_obj = Path(normalized_path)

    allowed_roots = normalize_allowed_roots()
    if not allowed_roots:
        raise SourceValidationError("No allowed source roots are configured.")

    if not path_obj.exists():
        raise SourceValidationError("Source path does not exist.")

    if not path_obj.is_dir():
        raise SourceValidationError("Source path must be a directory.")

    is_allowed = False
    for root in allowed_roots:
        if path_obj == root or root in path_obj.parents:
            is_allowed = True
            break

    if not is_allowed:
        allowed_display = ", ".join(str(root) for root in allowed_roots)
        raise SourceValidationError(
            f"Source path must be inside an allowed root: {allowed_display}"
        )

    return normalized_path


def slugify_name(name: str) -> str:
    value = (name or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value or f"source-{uuid.uuid4().hex[:8]}"


def make_unique_source_id(name: str, existing_ids: set[str]) -> str:
    base = slugify_name(name)
    if base not in existing_ids:
        return base

    counter = 2
    while True:
        candidate = f"{base}-{counter}"
        if candidate not in existing_ids:
            return candidate
        counter += 1


def source_to_dict(source: SourceItem) -> dict:
    return source.model_dump()


def load_sources() -> list[SourceItem]:
    ensure_registry_parent_dir()
    registry_path = get_registry_path()

    if not registry_path.exists():
        sources = build_default_sources()
        save_sources(sources)
        return sources

    with registry_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    raw_sources = payload if isinstance(payload, list) else payload.get("sources", [])
    sources = [SourceItem(**item) for item in raw_sources]

    if not sources:
        sources = build_default_sources()
        save_sources(sources)
        return sources

    sources = normalize_default_source(sources)
    return sources


def save_sources(sources: list[SourceItem]) -> None:
    ensure_registry_parent_dir()
    registry_path = get_registry_path()

    normalized_sources = normalize_default_source(sources)

    with registry_path.open("w", encoding="utf-8") as f:
        json.dump(
            [source_to_dict(source) for source in normalized_sources],
            f,
            indent=2,
            ensure_ascii=False,
        )


def build_default_sources() -> list[SourceItem]:
    default_path = DEFAULT_SOURCE_PATH
    sources: list[SourceItem] = []

    try:
        validated_path = validate_source_path(default_path)
        sources.append(
            SourceItem(
                id="default",
                name=DEFAULT_SOURCE_NAME,
                path=validated_path,
                enabled=True,
                read_only=False,
                source_type=DEFAULT_SOURCE_TYPE,
                is_default=True,
            )
        )
    except SourceValidationError:
        # If the default path is not valid in the current environment,
        # keep the registry empty rather than crashing.
        pass

    return sources


def normalize_default_source(sources: list[SourceItem]) -> list[SourceItem]:
    if not sources:
        return sources

    default_indices = [i for i, source in enumerate(sources) if source.is_default]
    if not default_indices:
        first = sources[0].model_copy(update={"is_default": True})
        sources = [first, *sources[1:]]
        return sources

    first_default_idx = default_indices[0]
    normalized: list[SourceItem] = []

    for idx, source in enumerate(sources):
        should_be_default = idx == first_default_idx
        normalized.append(source.model_copy(update={"is_default": should_be_default}))

    return normalized


def get_all_sources() -> list[SourceItem]:
    return load_sources()


def get_enabled_sources() -> list[SourceItem]:
    return [source for source in load_sources() if source.enabled]


def get_source_by_id(source_id: str) -> SourceItem:
    sources = load_sources()
    for source in sources:
        if source.id == source_id:
            return source
    raise SourceNotFoundError(f"Source '{source_id}' not found.")


def create_source(payload: CreateSourceRequest) -> SourceItem:
    sources = load_sources()

    validated_path = validate_source_path(payload.path)
    normalized_name = payload.name.strip()
    normalized_type = payload.source_type.strip().lower()

    existing_ids = {source.id for source in sources}
    new_id = make_unique_source_id(normalized_name, existing_ids)

    for source in sources:
        if Path(source.path).resolve() == Path(validated_path).resolve():
            raise SourceValidationError("This source path is already registered.")

    new_source = SourceItem(
        id=new_id,
        name=normalized_name,
        path=validated_path,
        enabled=payload.enabled,
        read_only=payload.read_only,
        source_type=normalized_type,
        is_default=not sources,
    )

    sources.append(new_source)
    sources = normalize_default_source(sources)
    save_sources(sources)

    return next(source for source in sources if source.id == new_id)


def update_source(source_id: str, payload: UpdateSourceRequest) -> SourceItem:
    sources = load_sources()

    target_index = None
    for index, source in enumerate(sources):
        if source.id == source_id:
            target_index = index
            break

    if target_index is None:
        raise SourceNotFoundError(f"Source '{source_id}' not found.")

    current = sources[target_index]

    next_name = payload.name.strip() if payload.name is not None else current.name
    next_path = (
        validate_source_path(payload.path)
        if payload.path is not None
        else current.path
    )
    next_type = (
        payload.source_type.strip().lower()
        if payload.source_type is not None
        else current.source_type
    )
    next_enabled = payload.enabled if payload.enabled is not None else current.enabled
    next_read_only = (
        payload.read_only if payload.read_only is not None else current.read_only
    )
    next_is_default = (
        payload.is_default if payload.is_default is not None else current.is_default
    )

    for other in sources:
        if other.id == source_id:
            continue
        if Path(other.path).resolve() == Path(next_path).resolve():
            raise SourceValidationError("Another source already uses this path.")

    updated = current.model_copy(
        update={
            "name": next_name,
            "path": next_path,
            "enabled": next_enabled,
            "read_only": next_read_only,
            "source_type": next_type,
            "is_default": next_is_default,
        }
    )

    sources[target_index] = updated
    sources = normalize_default_source(sources)
    save_sources(sources)

    return next(source for source in sources if source.id == source_id)


def delete_source(source_id: str) -> SourceItem:
    sources = load_sources()

    if len(sources) <= 1:
        raise SourceValidationError("At least one source must remain registered.")

    removed: Optional[SourceItem] = None
    kept: list[SourceItem] = []

    for source in sources:
        if source.id == source_id:
            removed = source
        else:
            kept.append(source)

    if removed is None:
        raise SourceNotFoundError(f"Source '{source_id}' not found.")

    kept = normalize_default_source(kept)
    save_sources(kept)

    return removed
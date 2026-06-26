import re


def slugify(value: str) -> str:
    """Turn a free-text product/angle name into a filesystem-safe folder name."""
    value = re.sub(r"[^a-z0-9]+", "_", value.strip().lower())
    return value.strip("_") or "unnamed"

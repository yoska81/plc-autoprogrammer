"""On-disk path resolution for one product/angle combination.

The database (core/db.py) is the source of truth for which files exist;
this module only computes where new files should be written, following
the layout in SPECIFICATION.md:

    data/products/<product_slug>/<angle_slug>/reference/
    data/products/<product_slug>/<angle_slug>/inspection/
    data/difference_images/<product_slug>/<angle_slug>/
    data/bad_products/<product_slug>/<angle_slug>/
"""
from datetime import datetime
from pathlib import Path

from . import config
from .naming import slugify


def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S_%f")


class ProductAngleLocation:
    """Resolves the on-disk directories/filenames for one product/angle."""

    def __init__(self, product: str, angle: str):
        self.product = product
        self.angle = angle
        self.product_slug = slugify(product)
        self.angle_slug = slugify(angle)

        product_root = config.PRODUCTS_DIR / self.product_slug / self.angle_slug
        self.reference_dir = product_root / "reference"
        self.inspection_dir = product_root / "inspection"
        self.diff_dir = config.DIFFERENCE_IMAGES_DIR / self.product_slug / self.angle_slug
        self.bad_products_dir = config.BAD_PRODUCTS_DIR / self.product_slug / self.angle_slug
        self.normalized_dir = product_root / "normalized"

    def ensure_dirs(self) -> None:
        for path in (self.reference_dir, self.inspection_dir, self.diff_dir,
                     self.bad_products_dir, self.normalized_dir):
            path.mkdir(parents=True, exist_ok=True)

    def new_reference_path(self) -> Path:
        self.ensure_dirs()
        return self.reference_dir / f"reference_{_timestamp()}.png"

    def new_inspection_path(self) -> Path:
        self.ensure_dirs()
        return self.inspection_dir / f"inspection_{_timestamp()}.png"

    def new_diff_path(self) -> Path:
        self.ensure_dirs()
        return self.diff_dir / f"diff_{_timestamp()}.png"

    def new_bad_product_path(self, suffix: str = "") -> Path:
        self.ensure_dirs()
        return self.bad_products_dir / f"bad_{_timestamp()}{suffix}.png"

    def new_normalized_path(self) -> Path:
        self.ensure_dirs()
        return self.normalized_dir / f"normalized_{_timestamp()}.png"


def new_no_product_path() -> Path:
    """Not tied to any product/angle - V2's NO_PRODUCT_FOUND handling can hit
    before a product is even identified, so this is one flat folder shared
    across the whole app (data/no_product/), unlike the per-product/angle
    layout above."""
    config.NO_PRODUCT_DIR.mkdir(parents=True, exist_ok=True)
    return config.NO_PRODUCT_DIR / f"no_product_{_timestamp()}.png"

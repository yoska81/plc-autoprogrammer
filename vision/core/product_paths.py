from . import config
from .naming import slugify


class ProductAngleLocation:
    """Resolves the on-disk paths used for one product/angle combination."""

    def __init__(self, product: str, angle: str):
        self.product = product
        self.angle = angle
        self.product_slug = slugify(product)
        self.angle_slug = slugify(angle)

        root = config.PRODUCTS_DIR / self.product_slug / self.angle_slug
        self.reference_path = root / "reference" / "good_reference.png"
        self.inspection_path = root / "inspection" / "latest_inspection.png"
        self.diff_path = root / "diff" / "latest_diff.png"
        self.bad_products_dir = config.BAD_PRODUCTS_DIR / self.product_slug / self.angle_slug

    def ensure_dirs(self) -> None:
        for path in (self.reference_path, self.inspection_path, self.diff_path):
            path.parent.mkdir(parents=True, exist_ok=True)
        self.bad_products_dir.mkdir(parents=True, exist_ok=True)

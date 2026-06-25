from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = VISION_ROOT / "data"
TEST_IMAGES_DIR = DATA_DIR / "test_images"
CAPTURES_DIR = DATA_DIR / "captures"
PRODUCTS_DIR = DATA_DIR / "products"
BAD_PRODUCTS_DIR = DATA_DIR / "bad_products"
RESULTS_CSV_PATH = DATA_DIR / "results.csv"
RESULTS_DB_PATH = DATA_DIR / "results.db"

DEFAULT_CAMERA_MODE = "auto"  # "auto" | "real" | "test"
DEFAULT_DEVICE_INDEX = 0
DEFAULT_FRAME_WIDTH = 1280
DEFAULT_FRAME_HEIGHT = 720
DEFAULT_MATCH_THRESHOLD_PERCENT = 95.0

from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = VISION_ROOT / "data"
TEST_IMAGES_DIR = DATA_DIR / "test_images"
CAPTURES_DIR = DATA_DIR / "captures"
REFERENCE_DIR = DATA_DIR / "reference"
INSPECTION_DIR = DATA_DIR / "inspection"

DEFAULT_CAMERA_MODE = "auto"  # "auto" | "real" | "test"
DEFAULT_DEVICE_INDEX = 0
DEFAULT_FRAME_WIDTH = 1280
DEFAULT_FRAME_HEIGHT = 720

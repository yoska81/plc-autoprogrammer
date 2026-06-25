import sys
from pathlib import Path

if getattr(sys, "frozen", False):
    # Inside a PyInstaller onedir build, __file__ points into the frozen
    # archive, not the real folder layout next to the .exe; use the exe's
    # own location instead so data/ resolves alongside it.
    VISION_ROOT = Path(sys.executable).resolve().parent
else:
    VISION_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = VISION_ROOT / "data"
TEST_IMAGES_DIR = DATA_DIR / "test_images"
CAPTURES_DIR = DATA_DIR / "captures"
PRODUCTS_DIR = DATA_DIR / "products"
BAD_PRODUCTS_DIR = DATA_DIR / "bad_products"
DIFFERENCE_IMAGES_DIR = DATA_DIR / "difference_images"
REPORTS_DIR = DATA_DIR / "reports"

DATABASE_DIR = VISION_ROOT / "database"
DATABASE_PATH = DATABASE_DIR / "vision.db"

LOGS_DIR = VISION_ROOT / "logs"

DEFAULT_CAMERA_MODE = "auto"  # "auto" | "real" | "test"
DEFAULT_DEVICE_INDEX = 0

# Prototype hardware: SVPRO USB UVC camera, 1080P/60fps, 2.8-12mm manual
# zoom CS-mount lens (manual focus/aperture, adjusted by hand on the lens
# barrel - the software never drives zoom/focus/aperture). It is a plain
# UVC device, opened through OpenCV VideoCapture like any USB webcam; no
# vendor SDK is required. 1920x1080 is preferred, but the camera layer
# falls back to a lower resolution automatically if the requested one
# can't be opened reliably (see RESOLUTION_FALLBACKS below).
DEFAULT_FRAME_WIDTH = 1920
DEFAULT_FRAME_HEIGHT = 1080
DEFAULT_FRAME_FPS = 60
RESOLUTION_FALLBACKS = (
    (1920, 1080),
    (1280, 720),
    (640, 480),
)
DEFAULT_MATCH_THRESHOLD_PERCENT = 95.0
DEFAULT_SAVE_ALL_SNAPSHOTS = True
DEFAULT_SAVE_BAD_PRODUCTS = True
DEFAULT_PLC_SIMULATION_MODE = True
DEFAULT_COMMUNICATION_TYPE = "Simulation"  # placeholder only, see machine_interface/
COMMUNICATION_TYPE_CHOICES = (
    "None", "Simulation", "Modbus TCP", "Modbus RTU", "Serial", "USB relay", "Ethernet I/O",
)

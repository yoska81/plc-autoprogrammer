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

# ---------------------------------------------------------------- V2 engine
# "Free Position / Free Rotation" (2D Pose Match) inspection engine
# (core/compare_v2.py). The product stays in the same camera direction (no
# 3D viewpoint change) but can shift, rotate 0-360 deg, and scale slightly
# within the frame. V1's fixed-reference pixel diff is untouched; these are
# new, independent settings read by core/app.py only when inspection_mode
# is "free_pose".
INSPECTION_MODE_FIXED = "fixed"
INSPECTION_MODE_FREE_POSE = "free_pose"
INSPECTION_MODE_CHOICES = (INSPECTION_MODE_FIXED, INSPECTION_MODE_FREE_POSE)
DEFAULT_INSPECTION_MODE = INSPECTION_MODE_FIXED

MATCHING_METHOD_PIXEL = "pixel"
MATCHING_METHOD_FEATURE = "feature"
MATCHING_METHOD_HYBRID = "hybrid"
MATCHING_METHOD_CHOICES = (MATCHING_METHOD_PIXEL, MATCHING_METHOD_FEATURE, MATCHING_METHOD_HYBRID)
DEFAULT_MATCHING_METHOD = MATCHING_METHOD_HYBRID

ALIGNMENT_METHOD_ORB = "orb"
ALIGNMENT_METHOD_AKAZE = "akaze"
ALIGNMENT_METHOD_CONTOUR = "contour"
ALIGNMENT_METHOD_HYBRID = "hybrid"  # ORB, falling back to AKAZE, falling back to contour
ALIGNMENT_METHOD_CHOICES = (
    ALIGNMENT_METHOD_ORB, ALIGNMENT_METHOD_AKAZE, ALIGNMENT_METHOD_CONTOUR, ALIGNMENT_METHOD_HYBRID,
)
DEFAULT_ALIGNMENT_METHOD = ALIGNMENT_METHOD_HYBRID

DEFAULT_MIN_RECOGNITION_CONFIDENCE = 60.0  # [0-100]; below this -> product not reliably located
DEFAULT_MIN_FEATURE_MATCHES = 10  # minimum RANSAC inlier matches to trust an ORB/AKAZE alignment
DEFAULT_SAVE_NORMALIZED_IMAGE = True

# Combined-score weights (must be explainable - a plain weighted average of
# the four sub-scores, no black-box model). Used only when matching_method
# is "hybrid"; "pixel" / "feature" modes use that one sub-score directly.
DEFAULT_FEATURE_SCORE_WEIGHT = 0.35
DEFAULT_SHAPE_SCORE_WEIGHT = 0.15
DEFAULT_PIXEL_SCORE_WEIGHT = 0.35
DEFAULT_EDGE_SCORE_WEIGHT = 0.15

# All V2 alignment happens into this fixed-size canonical frame, regardless
# of the original reference image's resolution, so scores are comparable
# across references.
CANONICAL_SIZE = (480, 480)  # (width, height)

# ---------------------------------------------------------- result states
# NO_PRODUCT_FOUND is never the same as BAD: BAD means a product was located
# and failed inspection; NO_PRODUCT_FOUND means the engine could not locate
# any product in the frame at all (early trigger, empty conveyor gap, a
# manual trigger with nothing in front of the camera, etc). SKIPPED means an
# inspection cycle was intentionally excluded from GOOD/BAD/NO_PRODUCT
# counting (see NO_PRODUCT_ACTION_SKIP below). ERROR covers an inspection
# cycle that failed for reasons unrelated to product quality (camera/IO
# exceptions raised mid-cycle).
RESULT_GOOD = "GOOD"
RESULT_BAD = "BAD"
RESULT_NO_PRODUCT_FOUND = "NO_PRODUCT_FOUND"
RESULT_SKIPPED = "SKIPPED"
RESULT_ERROR = "ERROR"
RESULT_CHOICES = (RESULT_GOOD, RESULT_BAD, RESULT_NO_PRODUCT_FOUND, RESULT_SKIPPED, RESULT_ERROR)

# What to do when V2 can't locate a product at all. This only applies to
# inspection_mode == INSPECTION_MODE_FREE_POSE; V1 has no localization step
# and so no concept of "no product found".
NO_PRODUCT_ACTION_SKIP = "skip"                        # don't save, don't count GOOD/BAD/NO_PRODUCT
NO_PRODUCT_ACTION_COUNT_AS_NO_PRODUCT = "count_as_no_product"  # save result=NO_PRODUCT_FOUND
NO_PRODUCT_ACTION_TREAT_AS_BAD = "treat_as_bad"        # save result=BAD
NO_PRODUCT_ACTION_ASK_OPERATOR = "ask_operator"        # UI must prompt before saving anything
NO_PRODUCT_ACTION_CHOICES = (
    NO_PRODUCT_ACTION_SKIP, NO_PRODUCT_ACTION_COUNT_AS_NO_PRODUCT,
    NO_PRODUCT_ACTION_TREAT_AS_BAD, NO_PRODUCT_ACTION_ASK_OPERATOR,
)
# Simulation/manual mode default: an empty trigger shouldn't pollute GOOD/BAD
# stats. Production lines can switch this per machine sequence in Settings.
DEFAULT_NO_PRODUCT_ACTION = NO_PRODUCT_ACTION_SKIP
DEFAULT_SAVE_NO_PRODUCT_IMAGES = False
DEFAULT_LOG_SKIPPED_INSPECTIONS = False

NO_PRODUCT_DIR = DATA_DIR / "no_product"

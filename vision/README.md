# Vision (QC camera capture + GOOD/BAD comparison)

Vision subsystem for PLC Autoprogrammer: a standalone Python app that
captures frames from either a real USB camera (local PC) or a
bundled/synthetic test image (cloud, no camera attached), saves a GOOD
reference and an inspection image per product/angle, and compares them with
OpenCV to produce a GOOD/BAD result. No AI, OCR, object detection, FastAPI,
or PLC integration yet.

## Setup

```bash
cd vision
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python main.py --mode auto   # default: real camera if present, else test images
python main.py --mode real   # force a physical USB camera (local PC only)
python main.py --mode test   # force the bundled/synthetic test image feed
```

Menu options: select product/angle, live preview, save GOOD reference,
capture inspection image, run GOOD/BAD comparison, show last result, exit.

## Camera modes

- `RealCamera` (`core/camera/real_camera.py`): reads from a USB camera via
  OpenCV. Requires a physical camera and is intended for local PC testing.
- `TestImageCamera` (`core/camera/test_camera.py`): cycles through the
  sample images in `data/test_images/`, falling back to a generated
  synthetic frame if that folder is empty. Used for cloud testing where no
  camera is attached.
- `create_camera_source(mode="auto", ...)` (`core/camera/factory.py`):
  probes for a real camera and transparently falls back to test images, so
  the app always runs.

## GOOD/BAD comparison

`compare_images()` (`core/compare.py`) resizes the inspection image to the
reference size if they differ, converts both to grayscale, and computes a
similarity score as `100 - mean(absolute pixel difference)`. The result is
GOOD if the score meets `DEFAULT_MATCH_THRESHOLD_PERCENT` (95% by default,
in `core/config.py`), otherwise BAD. A diff visualization (colormap of the
pixel difference) is saved alongside. No alignment beyond resizing, no AI.

Every comparison is logged as a row in `data/results.csv` and in the
`results` table of the SQLite database `data/results.db`
(`core/results_store.py`). On a BAD result, the inspection image and diff
image are additionally copied into `data/bad_products/<product>/<angle>/`
for traceability.

## Data layout

- `data/test_images/` — bundled sample frames for test mode (checked in).
- `data/captures/` — manual/live-preview snapshots.
- `data/products/<product>/<angle>/reference/good_reference.png` — the GOOD
  reference image for that product/angle.
- `data/products/<product>/<angle>/inspection/latest_inspection.png` — the
  latest captured inspection image.
- `data/products/<product>/<angle>/diff/latest_diff.png` — the latest diff
  visualization from a comparison run.
- `data/bad_products/<product>/<angle>/` — archived copies of BAD inspection
  and diff images, timestamped.
- `data/results.csv` / `data/results.db` — the full comparison history.

`opencv-python-headless` is used by default since it has no GUI
dependencies and works in headless cloud environments; the live preview
falls back to writing frames to `data/captures/_live_preview.png` when no
display is available. For an on-screen preview window during local PC
testing, swap it for `opencv-python` in `requirements.txt`.

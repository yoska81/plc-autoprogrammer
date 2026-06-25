# Vision (QC camera capture + GOOD/BAD comparison)

Vision subsystem for PLC Autoprogrammer: a standalone Python app that
captures frames from either a real USB camera (local PC) or a
bundled/synthetic test image (cloud, no camera attached), saves a GOOD
reference and an inspection image per product/angle, and compares them with
OpenCV to produce a GOOD/BAD result. No AI, OCR, object detection, FastAPI,
or PLC integration yet.

Two front ends drive the same engine in `core/`: a text menu (`main.py`)
and a desktop UI (`ui_main.py`).

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

## Desktop UI

A Tesla-style black-and-white desktop UI built with PySide6, under `ui/`:

```bash
python ui_main.py --mode auto   # same --mode/--device-index flags as main.py
```

It shows the live camera/test feed, the GOOD reference, the inspection
image, the GOOD/BAD result and similarity score, the current
product/angle/last-inspection-time, and a 20-row inspection history table.
Buttons map directly onto the existing `core/app.py` engine — the UI adds
no new comparison or capture logic:

- **Start Camera / Stop Camera** — `QCApp.start()` / `QCApp.stop()`, drive
  the 200ms live preview timer.
- **Add Product** — prompts for a product name and a first angle, then
  `select_product_angle()`.
- **Select Product** — browses existing `data/products/` folders and picks
  a product/angle pair. Note: this list shows the slugified folder name
  (e.g. `widget_a`), not the original display-cased text typed under Add
  Product, since the slug is the only thing kept on disk.
- **Add Angle** — adds a new angle under the currently selected product.
- **Save GOOD Reference** / **Take Inspection Picture** —
  `save_good_reference()` / `capture_inspection_image()`.
- **Compare** — `compute_comparison()`: runs the GOOD/BAD comparison and
  updates the result badge/score, but does not log or archive anything yet.
- **Save Result** — `persist_last_result()`: logs the last `Compare` result
  to CSV/SQLite and archives BAD captures, same as the CLI's combined
  "run comparison" step.
- **Open Bad Products Folder** — opens `data/bad_products/<product>/<angle>/`
  (or the top-level folder if no product is selected) in the OS file
  browser.
- **Export Report** — copies `data/results.csv` to a location you choose.
- **Settings** — change camera mode/device index (restarts the camera if
  running) and the match threshold percentage. "Detect Cameras" probes
  device indices 0, 1, 2 and reports which ones respond.

Runs headless too: set `QT_QPA_PLATFORM=offscreen` before launching (useful
in CI/cloud sandboxes with no display). On Linux this also needs
`libegl1 libgl1 libxkbcommon0 libfontconfig1 libdbus-1-3` installed for Qt's
offscreen platform plugin to load.

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

## Local PC camera testing (Windows)

`--mode real` (or `auto`, which falls back to test images if no camera is
found) talks to a physical USB camera and only works on a machine that
actually has one attached — it cannot be exercised in a cloud sandbox.

```powershell
cd vision
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# find which device indices respond before picking one
python main.py --probe-cameras

python main.py --mode real --device-index 0
python ui_main.py --mode real --device-index 0
```

`--probe-cameras` tries indices 0, 1, and 2 and prints which ones opened
and returned a frame, then exits — use it instead of guessing an index.
In the desktop UI, the same check is available from **Settings → Detect
Cameras**.

On Windows, `RealCamera` opens the camera with the DirectShow backend
(`cv2.CAP_DSHOW`) instead of OpenCV's default MSMF backend, since MSMF is
known to hang or misreport `isOpened()` for many USB webcams. After
opening, it also does a few warm-up reads before declaring the camera
ready, since some webcams report "opened" before they can actually
deliver frames.

If `--mode real` still fails, the error message lists what to check
(camera plugged in, not in use by another app, wrong device index, Windows
camera privacy permission). Things to try in order:

1. `python main.py --probe-cameras` to see which indices respond at all.
2. Close any other app that might be holding the camera (Zoom, Teams,
   Skype, browser tabs with camera permission, a previous run of this app).
3. Try device index 0, then 1, then 2 — a laptop's built-in webcam and a
   plugged-in USB camera often land on different indices.
4. Check Windows Settings → Privacy & security → Camera → "Let desktop
   apps access your camera" is on.

`--mode test` and `--mode auto` (with no camera attached) are unaffected
by any of this and keep working the same in the cloud sandbox used to
develop this app.

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

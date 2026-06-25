# VISION SYSTEM - QC (camera capture + GOOD/BAD comparison)

A standalone Windows PC desktop application (this `vision/` folder lives
inside the `plc-autoprogrammer` repo but is otherwise independent of it):
it captures frames from either a real USB/web camera (local PC) or a
bundled/synthetic test image (cloud, no camera attached), saves a GOOD
reference and an inspection image per product/angle, and compares them with
OpenCV to produce a GOOD/BAD result. The Windows PC is the brain of the
system: it controls the camera, holds the GOOD-reference and product
database, runs every inspection decision, and keeps the CSV/SQLite reports
and bad-product archive — all on the PC, with no PLC logic, ladder logic,
or PLC-side database involved. No AI, OCR, object detection, or FastAPI
yet either.

A PLC or other machine controller may eventually exchange simple
production signals with the PC over a cable (e.g. Ethernet, serial,
USB-to-I/O, Modbus TCP/RTU) — for example the PLC sends a "take picture
now" trigger and the PC sends back a GOOD/BAD result — but the PLC stays a
signal peer, not the controller of the vision logic. That communication
layer does not exist yet; when added, it will live in its own module
(planned: `vision/io/` or `vision/plc_interface/`), start with a simulated
signal source, and the UI will label it a "Machine Signal Interface" (or
"PLC / I-O Signal Interface") rather than implying it runs the system.

Two front ends drive the same engine in `core/`: a text menu (`main.py`)
and a desktop UI (`ui_main.py`).

## Windows release build (recommended — no Python required)

For end users on a Windows PC, the recommended way to run VISION SYSTEM -
QC is the packaged `.exe`, built automatically by GitHub Actions on every
push to `main` (and on demand) — no Python, pip, venv, or terminal
commands needed.

1. Open this repository on GitHub and go to the **Actions** tab.
2. Click the **Build VISION SYSTEM - QC (Windows)** workflow in the list
   on the left.
3. Click the most recent (top) run — it should show a green checkmark.
4. Scroll down to the **Artifacts** section at the bottom of that run's
   page and click **VISION_SYSTEM_QC_WINDOWS** to download the ZIP.
5. Unzip it anywhere on the PC.
6. Double-click `VISION_SYSTEM_QC.exe`, then click **Start Camera** in the
   app window.

If you want to trigger a fresh build yourself (for example, right after a
code change), open the **Actions** tab → **Build VISION SYSTEM - QC
(Windows)** → **Run workflow**.

The unzipped folder also contains `README_FOR_WINDOWS_USER.txt` (the same
quick-start plus troubleshooting, written for the end user) and three
optional helper files — `RUN_TEST_MODE.bat`, `RUN_REAL_CAMERA.bat`,
`PROBE_CAMERAS.bat` — that just launch the `.exe` with different
arguments; double-clicking the `.exe` directly is enough for normal use.

See `vision_qc.spec` for the PyInstaller build definition and
`.github/workflows/build-vision-windows.yml` for the build pipeline
(install deps → headless UI smoke test in test-image mode → `pyinstaller
vision_qc.spec` → assemble the release folder → zip → upload as a
workflow artifact). `core/config.py` resolves all data paths relative to
the running `.exe`'s own folder when frozen, so the unzipped release
folder is fully self-contained.

Everything below this section (`.bat` launchers run from source, manual
PowerShell setup) is the **developer fallback** for working on the code
itself, not the path end users need.

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

## Local PC camera testing (Windows, from source — developer fallback)

This section covers running the app from a Python source checkout instead
of the packaged `.exe` above — useful for development, or if you'd rather
manage Python yourself. `--mode real` (or `auto`, which falls back to test
images if no camera is found) talks to a physical USB camera and only
works on a machine that actually has one attached — it cannot be
exercised in a cloud sandbox.

### Windows double-click setup (recommended, no typing required)

If you just want to run the app on a Windows PC with a real USB camera,
you do not need to open a terminal or type any commands. In the `vision`
folder:

1. Double-click **`SETUP_AND_RUN_WINDOWS.bat`**.

That's it. It checks for Python, creates a `.venv` folder the first time
it runs, installs everything in `requirements.txt`, checks camera indexes
0/1/2 (saving the result to `camera_probe.txt`), and then opens the
VISION SYSTEM — QC window. A console window stays open behind it with log
messages and any error explanations; close it after closing the app.

Other launchers for the same `vision` folder, also double-click only:

| File                          | What it does                                                        |
|--------------------------------|----------------------------------------------------------------------|
| `INSTALL_REQUIREMENTS.bat`    | Creates `.venv` and installs requirements only, no app launch.       |
| `PROBE_CAMERAS.bat`           | Checks indexes 0/1/2 and writes the result to `camera_probe.txt`.    |
| `RUN_TEST_MODE.bat`           | Runs the desktop UI in test-image mode (no camera needed).           |
| `RUN_REAL_CAMERA.bat`         | Runs the desktop UI with a real camera at device index 0.            |

If your USB camera is not at index 0, run `PROBE_CAMERAS.bat` first to see
which index says `AVAILABLE`, then right-click `RUN_REAL_CAMERA.bat` →
**Edit**, change the `set DEVICE_INDEX=0` line near the top to that
number, save, and double-click it again.

Every launcher prints a plain-English error and waits for a key press if
something goes wrong (Python missing, dependency install failed, camera
not found), so the window won't just flash and disappear.

### Manual setup (PowerShell, advanced)

The double-click `.bat` files above do exactly this under the hood; use
this manual form if you'd rather run the commands yourself or are
scripting something around the app.

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
- `camera_probe.txt` — generated by `--probe-cameras` / `PROBE_CAMERAS.bat`
  / `SETUP_AND_RUN_WINDOWS.bat`; not checked in.

`opencv-python-headless` is used by default since it has no GUI
dependencies and works in headless cloud environments; the live preview
falls back to writing frames to `data/captures/_live_preview.png` when no
display is available. For an on-screen preview window during local PC
testing, swap it for `opencv-python` in `requirements.txt`.

## Packaging (Windows release build)

- `vision_qc.spec` — PyInstaller build definition (onedir build, entry
  point `ui_main.py`, name `VISION_SYSTEM_QC`, bundles `data/test_images`).
  Build locally on Windows with `pyinstaller vision_qc.spec --noconfirm
  --clean`; output goes to `dist/VISION_SYSTEM_QC/`.
- `tools/smoke_test_ui.py` — headless regression check (test-image mode,
  `QT_QPA_PLATFORM=offscreen`) that drives `MainWindow` through start
  camera → select product/angle → save reference → take inspection →
  compare → save result → stop camera, with no display needed. Run before
  packaging; also run by CI.
- `packaging/` — assets that ship inside the release ZIP next to the
  `.exe`, not used when running from source: `README_FOR_WINDOWS_USER.txt`
  (end-user quick start) and `RUN_TEST_MODE.bat` / `RUN_REAL_CAMERA.bat` /
  `PROBE_CAMERAS.bat` (thin wrappers that call `VISION_SYSTEM_QC.exe` with
  different arguments — optional, since double-clicking the `.exe`
  directly already works).
- `.github/workflows/build-vision-windows.yml` — builds the above on a
  `windows-latest` GitHub Actions runner and uploads
  `VISION_SYSTEM_QC_WINDOWS.zip` as a workflow artifact (see the "Windows
  release build" section near the top of this README for how to download
  it).
- `core/config.py`'s `VISION_ROOT` is frozen-aware: under PyInstaller
  (`sys.frozen`) it resolves to the folder containing `sys.executable`
  (the `.exe`'s own folder), otherwise it resolves the usual way from
  `__file__`. This is what makes the unzipped release folder
  self-contained — `data/` is created and read next to the `.exe`.

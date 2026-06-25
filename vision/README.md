# VISION SYSTEM - QC (camera capture + GOOD/BAD comparison)

A standalone Windows PC desktop application (this `vision/` folder lives
inside the `plc-autoprogrammer` repo but is otherwise independent of it):
it captures frames from either a real USB camera (local PC) or a
bundled/synthetic test image (cloud, no camera attached), saves one or
more GOOD reference images per product/angle, and compares an inspection
image against the primary reference with OpenCV to produce a GOOD/BAD
result. **The Windows PC is the brain of the system**: it owns the camera,
holds the product/reference-image database, runs every inspection
decision, archives bad products, and produces reports — all on the PC,
with no PLC logic, ladder logic, or PLC-side database involved. No AI,
OCR, object detection, barcode/QR, or robotic arm control either — see
`TODO_NEXT_STEPS.md` for what's deliberately deferred.

A PLC or other machine controller may, in a future phase, exchange simple
signals with the PC — a "take picture now" trigger in, and a GOOD/BAD
result out. **The camera and that PLC link are two separate, unrelated
connections**: the camera talks to the PC over USB purely as an image
source, and never routes through the PLC link. That future link is
modeled today as a `vision/machine_interface/` package (simulated only —
see below); when a real transport is added it slots in behind the same
interface without the PC giving up control of the camera, the database,
or the GOOD/BAD decision.

Two front ends drive the same engine in `core/`: a text menu (`main.py`)
and a desktop UI (`ui_main.py`). See `SPECIFICATION.md` for the full V1
design (workflow, screens, database schema, folder layout) and
`TODO_NEXT_STEPS.md` for what's intentionally not built yet.

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
6. Double-click `VISION_SYSTEM_QC.exe`, open the **Camera Setup** tab to
   set up the camera, then go to **Inspection** and click **Start Camera**.

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

A single window with six tabs across the top, all sharing one `QCApp`
engine (`core/app.py`) and SQLite database (`database/vision.db`) — no
tab keeps its own copy of the data:

- **Inspection** (`ui/screens/inspection_screen.py`) — the main screen:
  live camera/test feed, GOOD reference / inspection / diff previews, the
  GOOD/BAD result badge with similarity score, product/angle controls,
  Machine Signal Interface communication/trigger status, and the
  "Simulate PLC Trigger" button. When `inspection_mode` is "free_pose"
  (V2), it also shows a "Normalized (Aligned)" preview panel, a "Best
  Match" status row naming the matched reference's angle, a feature/
  shape/pixel/edge score breakdown line under the result badge, a
  "Product Detection" FOUND/NOT FOUND status, the GOOD/BAD/NO
  PRODUCT/SKIPPED/ERROR counters panel, and an "Auto Match Reference"
  sidebar button (`QCApp.auto_match_reference()`) that runs the same V2
  search as Compare but is exposed under its own name for clarity; these
  V2 widgets stay blank/dashed and inert in V1's default "fixed" mode.
  Buttons map directly onto the `QCApp` engine — the UI adds no new
  comparison or capture logic.
- **Camera Setup** (`ui/screens/camera_setup_screen.py`) — live preview,
  camera device index ("Detect Cameras" probes indices 0/1/2), resolution
  (with the 1920×1080 → 1280×720 → 640×480 fallback list), FPS, and
  exposure/brightness sliders when the connected UVC camera exposes them.
  Includes on-screen instructions to lock the camera's physical position
  and the lens's zoom/focus/aperture rings after framing the shot, and to
  keep lighting stable — V1 has no automatic re-alignment, so a moved
  camera or relit scene invalidates existing GOOD references.
- **Products** (`ui/screens/products_screen.py`) — add/edit/delete
  products (name, part number, description, customer, notes) and manage
  each product's angles.
- **References** (`ui/screens/references_screen.py`) — for the selected
  product/angle: list/add/delete GOOD reference images and mark one
  primary. V1 always compares against the primary reference.
- **Reports** (`ui/screens/reports_screen.py`) — full inspection history,
  filterable by product/result, exportable to CSV (always available) or
  Excel (when `openpyxl` is installed).
- **Settings** (`ui/screens/settings_screen.py`) — camera mode
  (test/real/auto), match threshold, snapshot/bad-product save toggles,
  the Machine Signal Interface's simulation-mode toggle and reserved
  communication-type placeholder, plus two V2-only cards: **Inspection
  Engine (V2)** (inspection mode, matching/alignment method, minimum
  product detection confidence, minimum feature matches, save normalized
  image) and **No Product Handling (V2)** (the No Product Action choice,
  save-no-product-images, log-skipped-inspections — see below). Camera
  index/resolution/FPS/exposure live on the Camera Setup tab instead, next
  to the live preview they affect.

Runs headless too: set `QT_QPA_PLATFORM=offscreen` before launching (useful
in CI/cloud sandboxes with no display). On Linux this also needs
`libegl1 libgl1 libxkbcommon0 libfontconfig1 libdbus-1-3` installed for Qt's
offscreen platform plugin to load.

## Camera hardware

The V1 prototype camera is an **SVPRO USB UVC camera**: 1080p, 60fps, with
a 2.8–12mm manual zoom CS-mount lens (manual focus, manual aperture — all
adjusted by hand on the lens barrel, never by software). It's a plain USB
Video Class (UVC) webcam, not a vendor-SDK "smart" camera, so:

- `core/camera/real_camera.py` opens it with OpenCV's `cv2.VideoCapture`,
  using the DirectShow backend (`cv2.CAP_DSHOW`) on Windows (more
  reliable open/read behavior than the default MSMF backend for many USB
  webcams) and OpenCV's default backend elsewhere.
- No vendor SDK is required or used.
- Device index, resolution, and FPS are software-selectable from the
  Camera Setup tab (or `core/config.py` defaults: 1920×1080 @ 60fps,
  device index 0).
- If the requested resolution can't be opened reliably, `RealCamera`
  automatically falls back through `config.RESOLUTION_FALLBACKS`
  (1920×1080 → 1280×720 → 640×480) until one opens and delivers frames.

This same code path works with any other plain UVC USB camera, not just
the SVPRO unit — there's nothing SVPRO-specific in `RealCamera`.

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
In the desktop UI, the same check is available from **Camera Setup →
Detect Cameras**.

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
GOOD if the score meets the configured match threshold (95% by default,
`core/config.py`'s `DEFAULT_MATCH_THRESHOLD_PERCENT`, editable on the
Settings tab), otherwise BAD. A diff visualization (colormap of the pixel
difference) is saved alongside. No alignment beyond resizing, no AI — see
`TODO_NEXT_STEPS.md`.

Every comparison is logged as a row in the `inspections` table of the
SQLite database `database/vision.db` (`core/db.py`). On a BAD result (and
if "save bad products" is enabled in Settings), the inspection image and
diff image are additionally copied into
`data/bad_products/<product>/<angle>/` for traceability. `core/reports.py`
exports the same `inspections` table to CSV (always) or Excel (when
`openpyxl` is installed) — it's a read-only view, never a second source
of truth.

## V2: Free Position / Continuous Rotation engine (`core/compare_v2.py`)

V1's pipeline above is **untouched and remains the default**
(`inspection_mode = "fixed"`, set on the Settings tab's "Inspection Engine
(V2)" card). V2 is a purely additive, opt-in inspection mode
(`inspection_mode = "free_pose"`) for products that aren't placed in a
fixed spot/orientation under the camera: the part can appear anywhere in
the frame, rotated by any continuous angle (0–359.99°, never snapped to a
fixed step like V1's named angles), and slightly scaled, all from the same
fixed camera viewpoint (no 3D tilt).

Run per inspection when `inspection_mode` is "free_pose":

1. **Locate** — find the product anywhere in the inspection frame using
   ORB or AKAZE feature matching against every saved reference for the
   product (not just one angle's primary reference, unlike V1), falling
   back to a contour/`minAreaRect` estimate if feature matching can't find
   enough inliers. The `alignment_method` setting picks ORB / AKAZE /
   contour / hybrid (ORB → AKAZE → contour fallback chain).
2. **Recover pose** — center, continuous rotation angle, and scale of the
   located product, plus a 0–100 recognition/localization confidence score.
3. **Decide product_detected** — if confidence is below "Minimum product
   detection confidence" or too few feature-match inliers ("Minimum
   feature matches"), the engine reports `NO_PRODUCT_FOUND` and stops —
   see "No Product Found / Skip Logic" below. It never resolves this to
   BAD itself; that decision belongs entirely to `core/app.py`'s
   `no_product_action` setting.
4. **Align** — warp the located product back into the best-matching
   reference's own canonical frame (`config.CANONICAL_SIZE`, 480×480) so
   scores are comparable across references regardless of original image
   resolution.
5. **Score** — compare the aligned/normalized image against the reference
   using the `matching_method` setting: `pixel` (grayscale diff, like
   V1), `feature` (keypoint-match ratio), or `hybrid` (an explainable
   weighted average of feature/shape/pixel/edge sub-scores — no black-box
   model).
6. **Decide GOOD/BAD** against the same match-threshold setting V1 uses.

V2 searches every saved reference image for the whole product (across all
angles), not just the currently selected angle — appropriate for a part
that can present any side to the camera. The matched reference's angle is
recorded on the inspection row (`best_angle_id`/`best_angle_name`).

## No Product Found / Skip logic (V2 only)

**No product is not the same as BAD product.** BAD means a product was
located and failed inspection. **NO PRODUCT FOUND** means the system could
not reliably locate any product in the frame at all — an early trigger, an
empty conveyor gap, or a manual trigger fired with nothing in front of the
camera. **SKIPPED** means the system intentionally excluded that
inspection cycle from the GOOD/BAD/NO PRODUCT counts. **ERROR** covers a
cycle that failed for reasons unrelated to product quality. V1 has no
localization step and therefore no concept of "no product found" — this
logic only applies when `inspection_mode` is "free_pose".

Result states (`core/config.py` `RESULT_*`): `GOOD`, `BAD`,
`NO_PRODUCT_FOUND`, `SKIPPED`, `ERROR`.

When V2 reports `NO_PRODUCT_FOUND`, `core/app.py` applies the **No Product
Action** setting (Settings tab → "No Product Handling (V2)" card):

- **Skip and do not count** (default) — nothing is saved to the database
  and none of GOOD/BAD/NO PRODUCT/SKIPPED is incremented, *unless* "Log
  skipped inspections" is on, in which case a `SKIPPED` row is written
  (and the SKIPPED counter increments) purely for audit purposes. The UI
  shows "SKIPPED — NO PRODUCT FOUND". The machine output sends neither
  GOOD nor BAD.
- **Count as NO PRODUCT** — a `NO_PRODUCT_FOUND` row is saved and the NO
  PRODUCT counter increments. The inspection image is only archived under
  `data/no_product/` if "Save no-product images" is on; nothing is
  written to `bad_products/`.
- **Treat as BAD** — a `BAD` row is saved and the BAD counter increments.
  The image is archived under `bad_products/` (if "Save bad products" is
  on), and the result clearly reads "BAD — NO PRODUCT FOUND" so it's never
  confused with a genuine quality failure in the history/reports.
- **Ask operator** — nothing is saved yet; the engine raises
  `NoProductDecisionRequired` and the Inspection screen shows "No product
  found. Skip this inspection or count as BAD?" with Skip / Count as BAD /
  Save as NO PRODUCT buttons. Whichever the operator picks is applied via
  `engine.save_no_product_decision()`, using the same three behaviors
  above.

The Inspection tab shows a live **Product Detection: FOUND / NOT FOUND**
status and a compact counters panel: TOTAL, GOOD, BAD, NO PRODUCT,
SKIPPED, ERROR (`core/db.py`'s `count_inspections()`).

## Data layout

```
vision/
  data/
    test_images/                                  bundled sample frames
    captures/                                      live-preview snapshots
    products/<product_slug>/<angle_slug>/
      reference/                                   timestamped GOOD references
      inspection/                                   timestamped inspection images
    bad_products/<product_slug>/<angle_slug>/       archived BAD inspection + diff
    difference_images/<product_slug>/<angle_slug>/  diff images from every comparison
    no_product/                                     V2: NO_PRODUCT_FOUND images (flat,
                                                     not per-product/angle - a product may
                                                     not even be identified yet), only when
                                                     "Save no-product images" is on
    reports/                                        CSV/Excel exports
  database/
    vision.db                                       SQLite database (products, angles,
                                                      reference_images, inspections, settings)
  logs/                                              reserved for future log files
```

See `SPECIFICATION.md` for the full SQLite schema.

`opencv-python-headless` is used by default since it has no GUI
dependencies and works in headless cloud environments; the live preview
falls back to writing frames to `data/captures/_live_preview.png` when no
display is available. For an on-screen preview window during local PC
testing, swap it for `opencv-python` in `requirements.txt`.

## Machine Signal Interface

`vision/machine_interface/` models a future PC↔PLC link without
committing to a transport. `base.py` defines the abstract interface
(`connect`/`disconnect`/`read_trigger`/`send_good`/`send_bad`/
`reset_outputs`/`get_status`); `simulator.py`'s `SimulatedMachineInterface`
is the only implementation in V1 — `read_trigger()` is edge-triggered, so
a UI button (the Inspection tab's "Simulate PLC Trigger") calls
`fire_trigger()` to arm it and the next `read_trigger()` call consumes it,
mimicking a momentary PLC pulse. See `TODO_NEXT_STEPS.md` for what a real
backend would need.

## Packaging (Windows release build)

- `vision_qc.spec` — PyInstaller build definition (onedir build, entry
  point `ui_main.py`, name `VISION_SYSTEM_QC`, bundles `data/test_images`).
  Build locally on Windows with `pyinstaller vision_qc.spec --noconfirm
  --clean`; output goes to `dist/VISION_SYSTEM_QC/`.
- `tools/smoke_test_ui.py` — headless regression check (test-image mode,
  `QT_QPA_PLATFORM=offscreen`) that drives `MainWindow`'s screens through
  start camera → select/create product+angle → save reference → take
  inspection → compare → save result → simulated PLC trigger → CSV export
  → stop camera, with no display needed. Run before packaging; also run
  by CI.
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
  self-contained — `data/` and `database/` are created and read next to
  the `.exe`.

# VISION SYSTEM - QC — V1 Specification

## What this is

A standalone Windows PC desktop application for industrial-style visual
quality control. **The PC is the brain of the system.** It owns the
camera, the product/reference image database, every inspection decision,
the bad-product archive, and all reports. There is no PLC logic, no
ladder logic, and no PLC-side database anywhere in this application.

A PLC or other machine controller may, **in a future phase**, exchange
simple signals with the PC over a cable — for example a "take picture
now" trigger in, and a GOOD/BAD result out. That link is modeled today as
a **Machine Signal Interface** running in simulation only (see below). No
physical protocol (Modbus, serial, Ethernet I/O, USB relay, etc.) is
implemented yet, and the interface is deliberately not locked to any one
of them.

**The camera and the PLC link are two separate, unrelated connections.**
The camera connects to the PC over USB and is purely an image source for
the PC — it has nothing to do with PLC communication and is never routed
through the Machine Signal Interface. The PLC/machine controller, when
connected in a future phase, only ever sends a trigger pulse in and
receives a GOOD/BAD result out; it does not see camera frames, does not
configure the camera, and is not involved in image comparison. The PC is
the brain end-to-end: it owns the camera, captures and compares images,
makes the GOOD/BAD decision, stores the database, archives bad products,
and produces reports, regardless of whether a PLC is connected.

## Camera hardware (V1 prototype)

The prototype camera is an **SVPRO USB UVC camera**: 1080p, 60 fps, with
a 2.8–12mm manual zoom CS-mount lens (manual focus, manual aperture). It
is a plain USB Video Class (UVC) webcam, not a "smart"/vendor-SDK camera,
so it is accessed the same way any USB webcam is:

- `core/camera/real_camera.py` opens it with OpenCV's `cv2.VideoCapture`,
  using the DirectShow backend (`cv2.CAP_DSHOW`) on Windows for more
  reliable open/read behavior, and OpenCV's default backend elsewhere.
- No vendor SDK is required or used.
- Zoom, focus, and aperture are adjusted **by hand** on the lens barrel —
  the software never drives them.
- Device index, resolution, and FPS are all software-selectable
  (`core/config.py`: `DEFAULT_DEVICE_INDEX`, `DEFAULT_FRAME_WIDTH` /
  `DEFAULT_FRAME_HEIGHT` = 1920×1080, `DEFAULT_FRAME_FPS` = 60).
- If the requested resolution can't be opened reliably (camera limits,
  USB bandwidth, PC capability), `RealCamera` automatically falls back
  through `config.RESOLUTION_FALLBACKS` (1920×1080 → 1280×720 → 640×480)
  until one opens and delivers frames.
- Camera mode stays Test / Real / Auto as before; "Auto" probes for the
  real camera and falls back to the bundled test images when none is
  found, so the app always runs without hardware attached.

Out of scope for V1 (explicitly): AI, OCR, object detection, barcode/QR
reading, robotic arm control, real PLC/I-O communication, ladder logic.
See `TODO_NEXT_STEPS.md` for where these go later.

## Main workflow

1. User opens the Windows PC app.
2. User selects or creates a **product**.
3. User selects or creates an **angle** for that product (Front, Back,
   Left, Right, Top, Bottom, or a custom name).
4. User saves one or more **GOOD reference images** for that product/angle.
   One reference is marked **primary**; V1 always compares against the
   primary reference.
5. An inspection is triggered — manually from the UI in V1, later from the
   Machine Signal Interface.
6. The system captures an inspection image (real camera or test-image
   mode).
7. The system compares the inspection image against the primary GOOD
   reference.
8. The system calculates a similarity score.
9. The system decides GOOD or BAD against the configured threshold.
10. The system saves the inspection image, result, score, date/time,
    product, angle, and notes to the database.
11. If BAD, the inspection image and the diff image are additionally
    archived under the bad-product folder.
12. The inspection history table and CSV/Excel reports reflect the new row.
13. Later: the GOOD/BAD result is sent back out through the Machine Signal
    Interface.

## Screens

A single window, tabs across the top, Tesla-style black/white theme
(`ui/styles.py`). Each tab is one screen, backed by the same `QCApp`
engine (`core/app.py`) and SQLite database — no screen has its own copy
of the data.

### 1. Inspection (`ui/screens/inspection_screen.py`)

Live camera/test feed, GOOD reference preview, inspection image preview,
diff image preview, a large GOOD/BAD result badge with the similarity
score, product/angle selectors, camera mode/index, threshold, last
inspection time, **Communication status** (Simulation / Connected /
Error) and **Trigger status** (Waiting / Trigger Received / Inspecting /
Complete) from the Machine Signal Interface, and the full button row:
Start Camera, Stop Camera, Add Product, Select Product, Add Angle, Save
GOOD Reference, Take Inspection Picture, Compare, Save Result, Open Bad
Products Folder, Export Report, Settings (Settings opens the Settings
tab).

### 2. Camera Setup / Calibration (`ui/screens/camera_setup_screen.py`)

Live preview plus everything needed to set the camera up once and then
leave it alone: camera index, resolution choice (with the
1920×1080 → 1280×720 → 640×480 fallback list), FPS, and exposure/
brightness controls when the connected UVC device exposes them through
OpenCV (`cv2.CAP_PROP_EXPOSURE` / `cv2.CAP_PROP_BRIGHTNESS`; controls are
hidden or disabled if the camera doesn't support them — no assumption
that every UVC camera does). On-screen instructions remind the operator
to lock the camera's physical position, lock the lens zoom/focus/
aperture rings after framing the shot, and keep lighting stable —
because V1's comparison pipeline has no alignment/ROI correction (see
`TODO_NEXT_STEPS.md`), a moved camera or relit scene invalidates existing
GOOD references.

### 3. Products (`ui/screens/products_screen.py`)

Add/edit/delete (delete only with a confirmation dialog) products: name,
part number, description, customer/project, notes. Lists each product's
angles and how many reference images each angle has.

### 4. References (`ui/screens/references_screen.py`)

For the selected product/angle: list saved GOOD reference images, add a
new one (captures from the current camera/test frame), delete a bad one,
mark one as primary. V1 compares against the primary reference only;
keeping the rest around is preparation for multi-reference comparison
later.

### 5. Reports (`ui/screens/reports_screen.py`)

Full inspection history table: date/time, product, angle, result, score,
inspection image path, bad image path, diff image path, notes. Filter by
product, result, and date range. Export CSV (always available) and
Export Excel (when `openpyxl` is installed). Open image folder shortcut.

### 6. Settings (`ui/screens/settings_screen.py`)

Camera mode (test/real/auto), similarity threshold, "save all snapshots"
on/off, "save bad products" on/off, report folder, database location
(display only in V1 — see `TODO_NEXT_STEPS.md`), PLC/IO simulation mode
on/off, and a future communication type placeholder (None / Simulation /
Modbus TCP / Serial / USB relay / Ethernet I/O). No backend other than
Simulation is implemented; the rest are reserved choices so Settings
doesn't need to change shape later. Camera index/resolution/FPS/exposure
live on the Camera Setup / Calibration screen instead, next to the live
preview they affect.

## Machine Signal Interface

`vision/machine_interface/` (not `vision/io/` — that name would shadow
Python's own standard-library `io` module for the whole process once
inserted on `sys.path`, which is exactly the kind of subtle bug worth
avoiding). Models the future PC↔PLC link without committing to a
transport:

- `base.py` — abstract `MachineSignalInterface`: `connect()`,
  `disconnect()`, `read_trigger()`, `send_good()`, `send_bad()`,
  `reset_outputs()`, `get_status()`.
- `simulator.py` — `SimulatedMachineInterface`, the only implementation in
  V1. `read_trigger()` is edge-triggered: a UI button (or future real
  input) calls `fire_trigger()` to arm it, and the next `read_trigger()`
  call consumes it and returns to OFF, mimicking a momentary PLC pulse.
  Status is always `"Simulation"` once connected.
- Future backends (`modbus_tcp.py`, `serial_io.py`, `usb_relay.py`, ...)
  implement the same `base.py` interface and slot in without touching
  `core/app.py` — the engine only ever talks to the abstract interface.

## Image comparison (`core/compare.py`)

Unchanged pipeline, kept deliberately simple and swappable:

1. Load the primary GOOD reference image and the inspection image.
2. Resize the inspection image to the reference's size if they differ.
3. Convert both to grayscale.
4. Compute the per-pixel absolute difference.
5. Similarity score = `100 - mean(absolute difference) / 255 * 100`.
6. GOOD if the score meets the threshold, else BAD.
7. Save a diff visualization (JET colormap of the difference).

No alignment, ROI, or AI — see `TODO_NEXT_STEPS.md` for where those plug
in (`compare_images()` is the single seam to extend).

## Folders

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
    reports/                                        CSV/Excel exports
  database/
    vision.db                                       SQLite database (see schema below)
  logs/                                              reserved for future log files
```

## Database schema (SQLite, `vision/database/vision.db`)

```sql
products(id, name, part_number, description, customer, notes, created_at)
angles(id, product_id, angle_name, notes)
reference_images(id, product_id, angle_id, image_path, is_primary, created_at, notes)
inspections(
    id, product_id, angle_id, reference_image_id,
    inspection_image_path, difference_image_path, bad_image_path,
    result, score, threshold, camera_mode, camera_index, trigger_source,
    created_at, notes
)
settings(key, value)
```

`core/db.py` owns this schema and every query; no other module talks to
SQLite directly.

## Reports

Every inspection is written to `inspections` as it happens. CSV export
(`core/reports.py`) reads straight from the database (with whatever
filters the Reports screen has applied) — it is a view, not a second
source of truth. Excel export uses the same query, written with
`openpyxl` when available.

## Windows packaging

Unchanged from the existing packaging work: `vision_qc.spec`
(PyInstaller, onedir), `.github/workflows/build-vision-windows.yml`
(builds on `windows-latest`, runs the headless smoke test, uploads
`VISION_SYSTEM_QC_WINDOWS.zip`), `packaging/README_FOR_WINDOWS_USER.txt`
plus the optional exe-targeted `.bat` helpers. The end-user workflow stays
download ZIP → unzip → double-click `VISION_SYSTEM_QC.exe` → click Start
Camera, no PowerShell required. Packaging is not allowed to block engine
or UI work in this phase — see `TODO_NEXT_STEPS.md` for what's still
worth doing there (real-camera hardware testing in particular).

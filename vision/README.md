# Vision (QC camera capture)

First version of the vision subsystem for PLC Autoprogrammer: a standalone
Python app that captures frames from either a real USB camera (local PC) or
a bundled/synthetic test image (cloud, no camera attached), and saves
snapshots/reference/inspection images. No image analysis yet — GOOD/BAD
comparison against the reference image comes in a later version.

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

Menu options: live preview, capture snapshot, save current frame as GOOD
reference, prepare an inspection image, exit.

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

## Data layout

- `data/test_images/` — bundled sample frames for test mode (checked in).
- `data/captures/` — manual snapshots.
- `data/reference/` — the saved GOOD reference image.
- `data/inspection/` — the latest prepared inspection image.

`opencv-python-headless` is used by default since it has no GUI
dependencies and works in headless cloud environments; the live preview
falls back to writing frames to `data/captures/_live_preview.png` when no
display is available. For an on-screen preview window during local PC
testing, swap it for `opencv-python` in `requirements.txt`.

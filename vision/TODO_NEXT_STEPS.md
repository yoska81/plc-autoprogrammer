# VISION SYSTEM - QC — Next Steps (post-V1)

V1 is the PC-only capture/compare/log loop described in `SPECIFICATION.md`.
This file tracks what's deliberately deferred, in roughly the order it
would make sense to tackle it. None of this blocks V1 shipping.

## Real Machine Signal Interface backend

`vision/machine_interface/` currently has only `SimulatedMachineInterface`.
Adding a real backend (e.g. `modbus_tcp.py`, `serial_io.py`, `usb_relay.py`,
`ethernet_io.py`) means:

- Implement `base.MachineSignalInterface`'s five methods
  (`connect`/`disconnect`/`read_trigger`/`send_good`/`send_bad`/
  `reset_outputs`/`get_status`) against the real transport.
- Wire the choice into `core/app.py` (`QCApp.machine` construction) keyed
  off `communication_type` instead of always building
  `SimulatedMachineInterface`.
- The Settings screen's "Communication type" combo already has the
  reserved choices (`COMMUNICATION_TYPE_CHOICES` in `core/config.py`) so
  it shouldn't need UI changes, just a real backend behind the existing
  choice.
- Camera frames never travel through this interface — keep that
  separation when wiring a real backend in.

## Comparison alignment / ROI

`core/compare.py` only resizes + grayscale-diffs; there's no correction
for a camera that's shifted, rotated, or re-lit since the GOOD reference
was captured. Candidates, roughly in order of effort:
- Per-angle region-of-interest (ignore background/fixture, only score the
  part itself).
- Simple template-matching-based translation correction before diffing.
- Lighting normalization (histogram equalization) before the grayscale
  diff, so V1's "keep lighting stable" instruction becomes a soft
  recommendation instead of a hard requirement.

This is explicitly out of scope for V1 — the Camera Setup screen's
lock-position/lock-lens/stable-lighting instructions are the V1 mitigation.

## Multi-reference comparison

`reference_images` already supports multiple images per angle with one
marked primary; `compute_comparison()` in `core/app.py` only ever compares
against the primary. A future version could compare against all saved
references and take the best score, to tolerate normal part-to-part
variation without widening the threshold.

## Settings: database/report locations

The Settings screen shows the database path and reports folder as
display-only text. Making them configurable means re-pointing
`core/config.py`'s `DATABASE_PATH`/`REPORTS_DIR` at runtime and migrating
or relocating the existing SQLite file — not done in V1 to avoid the
class of bugs around an app that can silently lose track of its own data.

## Logs

`vision/logs/` is created but nothing writes to it yet. `core/app.py`'s
`print()` calls (camera ready, comparison result, inspection saved) go to
stdout/the packaged `.exe`'s console window only. Worth adding a real log
file here once there's enough field usage to want a persistent record
beyond the console and the SQLite history.

## Out of scope (V1, by design — not just "not yet")

AI/ML-based defect detection, OCR, barcode/QR reading, object detection,
robotic arm control. None of these are planned as drop-in additions to
`core/compare.py` — if ever pursued, they'd be a deliberate, separate
design decision, not an extension of the current pixel-diff pipeline.

## Real-hardware validation

Everything above has been built and smoke-tested against `TestImageCamera`
in a no-display sandbox. It has not yet been run against the real SVPRO
USB UVC camera, a Windows PC, or a real PLC — that hardware validation
(camera resolution fallback under real USB bandwidth limits, DirectShow
backend behavior, exposure/brightness property support on the actual
device) is the first thing to do once the hardware is available.

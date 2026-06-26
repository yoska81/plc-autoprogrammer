from pathlib import Path

from .base import CameraSource
from .real_camera import CameraUnavailableError, RealCamera
from .test_camera import TestImageCamera

CAMERA_MODES = ("auto", "real", "test")


def create_camera_source(
    mode: str,
    device_index: int,
    test_image_dir: Path,
    width: int = 1920,
    height: int = 1080,
    fps: int | None = None,
    resolution_fallbacks: tuple[tuple[int, int], ...] = (),
) -> CameraSource:
    """Build a CameraSource for the requested mode.

    "auto" probes for a physical camera and transparently falls back to the
    test-image feed when none is found, so the app always runs in the cloud.
    """
    mode = mode.lower()
    if mode not in CAMERA_MODES:
        raise ValueError(f"Unknown camera mode '{mode}', expected one of {CAMERA_MODES}")

    if mode == "test":
        return TestImageCamera(test_image_dir, width, height)

    def _make_real() -> RealCamera:
        return RealCamera(device_index, width, height, fps, resolution_fallbacks)

    if mode == "real":
        return _make_real()

    # auto: probe the real camera, fall back to test images on failure
    probe = _make_real()
    try:
        probe.open()
        probe.close()
        return _make_real()
    except CameraUnavailableError:
        return TestImageCamera(test_image_dir, width, height)

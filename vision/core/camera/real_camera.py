import sys
import time

import cv2
import numpy as np

from .base import CameraSource

TROUBLESHOOTING = (
    "Could not open camera at index {index}.\n"
    "Things to check:\n"
    "  - Is a USB camera/webcam actually plugged in and powered on?\n"
    "  - Is another app (Zoom, Teams, Skype, another instance of this app) "
    "currently using the camera? Close it and retry.\n"
    "  - Is the device index correct? Laptops with a built-in webcam often "
    "expose it at index 0 and a USB camera at index 1 or 2 - try "
    "--device-index 1 or 2, or run with --probe-cameras to see which "
    "indices respond.\n"
    "  - On Windows, check Settings > Privacy & security > Camera and make "
    "sure desktop apps are allowed to access the camera."
)


class CameraUnavailableError(RuntimeError):
    """Raised when a physical camera cannot be opened or read from."""


def _platform_backend() -> int:
    """DirectShow (CAP_DSHOW) opens and reads more reliably than the default
    MSMF backend for most USB webcams on Windows; other platforms use
    OpenCV's default backend selection."""
    if sys.platform == "win32":
        return cv2.CAP_DSHOW
    return cv2.CAP_ANY


class RealCamera(CameraSource):
    """Reads frames from a physical USB UVC camera via OpenCV.VideoCapture.

    Targets plain UVC USB cameras (e.g. the SVPRO 1080p/60fps prototype
    camera with a manual-zoom CS-mount lens) - no vendor SDK, just the
    standard OpenCV capture API. Zoom/focus/aperture are adjusted by hand
    on the lens and are not controlled by this class."""

    def __init__(self, device_index: int = 0, width: int = 1920, height: int = 1080,
                 fps: int | None = None, resolution_fallbacks: tuple[tuple[int, int], ...] = ()):
        self.device_index = device_index
        self.width = width
        self.height = height
        self.fps = fps
        self.resolution_fallbacks = resolution_fallbacks
        self._cap: cv2.VideoCapture | None = None

    def _try_open_at(self, width: int, height: int) -> cv2.VideoCapture | None:
        cap = cv2.VideoCapture(self.device_index, _platform_backend())
        if width:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        if height:
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        if self.fps:
            cap.set(cv2.CAP_PROP_FPS, self.fps)

        if not cap.isOpened():
            cap.release()
            return None

        # isOpened() can be True even when the device can't actually deliver
        # frames yet (common DirectShow quirk right after opening), so a few
        # warm-up reads are needed to confirm it really works.
        for _ in range(5):
            ok, _frame = cap.read()
            if ok:
                return cap
            time.sleep(0.1)

        cap.release()
        return None

    def open(self) -> None:
        # Try the requested resolution first, then fall back to smaller
        # ones the camera/PC/USB bandwidth is more likely to support.
        attempts = [(self.width, self.height)]
        attempts += [r for r in self.resolution_fallbacks if r not in attempts]

        for width, height in attempts:
            cap = self._try_open_at(width, height)
            if cap is not None:
                self.width, self.height = width, height
                self._cap = cap
                return

        raise CameraUnavailableError(TROUBLESHOOTING.format(index=self.device_index))

    def read_frame(self) -> np.ndarray:
        if self._cap is None:
            raise CameraUnavailableError("Camera is not open. Call open() first.")
        ok, frame = self._cap.read()
        if not ok:
            raise CameraUnavailableError("Failed to read a frame from the camera.")
        return frame

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def get_property(self, prop_id: int) -> float | None:
        """Read a cv2.CAP_PROP_* value, or None if the camera isn't open."""
        if self._cap is None:
            return None
        return self._cap.get(prop_id)

    def set_property(self, prop_id: int, value: float) -> bool:
        """Set a cv2.CAP_PROP_* value. Returns whether the device accepted it
        (best-effort - not every UVC camera exposes every property)."""
        if self._cap is None:
            return False
        return bool(self._cap.set(prop_id, value))


def probe_camera_indices(indices: list[int]) -> dict[int, bool]:
    """Try opening each device index in turn and report which ones are usable.
    Used by `--probe-cameras` on the CLI and the "Detect Cameras" button in
    the desktop UI's Settings dialog."""
    results: dict[int, bool] = {}
    for index in indices:
        camera = RealCamera(index)
        try:
            camera.open()
            results[index] = True
        except CameraUnavailableError:
            results[index] = False
        finally:
            camera.close()
    return results

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
    """Reads frames from a physical USB camera via OpenCV. Local-PC use only."""

    def __init__(self, device_index: int = 0, width: int = 1280, height: int = 720):
        self.device_index = device_index
        self.width = width
        self.height = height
        self._cap: cv2.VideoCapture | None = None

    def open(self) -> None:
        cap = cv2.VideoCapture(self.device_index, _platform_backend())
        if self.width:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        if self.height:
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)

        if not cap.isOpened():
            cap.release()
            raise CameraUnavailableError(TROUBLESHOOTING.format(index=self.device_index))

        # isOpened() can be True even when the device can't actually deliver
        # frames yet (common DirectShow quirk right after opening), so a few
        # warm-up reads are needed to confirm it really works.
        warmed_up = False
        for _ in range(5):
            ok, _frame = cap.read()
            if ok:
                warmed_up = True
                break
            time.sleep(0.1)

        if not warmed_up:
            cap.release()
            raise CameraUnavailableError(
                f"Camera at index {self.device_index} opened but never returned a "
                f"frame.\n{TROUBLESHOOTING.format(index=self.device_index)}"
            )

        self._cap = cap

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

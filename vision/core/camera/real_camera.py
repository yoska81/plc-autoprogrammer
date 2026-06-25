import cv2
import numpy as np

from .base import CameraSource


class CameraUnavailableError(RuntimeError):
    """Raised when a physical camera cannot be opened or read from."""


class RealCamera(CameraSource):
    """Reads frames from a physical USB camera via OpenCV. Local-PC use only."""

    def __init__(self, device_index: int = 0, width: int = 1280, height: int = 720):
        self.device_index = device_index
        self.width = width
        self.height = height
        self._cap: cv2.VideoCapture | None = None

    def open(self) -> None:
        cap = cv2.VideoCapture(self.device_index)
        if self.width:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        if self.height:
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        if not cap.isOpened():
            cap.release()
            raise CameraUnavailableError(f"Could not open camera at index {self.device_index}")
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

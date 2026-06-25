import itertools
from pathlib import Path

import cv2
import numpy as np

from .base import CameraSource
from .synthetic import generate_synthetic_frame

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp"}


class TestImageCamera(CameraSource):
    """Cycles through bundled sample images to simulate a live feed.

    Used for cloud testing where no physical camera is attached. Falls back
    to a generated synthetic frame if the image directory is empty.
    """

    def __init__(self, image_dir: Path, width: int = 1280, height: int = 720):
        self.image_dir = Path(image_dir)
        self.width = width
        self.height = height
        self._cycle: itertools.cycle | None = None

    def open(self) -> None:
        paths = sorted(
            p for p in self.image_dir.glob("*") if p.suffix.lower() in IMAGE_EXTENSIONS
        )
        frames = []
        for path in paths:
            frame = cv2.imread(str(path))
            if frame is not None:
                frames.append(cv2.resize(frame, (self.width, self.height)))

        if not frames:
            frames = [generate_synthetic_frame(self.width, self.height)]

        self._cycle = itertools.cycle(frames)

    def read_frame(self) -> np.ndarray:
        if self._cycle is None:
            raise RuntimeError("TestImageCamera is not open. Call open() first.")
        return next(self._cycle).copy()

    def close(self) -> None:
        self._cycle = None

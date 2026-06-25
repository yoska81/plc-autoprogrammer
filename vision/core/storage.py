from datetime import datetime
from pathlib import Path

import cv2
import numpy as np


def save_image(frame: np.ndarray, directory: Path, filename: str | None = None) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    if filename is None:
        filename = f"capture_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.png"
    path = directory / filename
    cv2.imwrite(str(path), frame)
    return path

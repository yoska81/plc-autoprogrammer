from datetime import datetime

import cv2
import numpy as np


def generate_synthetic_frame(
    width: int = 1280,
    height: int = 720,
    label: str = "SYNTHETIC TEST IMAGE",
) -> np.ndarray:
    """Build a placeholder frame so the app has something to read when no
    real camera and no bundled test image is available."""
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    for y in range(height):
        frame[y, :] = (40, 40 + int(160 * y / height), 80)

    cv2.rectangle(frame, (40, 40), (width - 40, height - 40), (0, 200, 0), 3)
    cv2.putText(
        frame, label, (60, height // 2 - 20),
        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA,
    )
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(
        frame, timestamp, (60, height // 2 + 30),
        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA,
    )
    return frame

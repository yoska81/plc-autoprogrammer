import argparse
import os
import sys
import time

import cv2
import numpy as np

from . import config
from .camera.factory import create_camera_source
from .storage import save_image


def _gui_available() -> bool:
    """Headless Linux (cloud) has no DISPLAY/WAYLAND_DISPLAY, and a GUI-enabled
    cv2 build will hard-abort the process (not raise) if a window call is made
    without one, so check env vars before ever touching a cv2 window function.
    opencv-python-headless additionally has no window support at all and
    raises a catchable cv2.error, handled below as a second line of defense.
    """
    if sys.platform.startswith("linux") and not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
        return False
    try:
        cv2.namedWindow("__probe__", cv2.WINDOW_NORMAL)
        cv2.destroyWindow("__probe__")
        return True
    except cv2.error:
        return False


class QCApp:
    def __init__(self, mode: str, device_index: int):
        self.camera = create_camera_source(
            mode, device_index, config.TEST_IMAGES_DIR,
            config.DEFAULT_FRAME_WIDTH, config.DEFAULT_FRAME_HEIGHT,
        )
        self.has_gui = _gui_available()
        self._last_frame: np.ndarray | None = None

    def start(self) -> None:
        self.camera.open()
        print(f"[vision] camera source ready: {type(self.camera).__name__} (gui={'yes' if self.has_gui else 'no'})")

    def stop(self) -> None:
        self.camera.close()

    def live_preview(self, duration_seconds: float = 5.0) -> None:
        print(f"[vision] live preview for {duration_seconds:.0f}s" + (" (press 'q' to stop early)" if self.has_gui else ""))
        start = time.monotonic()
        while time.monotonic() - start < duration_seconds:
            frame = self.camera.read_frame()
            self._last_frame = frame
            if self.has_gui:
                cv2.imshow("Live Preview", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
            else:
                save_image(frame, config.CAPTURES_DIR, "_live_preview.png")
                time.sleep(0.2)
        if self.has_gui:
            cv2.destroyAllWindows()
        else:
            print(f"[vision] no display detected; latest frame written to {config.CAPTURES_DIR / '_live_preview.png'}")
        print("[vision] live preview stopped")

    def capture_snapshot(self):
        frame = self.camera.read_frame()
        self._last_frame = frame
        path = save_image(frame, config.CAPTURES_DIR)
        print(f"[vision] snapshot saved to {path}")
        return path

    def save_good_reference(self):
        frame = self._last_frame if self._last_frame is not None else self.camera.read_frame()
        path = save_image(frame, config.REFERENCE_DIR, "good_reference.png")
        print(f"[vision] GOOD reference saved to {path}")
        return path

    def prepare_inspection_image(self):
        frame = self.camera.read_frame()
        self._last_frame = frame
        path = save_image(frame, config.INSPECTION_DIR, "latest_inspection.png")
        print(f"[vision] inspection image prepared at {path}")
        return path


MENU = """
1) Live preview
2) Capture snapshot
3) Save current frame as GOOD reference
4) Prepare inspection image
5) Exit
"""


def run_menu(app: QCApp) -> None:
    actions = {
        "1": app.live_preview,
        "2": app.capture_snapshot,
        "3": app.save_good_reference,
        "4": app.prepare_inspection_image,
    }
    while True:
        print(MENU)
        choice = input("Select an option: ").strip()
        if choice == "5":
            break
        action = actions.get(choice)
        if action is None:
            print("Invalid option")
            continue
        action()


def main() -> None:
    parser = argparse.ArgumentParser(description="PLC Autoprogrammer - Vision QC capture app")
    parser.add_argument("--mode", choices=["auto", "real", "test"], default=config.DEFAULT_CAMERA_MODE,
                         help="auto (default): use a real camera if present, else fall back to test images")
    parser.add_argument("--device-index", type=int, default=config.DEFAULT_DEVICE_INDEX)
    args = parser.parse_args()

    app = QCApp(mode=args.mode, device_index=args.device_index)
    app.start()
    try:
        run_menu(app)
    finally:
        app.stop()


if __name__ == "__main__":
    main()

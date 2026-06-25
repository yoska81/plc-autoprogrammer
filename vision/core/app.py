import argparse
import os
import shutil
import sys
import time

import cv2
import numpy as np

from . import config
from .camera.factory import create_camera_source
from .compare import ComparisonResult, compare_images
from .product_paths import ProductAngleLocation
from .results_store import record_result
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
        self.location: ProductAngleLocation | None = None
        self.last_result: ComparisonResult | None = None

    def start(self) -> None:
        self.camera.open()
        print(f"[vision] camera source ready: {type(self.camera).__name__} (gui={'yes' if self.has_gui else 'no'})")

    def stop(self) -> None:
        self.camera.close()

    def select_product_angle(self, product: str, angle: str) -> None:
        self.location = ProductAngleLocation(product, angle)
        self.location.ensure_dirs()
        has_reference = self.location.reference_path.exists()
        print(f"[vision] selected product='{product}' angle='{angle}' ({self.location.product_slug}/{self.location.angle_slug})")
        print(f"[vision] GOOD reference {'found' if has_reference else 'not set yet'} at {self.location.reference_path}")

    def _require_location(self) -> ProductAngleLocation:
        if self.location is None:
            raise RuntimeError("No product/angle selected. Choose option 1 first.")
        return self.location

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

    def save_good_reference(self):
        location = self._require_location()
        frame = self.camera.read_frame()
        self._last_frame = frame
        save_image(frame, location.reference_path.parent, location.reference_path.name)
        print(f"[vision] GOOD reference saved to {location.reference_path}")

    def capture_inspection_image(self):
        location = self._require_location()
        frame = self.camera.read_frame()
        self._last_frame = frame
        save_image(frame, location.inspection_path.parent, location.inspection_path.name)
        print(f"[vision] inspection image captured at {location.inspection_path}")

    def run_comparison(self) -> ComparisonResult | None:
        location = self._require_location()
        if not location.reference_path.exists():
            print("[vision] no GOOD reference saved yet for this product/angle.")
            return None
        if not location.inspection_path.exists():
            print("[vision] no inspection image captured yet for this product/angle.")
            return None

        comparison = compare_images(
            location.reference_path, location.inspection_path, location.diff_path,
            threshold_percent=config.DEFAULT_MATCH_THRESHOLD_PERCENT,
        )
        self.last_result = comparison
        print(f"[vision] result={comparison.result} score={comparison.score_percent:.2f}% diff={comparison.diff_image_path}")

        if comparison.result == "BAD":
            stamp = time.strftime("%Y%m%d_%H%M%S")
            shutil.copy2(location.inspection_path, location.bad_products_dir / f"bad_{stamp}.png")
            shutil.copy2(comparison.diff_image_path, location.bad_products_dir / f"diff_{stamp}.png")
            print(f"[vision] BAD product archived under {location.bad_products_dir}")

        record_result(
            config.RESULTS_CSV_PATH, config.RESULTS_DB_PATH,
            location.product, location.angle, comparison,
            location.reference_path, location.inspection_path,
        )
        return comparison

    def show_last_result(self) -> None:
        if self.last_result is None:
            print("[vision] no comparison run yet this session.")
            return
        r = self.last_result
        print(f"[vision] last result: {r.result} ({r.score_percent:.2f}%) diff={r.diff_image_path}")


MENU = """
1) Select product / angle
2) Live preview
3) Save GOOD reference (capture + save)
4) Capture inspection image
5) Run GOOD/BAD comparison
6) Show last result
7) Exit
"""


def run_menu(app: QCApp) -> None:
    while True:
        print(MENU)
        choice = input("Select an option: ").strip()
        if choice == "7":
            break
        try:
            if choice == "1":
                product = input("Product name: ").strip()
                angle = input("Angle name: ").strip()
                if not product or not angle:
                    print("[vision] product and angle cannot be empty")
                    continue
                app.select_product_angle(product, angle)
            elif choice == "2":
                app.live_preview()
            elif choice == "3":
                app.save_good_reference()
            elif choice == "4":
                app.capture_inspection_image()
            elif choice == "5":
                app.run_comparison()
            elif choice == "6":
                app.show_last_result()
            else:
                print("Invalid option")
        except RuntimeError as exc:
            print(f"[vision] {exc}")


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

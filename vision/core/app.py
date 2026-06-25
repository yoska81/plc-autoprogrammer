import argparse
import os
import shutil
import sys
import time
from pathlib import Path

import cv2
import numpy as np

from . import config
from .camera.factory import create_camera_source
from .camera.real_camera import probe_camera_indices
from .compare import ComparisonResult, compare_images
from .db import Database
from .product_paths import ProductAngleLocation
from .storage import save_image
from machine_interface import SimulatedMachineInterface


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
    """The engine. Owns the database, the camera, the product/angle selection,
    and the Machine Signal Interface. UI screens and the CLI menu both drive
    this one object; core/db.py's Database is the only thing that touches
    SQLite."""

    def __init__(self, mode: str | None = None, device_index: int | None = None,
                 db_path: Path | None = None):
        self.db = Database(db_path or config.DATABASE_PATH)

        self.mode = mode or self.db.get_setting("camera_mode", config.DEFAULT_CAMERA_MODE)
        self.device_index = (
            device_index if device_index is not None
            else self.db.get_setting_int("camera_device_index", config.DEFAULT_DEVICE_INDEX)
        )
        self.frame_width = self.db.get_setting_int("frame_width", config.DEFAULT_FRAME_WIDTH)
        self.frame_height = self.db.get_setting_int("frame_height", config.DEFAULT_FRAME_HEIGHT)
        self.frame_fps = self.db.get_setting_int("frame_fps", config.DEFAULT_FRAME_FPS)
        self.threshold_percent = self.db.get_setting_float(
            "match_threshold_percent", config.DEFAULT_MATCH_THRESHOLD_PERCENT)
        self.save_all_snapshots = self.db.get_setting_bool(
            "save_all_snapshots", config.DEFAULT_SAVE_ALL_SNAPSHOTS)
        self.save_bad_products = self.db.get_setting_bool(
            "save_bad_products", config.DEFAULT_SAVE_BAD_PRODUCTS)
        self.plc_simulation_mode = self.db.get_setting_bool(
            "plc_simulation_mode", config.DEFAULT_PLC_SIMULATION_MODE)
        self.communication_type = self.db.get_setting(
            "communication_type", config.DEFAULT_COMMUNICATION_TYPE)

        self.camera = self._build_camera()
        self.camera_running = False
        self.has_gui = _gui_available()

        self.machine = SimulatedMachineInterface()
        self.machine.connect()

        self.current_product: dict | None = None
        self.current_angle: dict | None = None
        self.location: ProductAngleLocation | None = None

        self._last_frame: np.ndarray | None = None
        self.last_inspection_image_path: Path | None = None
        self.last_reference: dict | None = None
        self.last_comparison: ComparisonResult | None = None
        self.last_inspection_id: int | None = None

    # -------------------------------------------------------------- camera

    def _build_camera(self):
        return create_camera_source(
            self.mode, self.device_index, config.TEST_IMAGES_DIR,
            self.frame_width, self.frame_height, self.frame_fps,
            config.RESOLUTION_FALLBACKS,
        )

    def start(self) -> None:
        self.camera.open()
        self.camera_running = True
        print(f"[vision] camera source ready: {type(self.camera).__name__} (gui={'yes' if self.has_gui else 'no'})")

    def stop(self) -> None:
        self.camera.close()
        self.camera_running = False

    def reconfigure_camera(self, mode: str | None = None, device_index: int | None = None,
                            width: int | None = None, height: int | None = None,
                            fps: int | None = None) -> None:
        """Swap in a new camera source (Settings / Camera Setup screens). Caller
        is responsible for stopping/starting around this if the camera was open."""
        if mode is not None:
            self.mode = mode
        if device_index is not None:
            self.device_index = device_index
        if width is not None:
            self.frame_width = width
        if height is not None:
            self.frame_height = height
        if fps is not None:
            self.frame_fps = fps
        self.camera = self._build_camera()
        self.camera_running = False
        self.db.set_setting("camera_mode", self.mode)
        self.db.set_setting("camera_device_index", self.device_index)
        self.db.set_setting("frame_width", self.frame_width)
        self.db.set_setting("frame_height", self.frame_height)
        self.db.set_setting("frame_fps", self.frame_fps)

    def read_frame(self) -> np.ndarray:
        frame = self.camera.read_frame()
        self._last_frame = frame
        return frame

    # ------------------------------------------------------------ settings

    def set_threshold(self, value: float) -> None:
        self.threshold_percent = value
        self.db.set_setting("match_threshold_percent", value)

    def set_save_all_snapshots(self, value: bool) -> None:
        self.save_all_snapshots = value
        self.db.set_setting("save_all_snapshots", value)

    def set_save_bad_products(self, value: bool) -> None:
        self.save_bad_products = value
        self.db.set_setting("save_bad_products", value)

    def set_plc_simulation_mode(self, value: bool) -> None:
        self.plc_simulation_mode = value
        self.db.set_setting("plc_simulation_mode", value)

    def set_communication_type(self, value: str) -> None:
        self.communication_type = value
        self.db.set_setting("communication_type", value)

    # ------------------------------------------------- product/angle selection

    def select_product(self, product_id: int) -> None:
        self.current_product = self.db.get_product(product_id)
        self.current_angle = None
        self.location = None

    def select_angle(self, angle_id: int) -> None:
        angle = self.db.get_angle(angle_id)
        self.current_angle = angle
        self.current_product = self.db.get_product(angle["product_id"])
        self.location = ProductAngleLocation(self.current_product["name"], angle["angle_name"])
        self.location.ensure_dirs()

    def _require_location(self) -> ProductAngleLocation:
        if self.location is None:
            raise RuntimeError("No product/angle selected.")
        return self.location

    # --------------------------------------------------------------- capture

    def save_good_reference(self, make_primary: bool | None = None, notes: str = "") -> int:
        location = self._require_location()
        frame = self.read_frame()
        path = location.new_reference_path()
        cv2.imwrite(str(path), frame)
        return self.db.add_reference_image(
            self.current_product["id"], self.current_angle["id"], str(path),
            notes=notes, make_primary=make_primary,
        )

    def capture_inspection_image(self) -> Path:
        location = self._require_location()
        frame = self.read_frame()
        path = location.new_inspection_path()
        cv2.imwrite(str(path), frame)
        self.last_inspection_image_path = path
        return path

    # ------------------------------------------------------------- compare

    def compute_comparison(self) -> ComparisonResult:
        location = self._require_location()
        primary = self.db.get_primary_reference(self.current_angle["id"])
        if primary is None:
            raise RuntimeError("No GOOD reference saved yet for this product/angle.")
        if self.last_inspection_image_path is None:
            raise RuntimeError("No inspection image captured yet for this product/angle.")

        diff_path = location.new_diff_path()
        comparison = compare_images(
            Path(primary["image_path"]), self.last_inspection_image_path, diff_path,
            threshold_percent=self.threshold_percent,
        )
        self.last_comparison = comparison
        self.last_reference = primary
        print(f"[vision] result={comparison.result} score={comparison.score_percent:.2f}% diff={comparison.diff_image_path}")
        return comparison

    def save_result(self, trigger_source: str = "manual", notes: str = "") -> int:
        """Archive a BAD result under bad_products/ (if enabled) and write the
        inspection row to the database. Call after compute_comparison()."""
        comparison = self.last_comparison
        if comparison is None:
            raise RuntimeError("No comparison result to save yet.")
        location = self._require_location()

        bad_image_path: Path | None = None
        if comparison.result == "BAD" and self.save_bad_products:
            bad_image_path = location.new_bad_product_path()
            shutil.copy2(self.last_inspection_image_path, bad_image_path)
            shutil.copy2(comparison.diff_image_path, location.new_bad_product_path(suffix="_diff"))

        inspection_id = self.db.record_inspection(
            product_id=self.current_product["id"],
            angle_id=self.current_angle["id"],
            reference_image_id=self.last_reference["id"],
            inspection_image_path=str(self.last_inspection_image_path),
            difference_image_path=str(comparison.diff_image_path),
            bad_image_path=str(bad_image_path) if bad_image_path else None,
            result=comparison.result,
            score=comparison.score_percent,
            threshold=self.threshold_percent,
            camera_mode=self.mode,
            camera_index=self.device_index,
            trigger_source=trigger_source,
            notes=notes,
        )
        self.last_inspection_id = inspection_id

        if comparison.result == "GOOD":
            self.machine.send_good()
        else:
            self.machine.send_bad()

        print(f"[vision] inspection #{inspection_id} saved ({comparison.result})")
        return inspection_id

    def run_comparison(self, trigger_source: str = "manual") -> ComparisonResult:
        """CLI convenience: compute and immediately persist, in one step."""
        comparison = self.compute_comparison()
        self.save_result(trigger_source=trigger_source)
        return comparison

    # ------------------------------------------------- Machine Signal Interface

    def fire_trigger(self) -> None:
        self.machine.fire_trigger()

    def poll_trigger_and_inspect(self, trigger_source: str = "plc") -> ComparisonResult | None:
        """Step 5+ of the main workflow: if a trigger pulse is pending, capture,
        compare, and save in one shot. Returns None if no trigger was pending."""
        if not self.machine.read_trigger():
            return None
        self.capture_inspection_image()
        comparison = self.compute_comparison()
        self.save_result(trigger_source=trigger_source)
        return comparison

    def get_machine_status(self) -> str:
        return self.machine.get_status()

    # ----------------------------------------------------------------- misc

    def live_preview(self, duration_seconds: float = 5.0) -> None:
        print(f"[vision] live preview for {duration_seconds:.0f}s" + (" (press 'q' to stop early)" if self.has_gui else ""))
        start = time.monotonic()
        while time.monotonic() - start < duration_seconds:
            frame = self.read_frame()
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

    def show_last_result(self) -> None:
        if self.last_comparison is None:
            print("[vision] no comparison run yet this session.")
            return
        r = self.last_comparison
        print(f"[vision] last result: {r.result} ({r.score_percent:.2f}%) diff={r.diff_image_path}")


def get_or_create_product(app: QCApp, product_name: str) -> dict:
    product = app.db.get_product_by_name(product_name)
    if product is None:
        product = app.db.get_product(app.db.create_product(product_name))
    return product


def get_or_create_angle(app: QCApp, product_id: int, angle_name: str) -> dict:
    angle = app.db.get_angle_by_name(product_id, angle_name)
    if angle is None:
        angle = app.db.get_angle(app.db.create_angle(product_id, angle_name))
    return angle


def select_product_angle(app: QCApp, product_name: str, angle_name: str) -> None:
    product = get_or_create_product(app, product_name)
    app.select_product(product["id"])
    angle = get_or_create_angle(app, product["id"], angle_name)
    app.select_angle(angle["id"])
    primary = app.db.get_primary_reference(angle["id"])
    print(f"[vision] selected product='{product_name}' angle='{angle_name}'")
    print(f"[vision] GOOD reference {'found' if primary else 'not set yet'}")


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
                select_product_angle(app, product, angle)
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
    parser = argparse.ArgumentParser(description="VISION SYSTEM - QC: Windows PC camera QC capture app")
    parser.add_argument("--mode", choices=["auto", "real", "test"], default=config.DEFAULT_CAMERA_MODE,
                         help="auto (default): use a real camera if present, else fall back to test images")
    parser.add_argument("--device-index", type=int, default=config.DEFAULT_DEVICE_INDEX)
    parser.add_argument(
        "--probe-cameras", action="store_true",
        help="list which camera device indices (0, 1, 2) respond, then exit without starting the app",
    )
    args = parser.parse_args()

    if args.probe_cameras:
        for index, available in probe_camera_indices([0, 1, 2]).items():
            print(f"[vision] device index {index}: {'AVAILABLE' if available else 'not found'}")
        return

    app = QCApp(mode=args.mode, device_index=args.device_index)
    app.start()
    try:
        run_menu(app)
    finally:
        app.stop()


if __name__ == "__main__":
    main()

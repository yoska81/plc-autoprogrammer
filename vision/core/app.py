import argparse
import os
import shutil
import sys
import time
from pathlib import Path

import cv2
import numpy as np

from . import compare_v2, config
from .camera.factory import create_camera_source
from .camera.real_camera import probe_camera_indices
from .camera_manager import CameraManager
from .compare import ComparisonResult, compare_images
from .compare_v2 import V2ComparisonResult
from .db import Database
from .product_paths import ProductAngleLocation, new_no_product_path
from .storage import save_image
from machine_interface import SimulatedMachineInterface


class NoProductDecisionRequired(Exception):
    """Raised by save_result() when inspection_mode is Free Position/Continuous
    Rotation, the comparison came back NO_PRODUCT_FOUND, and no_product_action
    is "ask_operator" - the UI must show the Skip/Count as BAD/Save as NO
    PRODUCT prompt and then call save_no_product_decision() with the answer."""


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
        config.ensure_data_folders()
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

        self.inspection_mode = self.db.get_setting("inspection_mode", config.DEFAULT_INSPECTION_MODE)
        self.matching_method = self.db.get_setting("matching_method", config.DEFAULT_MATCHING_METHOD)
        self.alignment_method = self.db.get_setting("alignment_method", config.DEFAULT_ALIGNMENT_METHOD)
        self.min_recognition_confidence = self.db.get_setting_float(
            "min_recognition_confidence", config.DEFAULT_MIN_RECOGNITION_CONFIDENCE)
        self.min_feature_matches = self.db.get_setting_int(
            "min_feature_matches", config.DEFAULT_MIN_FEATURE_MATCHES)
        self.no_product_action = self.db.get_setting(
            "no_product_action", config.DEFAULT_NO_PRODUCT_ACTION)
        self.save_no_product_images = self.db.get_setting_bool(
            "save_no_product_images", config.DEFAULT_SAVE_NO_PRODUCT_IMAGES)
        self.log_skipped_inspections = self.db.get_setting_bool(
            "log_skipped_inspections", config.DEFAULT_LOG_SKIPPED_INSPECTIONS)
        self.save_normalized_image = self.db.get_setting_bool(
            "save_normalized_image", config.DEFAULT_SAVE_NORMALIZED_IMAGE)
        self.auto_csv_log = self.db.get_setting_bool(
            "auto_csv_log", config.DEFAULT_AUTO_CSV_LOG)
        self.feature_score_weight = self.db.get_setting_float(
            "feature_score_weight", config.DEFAULT_FEATURE_SCORE_WEIGHT)
        self.shape_score_weight = self.db.get_setting_float(
            "shape_score_weight", config.DEFAULT_SHAPE_SCORE_WEIGHT)
        self.pixel_score_weight = self.db.get_setting_float(
            "pixel_score_weight", config.DEFAULT_PIXEL_SCORE_WEIGHT)
        self.edge_score_weight = self.db.get_setting_float(
            "edge_score_weight", config.DEFAULT_EDGE_SCORE_WEIGHT)

        self.camera = self._build_camera()
        self.camera_running = False
        self.has_gui = _gui_available()

        self.machine = SimulatedMachineInterface()
        self.machine.connect()

        # Multi-camera / multi-station layer (core/camera_manager.py). This
        # workflow above is, and remains, "Station 1" - the primary station
        # row below is config/identity only, so the Cameras/Stations screen
        # can list it alongside any additional stations; CameraManager
        # delegates all Station 1 start/stop/capture calls straight back to
        # this QCApp instance rather than ever opening a second handle to
        # the same physical camera.
        self._ensure_primary_camera_row()
        self.camera_manager = CameraManager(self.db, primary_engine=self)

        self.current_product: dict | None = None
        self.current_angle: dict | None = None
        self.location: ProductAngleLocation | None = None

        self._last_frame: np.ndarray | None = None
        self.last_inspection_image_path: Path | None = None
        self.last_reference: dict | None = None
        self.last_comparison: ComparisonResult | None = None
        self.last_comparison_v2: V2ComparisonResult | None = None
        self._last_v2_diff_path: Path | None = None
        self._last_v2_normalized_path: Path | None = None
        self.last_inspection_id: int | None = None
        self.last_report_status: str = ""

    # -------------------------------------------------------------- camera

    def _ensure_primary_camera_row(self) -> None:
        """Create the "Station 1" row in cameras (core/db.py) the first time
        this database is opened, so the Cameras/Stations screen always has
        something to show for the original single-camera workflow even
        before any additional station is configured."""
        existing = [row for row in self.db.list_cameras() if row["is_primary_station"]]
        if existing:
            self.primary_camera_id = existing[0]["id"]
            return
        camera_type = config.CAMERA_TYPE_TEST if self.mode == "test" else config.CAMERA_TYPE_USB
        self.primary_camera_id = self.db.create_camera(
            config.DEFAULT_STATION_NAME, camera_type=camera_type, device_index=self.device_index,
            width=self.frame_width, height=self.frame_height, fps=self.frame_fps,
            inspection_mode=self.inspection_mode, trigger_source=config.TRIGGER_SOURCE_MANUAL,
            save_images=self.save_all_snapshots, enabled=True, is_primary_station=True,
            notes="Original single-camera workflow (Inspection tab).",
        )

    def _primary_camera_identity(self) -> dict:
        """camera_id/station_name/camera_type/camera_index_or_address for the
        Inspection tab's own saves, matching the fields core/camera_manager.py
        already attaches to every other station's inspection rows."""
        return {
            "camera_id": self.primary_camera_id,
            "station_name": config.DEFAULT_STATION_NAME,
            "camera_type": config.CAMERA_TYPE_TEST if self.mode == "test" else config.CAMERA_TYPE_USB,
            "camera_index_or_address": str(self.device_index),
        }

    def _note_report_saved(self) -> None:
        if self.db.last_csv_log_error:
            self.last_report_status = f"Report saved (CSV log failed: {self.db.last_csv_log_error})"
        else:
            self.last_report_status = "Report saved"

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

    def set_inspection_mode(self, value: str) -> None:
        self.inspection_mode = value
        self.db.set_setting("inspection_mode", value)

    def set_matching_method(self, value: str) -> None:
        self.matching_method = value
        self.db.set_setting("matching_method", value)

    def set_alignment_method(self, value: str) -> None:
        self.alignment_method = value
        self.db.set_setting("alignment_method", value)

    def set_min_recognition_confidence(self, value: float) -> None:
        self.min_recognition_confidence = value
        self.db.set_setting("min_recognition_confidence", value)

    def set_min_feature_matches(self, value: int) -> None:
        self.min_feature_matches = value
        self.db.set_setting("min_feature_matches", value)

    def set_no_product_action(self, value: str) -> None:
        self.no_product_action = value
        self.db.set_setting("no_product_action", value)

    def set_save_no_product_images(self, value: bool) -> None:
        self.save_no_product_images = value
        self.db.set_setting("save_no_product_images", value)

    def set_log_skipped_inspections(self, value: bool) -> None:
        self.log_skipped_inspections = value
        self.db.set_setting("log_skipped_inspections", value)

    def set_save_normalized_image(self, value: bool) -> None:
        self.save_normalized_image = value
        self.db.set_setting("save_normalized_image", value)

    def set_auto_csv_log(self, value: bool) -> None:
        self.auto_csv_log = value
        self.db.set_setting("auto_csv_log", value)

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
        frame = self.read_frame()
        return self.save_good_reference_from_image(frame, make_primary=make_primary, notes=notes)

    def save_good_reference_from_image(self, image: np.ndarray, make_primary: bool | None = None,
                                        notes: str = "", manual_bbox: tuple[int, int, int, int] | None = None) -> int:
        """Save a GOOD reference image and build its V2 feature descriptors.

        Features are built unconditionally (cheap, ORB+AKAZE+contour) so a
        later switch of Inspection Mode to Free Position/Continuous Rotation
        never requires re-saving references that already exist. manual_bbox
        is the Teach Product wizard's operator-drawn product-boundary
        override (Step 3); None preserves today's auto-contour behavior.
        """
        location = self._require_location()
        path = location.new_reference_path()
        cv2.imwrite(str(path), image)
        reference_id = self.db.add_reference_image(
            self.current_product["id"], self.current_angle["id"], str(path),
            notes=notes, make_primary=make_primary,
        )
        feature_path = compare_v2.build_and_save_reference_features(
            image, path.with_suffix(".npz"), manual_bbox=manual_bbox,
        )
        if feature_path is not None:
            self.db.set_reference_feature_path(reference_id, str(feature_path))
        return reference_id

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

    def _v2_candidates(self) -> list[dict]:
        """References to search. Free Position/Continuous Rotation mode
        searches every reference saved for the whole product (any angle);
        Fixed mode only ever uses the currently selected angle's primary
        reference, exactly like V1."""
        if self.inspection_mode == config.INSPECTION_MODE_FREE_POSE:
            return self.db.list_reference_images_for_product(self.current_product["id"])
        primary = self.db.get_primary_reference(self.current_angle["id"])
        return [primary] if primary else []

    def compute_comparison_v2(self) -> V2ComparisonResult:
        """V2 'Free Position / Continuous Rotation' engine: locate the product
        anywhere in the frame, recover its 2D pose (continuous rotation angle,
        not a fixed step), align it back to the best-matching reference, and
        score the aligned images. Never compares the raw inspection frame
        directly to a reference."""
        location = self._require_location()
        if self.last_inspection_image_path is None:
            raise RuntimeError("No inspection image captured yet for this product/angle.")
        candidates = self._v2_candidates()
        if not candidates:
            raise RuntimeError("No GOOD reference saved yet for this product/angle.")

        insp_image = cv2.imread(str(self.last_inspection_image_path))
        weights = (self.feature_score_weight, self.shape_score_weight,
                   self.pixel_score_weight, self.edge_score_weight)
        result = compare_v2.compute_comparison_v2(
            insp_image, candidates, threshold_percent=self.threshold_percent,
            alignment_method=self.alignment_method, min_feature_matches=self.min_feature_matches,
            min_recognition_confidence=self.min_recognition_confidence, matching_method=self.matching_method,
            score_weights=weights,
        )

        self._last_v2_normalized_path = None
        if result.normalized_image is not None and self.save_normalized_image:
            self._last_v2_normalized_path = location.new_normalized_path()
            cv2.imwrite(str(self._last_v2_normalized_path), result.normalized_image)

        self._last_v2_diff_path = None
        if result.diff_image is not None:
            self._last_v2_diff_path = location.new_diff_path()
            cv2.imwrite(str(self._last_v2_diff_path), result.diff_image)

        if result.product_detected and result.ref_gray is not None and result.norm_gray is not None:
            angle_id = result.best_angle_id or self.current_angle["id"]
            regions = self.db.list_regions(self.current_product["id"], angle_id)
            if regions:
                result.region_scores = compare_v2.score_regions(result.ref_gray, result.norm_gray, regions)

        self.last_comparison_v2 = result
        print(
            f"[vision] V2 result={result.result} score={result.final_score:.2f}% "
            f"rotation={result.detected_rotation_deg} confidence={result.recognition_confidence}"
        )
        return result

    def auto_match_reference(self) -> V2ComparisonResult:
        """UI 'Auto Match Reference' button: same search as compute_comparison_v2(),
        exposed under its own name for clarity. Call save_result() afterwards
        to log it."""
        return self.compute_comparison_v2()

    def save_result(self, trigger_source: str = "manual", notes: str = "") -> int:
        """Archive a BAD result under bad_products/ (if enabled) and write the
        inspection row to the database. Call after compute_comparison() (V1)
        or compute_comparison_v2() (V2), matching whichever inspection_mode
        is active."""
        if self.inspection_mode == config.INSPECTION_MODE_FREE_POSE:
            return self._save_result_v2(trigger_source=trigger_source, notes=notes)
        return self._save_result_v1(trigger_source=trigger_source, notes=notes)

    def _save_result_v1(self, trigger_source: str = "manual", notes: str = "") -> int:
        comparison = self.last_comparison
        if comparison is None:
            raise RuntimeError("No comparison result to save yet.")
        location = self._require_location()

        bad_image_path: Path | None = None
        if comparison.result == "BAD" and self.save_bad_products:
            bad_image_path = location.new_bad_product_path()
            shutil.copy2(self.last_inspection_image_path, bad_image_path)
            shutil.copy2(comparison.diff_image_path, location.new_bad_product_path(suffix="_diff"))

        try:
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
                engine_version="v1",
                **self._primary_camera_identity(),
            )
        except Exception as exc:
            self.last_report_status = f"Report save failed: {exc}"
            raise
        self.last_inspection_id = inspection_id
        self._note_report_saved()

        if comparison.result == "GOOD":
            self.machine.send_good()
        else:
            self.machine.send_bad()

        print(f"[vision] inspection #{inspection_id} saved ({comparison.result})")
        return inspection_id

    def _save_result_v2(self, trigger_source: str = "manual", notes: str = "") -> int | None:
        result = self.last_comparison_v2
        if result is None:
            raise RuntimeError("No comparison result to save yet.")

        if result.result == config.RESULT_NO_PRODUCT_FOUND:
            if self.no_product_action == config.NO_PRODUCT_ACTION_ASK_OPERATOR:
                raise NoProductDecisionRequired()
            return self._finalize_no_product(result, self.no_product_action, trigger_source, notes)

        return self._finalize_detected_result_v2(result, trigger_source, notes)

    def _finalize_detected_result_v2(self, result: V2ComparisonResult, trigger_source: str, notes: str) -> int:
        """GOOD/BAD path: a product WAS located, it just may have failed
        inspection. Distinct from _finalize_no_product(), which handles the
        case where no product was located at all."""
        location = self._require_location()

        bad_image_path: Path | None = None
        if result.result == config.RESULT_BAD and self.save_bad_products:
            bad_image_path = location.new_bad_product_path()
            shutil.copy2(self.last_inspection_image_path, bad_image_path)

        angle_id = result.best_angle_id or self.current_angle["id"]
        try:
            inspection_id = self.db.record_inspection(
                product_id=self.current_product["id"],
                angle_id=angle_id,
                reference_image_id=result.best_reference_image_id,
                inspection_image_path=str(self.last_inspection_image_path),
                difference_image_path=str(self._last_v2_diff_path) if self._last_v2_diff_path else None,
                bad_image_path=str(bad_image_path) if bad_image_path else None,
                result=result.result,
                score=result.final_score,
                threshold=self.threshold_percent,
                camera_mode=self.mode,
                camera_index=self.device_index,
                trigger_source=trigger_source,
                notes=notes,
                engine_version="v2",
                feature_score=result.feature_score,
                shape_score=result.shape_score,
                pixel_score=result.pixel_score,
                edge_score=result.edge_score,
                recognition_confidence=result.recognition_confidence,
                alignment_quality=result.alignment_quality,
                alignment_method=result.alignment_method,
                detected_center_x=result.detected_center_x,
                detected_center_y=result.detected_center_y,
                detected_rotation_deg=result.detected_rotation_deg,
                detected_scale=result.detected_scale,
                normalized_image_path=str(self._last_v2_normalized_path) if self._last_v2_normalized_path else None,
                no_product_found=0,
                product_detected=1,
                skipped=0,
                detection_confidence=result.recognition_confidence,
                **self._primary_camera_identity(),
            )
        except Exception as exc:
            self.last_report_status = f"Report save failed: {exc}"
            raise
        self.last_inspection_id = inspection_id
        self._note_report_saved()

        if result.region_scores:
            self.db.record_region_results(inspection_id, [
                {
                    "region_id": rs.region_id, "region_name": rs.region_name,
                    "pixel_score": rs.pixel_score, "edge_score": rs.edge_score,
                    "combined_score": rs.combined_score, "result": rs.result,
                }
                for rs in result.region_scores
            ])

        if result.result == config.RESULT_GOOD:
            self.machine.send_good()
        else:
            self.machine.send_bad()

        print(f"[vision] inspection #{inspection_id} saved ({result.result})")
        return inspection_id

    def _finalize_no_product(self, result: V2ComparisonResult, action: str,
                              trigger_source: str, notes: str) -> int | None:
        """Apply the No Product Action setting once V2 has reported
        NO_PRODUCT_FOUND. Never confuses "no product" with "BAD": BAD means a
        product was located and failed; this path means nothing was located
        at all (early trigger, empty conveyor gap, manual trigger with
        nothing in frame, ...)."""
        if action == config.NO_PRODUCT_ACTION_SKIP:
            if not self.log_skipped_inspections:
                print("[vision] inspection skipped (no product found, not counted)")
                self.last_report_status = "Skipped (no product found, not logged per settings)"
                return None
            return self._record_no_product_row(
                result, db_result=config.RESULT_SKIPPED, action=action, trigger_source=trigger_source,
                notes=notes, skipped=1, skip_reason="no_product_found", saved_no_product_path=None,
            )

        if action == config.NO_PRODUCT_ACTION_COUNT_AS_NO_PRODUCT:
            saved_path = None
            if self.save_no_product_images and self.last_inspection_image_path:
                saved_path = new_no_product_path()
                shutil.copy2(self.last_inspection_image_path, saved_path)
            inspection_id = self._record_no_product_row(
                result, db_result=config.RESULT_NO_PRODUCT_FOUND, action=action, trigger_source=trigger_source,
                notes=notes, skipped=0, skip_reason=None, saved_no_product_path=saved_path,
            )
            self.machine.send_no_product()
            return inspection_id

        if action == config.NO_PRODUCT_ACTION_TREAT_AS_BAD:
            location = self._require_location()
            bad_image_path = None
            if self.save_bad_products and self.last_inspection_image_path:
                bad_image_path = location.new_bad_product_path()
                shutil.copy2(self.last_inspection_image_path, bad_image_path)
            inspection_id = self._record_no_product_row(
                result, db_result=config.RESULT_BAD, action=action, trigger_source=trigger_source,
                notes=notes, skipped=0, skip_reason=None, saved_no_product_path=None,
                bad_image_path=bad_image_path,
            )
            self.machine.send_bad()
            return inspection_id

        raise ValueError(f"Unsupported no_product_action: {action!r}")

    def _record_no_product_row(self, result: V2ComparisonResult, db_result: str, action: str,
                                trigger_source: str, notes: str, skipped: int, skip_reason: str | None,
                                saved_no_product_path: Path | None, bad_image_path: Path | None = None) -> int:
        try:
            inspection_id = self.db.record_inspection(
                product_id=self.current_product["id"],
                angle_id=self.current_angle["id"],
                reference_image_id=None,
                inspection_image_path=str(self.last_inspection_image_path) if self.last_inspection_image_path else None,
                difference_image_path=None,
                bad_image_path=str(bad_image_path) if bad_image_path else None,
                result=db_result,
                score=0.0,
                threshold=self.threshold_percent,
                camera_mode=self.mode,
                camera_index=self.device_index,
                trigger_source=trigger_source,
                notes=notes,
                engine_version="v2",
                recognition_confidence=result.recognition_confidence,
                detection_confidence=result.recognition_confidence,
                alignment_method=result.alignment_method,
                detected_center_x=result.detected_center_x,
                detected_center_y=result.detected_center_y,
                detected_rotation_deg=result.detected_rotation_deg,
                detected_scale=result.detected_scale,
                no_product_found=1,
                product_detected=0,
                skipped=skipped,
                skip_reason=skip_reason,
                no_product_action=action,
                saved_no_product_image_path=str(saved_no_product_path) if saved_no_product_path else None,
                **self._primary_camera_identity(),
            )
        except Exception as exc:
            self.last_report_status = f"Report save failed: {exc}"
            raise
        self.last_inspection_id = inspection_id
        self._note_report_saved()
        print(f"[vision] inspection #{inspection_id} saved ({db_result}, no_product_action={action})")
        return inspection_id

    def save_no_product_decision(self, action: str, trigger_source: str = "manual", notes: str = "") -> int | None:
        """Call after the operator answers the "No product found. Skip this
        inspection or count as BAD?" prompt (only reachable when
        no_product_action == "ask_operator"). action is one of skip /
        count_as_no_product / treat_as_bad."""
        result = self.last_comparison_v2
        if result is None or result.result != config.RESULT_NO_PRODUCT_FOUND:
            raise RuntimeError("No pending no-product decision.")
        return self._finalize_no_product(result, action, trigger_source, notes)

    def run_comparison(self, trigger_source: str = "manual") -> ComparisonResult | V2ComparisonResult:
        """CLI convenience: compute and immediately persist, in one step."""
        comparison = self.compute_comparison_v2() if self.inspection_mode == config.INSPECTION_MODE_FREE_POSE \
            else self.compute_comparison()
        self.save_result(trigger_source=trigger_source)
        return comparison

    # ------------------------------------------------- Machine Signal Interface

    def fire_trigger(self) -> None:
        self.machine.fire_trigger()

    def poll_trigger_and_inspect(self, trigger_source: str = "plc") -> ComparisonResult | V2ComparisonResult | None:
        """Step 5+ of the main workflow: if a trigger pulse is pending, capture,
        compare, and save in one shot. Returns None if no trigger was pending.

        Unexpected failures (camera/IO errors mid-cycle) are logged as an
        ERROR result rather than crashing the trigger loop or being
        misreported as a quality failure - ERROR is not the same as BAD."""
        if not self.machine.read_trigger():
            return None
        try:
            self.capture_inspection_image()
            comparison = self.compute_comparison_v2() if self.inspection_mode == config.INSPECTION_MODE_FREE_POSE \
                else self.compute_comparison()
            self.save_result(trigger_source=trigger_source)
            return comparison
        except NoProductDecisionRequired:
            raise
        except Exception as exc:
            self._record_error(str(exc), trigger_source=trigger_source)
            raise

    def _record_error(self, message: str, trigger_source: str) -> None:
        if self.current_product is None or self.current_angle is None:
            self.last_report_status = f"Report save failed: {message}"
            return  # inspections.product_id/angle_id are NOT NULL - nothing to attach this to
        try:
            inspection_id = self.db.record_inspection(
                product_id=self.current_product["id"],
                angle_id=self.current_angle["id"],
                reference_image_id=None,
                inspection_image_path=str(self.last_inspection_image_path) if self.last_inspection_image_path else None,
                difference_image_path=None,
                bad_image_path=None,
                result=config.RESULT_ERROR,
                score=0.0,
                threshold=self.threshold_percent,
                camera_mode=self.mode,
                camera_index=self.device_index,
                trigger_source=trigger_source,
                notes=message,
                engine_version="v2" if self.inspection_mode == config.INSPECTION_MODE_FREE_POSE else "v1",
                **self._primary_camera_identity(),
            )
            self.last_inspection_id = inspection_id
            self._note_report_saved()
            print(f"[vision] inspection #{inspection_id} saved (ERROR: {message})")
        except Exception:
            self.last_report_status = f"Report save failed: {message}"
            # logging the error must never mask the original exception

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
        if self.inspection_mode == config.INSPECTION_MODE_FREE_POSE and self.last_comparison_v2 is not None:
            r = self.last_comparison_v2
            print(
                f"[vision] last result: {r.result} ({r.final_score:.2f}%) "
                f"rotation={r.detected_rotation_deg} confidence={r.recognition_confidence}"
            )
            return
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

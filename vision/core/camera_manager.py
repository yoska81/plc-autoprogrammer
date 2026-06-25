"""Multi-camera / multi-station coordinator.

Camera = a physical image source. Station = one inspection view using one
camera. Configuration for each station (camera type, device index/IP,
resolution, assigned product/angle, inspection mode, trigger source, ...)
lives in core/db.py's `cameras` table; this module owns the runtime side:
one independent capture thread per camera (so a slow/disconnected camera
never blocks the UI or any other camera) plus a per-station inspection
runner that calls the exact same pure scoring functions the single-camera
engine uses (core/compare.py, core/compare_v2.py) - no V1/V2 engine logic
is duplicated here, only re-invoked per station.

Station 1 (cameras.is_primary_station = 1) is the original single-camera
QCApp workflow and is never driven by a CameraWorker here - start/stop/
capture for it delegate straight to the QCApp instance passed in as
`primary_engine`, so that workflow's existing behavior is completely
unchanged. Every other configured station is fully independent: it owns
its own CameraSource and capture thread, and an exception in one station's
loop only marks that station as "error" - it never stops the others.
"""
from __future__ import annotations

import shutil
import threading
import time
from pathlib import Path

import cv2
import numpy as np

from . import compare_v2, config
from .camera.factory import create_camera_source
from .camera.real_camera import probe_camera_indices
from .compare import compare_images
from .db import Database
from .product_paths import ProductAngleLocation, new_no_product_path


class CameraWorker:
    """Owns one CameraSource and its background capture thread."""

    def __init__(self, camera_id: int, row: dict):
        self.camera_id = camera_id
        self.row = row
        self.source = None
        self.status = config.CAMERA_STATUS_STOPPED
        self.last_error: str | None = None
        self._frame_lock = threading.Lock()
        self._latest_frame: np.ndarray | None = None
        self._latest_frame_time: float | None = None
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def _build_source(self):
        row = self.row
        mode = "test" if row["camera_type"] == config.CAMERA_TYPE_TEST else "real"
        return create_camera_source(
            mode, row.get("device_index") or 0, config.TEST_IMAGES_DIR,
            row.get("width") or config.DEFAULT_FRAME_WIDTH,
            row.get("height") or config.DEFAULT_FRAME_HEIGHT,
            row.get("fps") or config.DEFAULT_FRAME_FPS,
            config.RESOLUTION_FALLBACKS,
        )

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self.status = config.CAMERA_STATUS_STARTING
        self.last_error = None
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, name=f"camera-{self.camera_id}", daemon=True)
        self._thread.start()

    def _run(self) -> None:
        try:
            self.source = self._build_source()
            self.source.open()
            self.status = config.CAMERA_STATUS_LIVE
        except Exception as exc:
            self.status = config.CAMERA_STATUS_ERROR
            self.last_error = str(exc)
            return

        preview_fps = self.row.get("preview_fps") or self.row.get("fps") or config.DEFAULT_FRAME_FPS
        period = 1.0 / min(max(1, preview_fps), 30)  # never busy-loop faster than 30Hz
        while not self._stop_event.is_set():
            try:
                frame = self.source.read_frame()
                with self._frame_lock:
                    self._latest_frame = frame
                    self._latest_frame_time = time.monotonic()
                if self.status != config.CAMERA_STATUS_LIVE:
                    self.status = config.CAMERA_STATUS_LIVE
                    self.last_error = None
            except Exception as exc:
                # A read failure marks only this station as errored and backs
                # off briefly before retrying - it never raises out of the
                # thread (which would silently stop this camera forever) and
                # never touches any other camera's worker/thread.
                self.status = config.CAMERA_STATUS_ERROR
                self.last_error = str(exc)
                time.sleep(0.5)
                continue
            time.sleep(period)

        try:
            self.source.close()
        except Exception:
            pass
        self.status = config.CAMERA_STATUS_STOPPED

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        self.status = config.CAMERA_STATUS_STOPPED

    def get_latest_frame(self) -> np.ndarray | None:
        with self._frame_lock:
            return None if self._latest_frame is None else self._latest_frame.copy()

    def capture_frame(self) -> np.ndarray:
        """Synchronous fresh read for a triggered inspection cycle - bypasses
        the low-rate preview loop's cached frame so inspection always scores
        a just-captured image, not a stale preview thumbnail."""
        if self.source is None:
            raise RuntimeError(f"Camera/station {self.camera_id} is not started.")
        frame = self.source.read_frame()
        with self._frame_lock:
            self._latest_frame = frame
            self._latest_frame_time = time.monotonic()
        return frame

    def get_status(self) -> dict:
        with self._frame_lock:
            last_time = self._latest_frame_time
        return {
            "camera_id": self.camera_id,
            "status": self.status,
            "last_error": self.last_error,
            "last_frame_age_s": None if last_time is None else time.monotonic() - last_time,
        }


def _stopped_status(camera_id: int) -> dict:
    return {"camera_id": camera_id, "status": config.CAMERA_STATUS_STOPPED, "last_error": None, "last_frame_age_s": None}


class CameraManager:
    """Required API (per the multi-camera/multi-station spec): add_camera,
    remove_camera, start_camera, stop_camera, start_all, stop_all,
    capture_frame, get_latest_frame, get_camera_status, list_cameras,
    probe_available_cameras - plus run_inspection(), the per-station
    capture+compare+save cycle used by the Cameras/Stations screen and the
    simulated multi-camera demo/tests."""

    def __init__(self, db: Database, primary_engine=None):
        self.db = db
        self.primary_engine = primary_engine
        self._workers: dict[int, CameraWorker] = {}

    # ------------------------------------------------------------ lifecycle

    def add_camera(self, station_name: str, **fields) -> int:
        return self.db.create_camera(station_name, **fields)

    def remove_camera(self, camera_id: int) -> None:
        self.stop_camera(camera_id)
        self._workers.pop(camera_id, None)
        self.db.delete_camera(camera_id)

    def _require_row(self, camera_id: int) -> dict:
        row = self.db.get_camera(camera_id)
        if row is None:
            raise ValueError(f"No camera/station with id {camera_id}")
        return row

    def _get_worker(self, camera_id: int, row: dict | None = None) -> CameraWorker:
        row = row or self._require_row(camera_id)
        worker = self._workers.get(camera_id)
        if worker is None or worker.row != row:
            worker = CameraWorker(camera_id, row)
            self._workers[camera_id] = worker
        return worker

    def start_camera(self, camera_id: int) -> None:
        row = self._require_row(camera_id)
        if row["is_primary_station"] and self.primary_engine is not None:
            if not self.primary_engine.camera_running:
                self.primary_engine.start()
            return
        self._get_worker(camera_id, row).start()

    def stop_camera(self, camera_id: int) -> None:
        row = self.db.get_camera(camera_id)
        if row and row["is_primary_station"] and self.primary_engine is not None:
            if self.primary_engine.camera_running:
                self.primary_engine.stop()
            return
        worker = self._workers.get(camera_id)
        if worker is not None:
            worker.stop()

    def start_all(self) -> None:
        for row in self.db.list_cameras():
            if row["enabled"]:
                self.start_camera(row["id"])

    def stop_all(self) -> None:
        for row in self.db.list_cameras():
            self.stop_camera(row["id"])

    # -------------------------------------------------------------- frames

    def capture_frame(self, camera_id: int) -> np.ndarray:
        row = self._require_row(camera_id)
        if row["is_primary_station"] and self.primary_engine is not None:
            return self.primary_engine.read_frame()
        return self._get_worker(camera_id, row).capture_frame()

    def get_latest_frame(self, camera_id: int) -> np.ndarray | None:
        row = self.db.get_camera(camera_id)
        if row and row["is_primary_station"] and self.primary_engine is not None:
            return self.primary_engine._last_frame
        worker = self._workers.get(camera_id)
        return None if worker is None else worker.get_latest_frame()

    def get_camera_status(self, camera_id: int) -> dict:
        row = self.db.get_camera(camera_id)
        if row is None:
            return _stopped_status(camera_id)
        if row["is_primary_station"] and self.primary_engine is not None:
            running = self.primary_engine.camera_running
            return {
                "camera_id": camera_id,
                "status": config.CAMERA_STATUS_LIVE if running else config.CAMERA_STATUS_STOPPED,
                "last_error": None,
                "last_frame_age_s": None,
            }
        worker = self._workers.get(camera_id)
        return _stopped_status(camera_id) if worker is None else worker.get_status()

    def list_cameras(self) -> list[dict]:
        return self.db.list_cameras()

    def get_counters(self, camera_id: int) -> dict:
        return self.db.count_inspections(camera_id=camera_id)

    @staticmethod
    def probe_available_cameras(indices: list[int] | None = None) -> dict[int, bool]:
        return probe_camera_indices(indices if indices is not None else list(range(4)))

    # --------------------------------------------------------- inspection

    def run_inspection(self, camera_id: int, trigger_source: str | None = None) -> dict:
        """One capture+compare+save cycle for a single station, scored with
        the same pure V1/V2 functions the single-camera engine uses. Returns
        a small summary dict (camera_id, result, score, inspection_id, or
        error) for the calling UI/test - not the engine's richer
        ComparisonResult/V2ComparisonResult objects."""
        row = self._require_row(camera_id)
        trigger_source = trigger_source or row["trigger_source"]

        if row["is_primary_station"] and self.primary_engine is not None:
            return self._run_primary_inspection(trigger_source)

        if not row["product_id"] or not row["angle_id"]:
            return {"camera_id": camera_id, "result": None, "error": "No product/angle assigned to this station."}

        product = self.db.get_product(row["product_id"])
        angle = self.db.get_angle(row["angle_id"])
        if product is None or angle is None:
            return {"camera_id": camera_id, "result": None, "error": "Assigned product/angle no longer exists."}

        try:
            frame = self.capture_frame(camera_id)
        except Exception as exc:
            return {"camera_id": camera_id, "result": None, "error": f"Capture failed: {exc}"}

        location = ProductAngleLocation(product["name"], angle["angle_name"])
        location.ensure_dirs()
        inspection_path = location.new_inspection_path()
        frame = self._resize_for_inspection(row, frame)
        cv2.imwrite(str(inspection_path), frame)

        camera_index_or_address = (
            str(row.get("device_index")) if row["camera_type"] in (config.CAMERA_TYPE_TEST, config.CAMERA_TYPE_USB)
            else row.get("ip_address")
        )

        try:
            if row["inspection_mode"] == config.INSPECTION_MODE_FREE_POSE:
                return self._run_v2(row, product, angle, location, frame, inspection_path,
                                     trigger_source, camera_index_or_address)
            return self._run_v1(row, product, angle, location, inspection_path,
                                 trigger_source, camera_index_or_address)
        except Exception as exc:
            threshold = self.db.get_setting_float("match_threshold_percent", config.DEFAULT_MATCH_THRESHOLD_PERCENT)
            inspection_id = self.db.record_inspection(
                product_id=product["id"], angle_id=angle["id"], reference_image_id=None,
                inspection_image_path=str(inspection_path), difference_image_path=None, bad_image_path=None,
                result=config.RESULT_ERROR, score=0.0, threshold=threshold,
                camera_mode=row["camera_type"], camera_index=row.get("device_index"), trigger_source=trigger_source,
                notes=str(exc), engine_version=row["inspection_mode"],
                camera_id=camera_id, station_name=row["station_name"], camera_type=row["camera_type"],
                camera_index_or_address=camera_index_or_address,
            )
            return {"camera_id": camera_id, "result": config.RESULT_ERROR, "error": str(exc), "inspection_id": inspection_id}

    @staticmethod
    def _resize_for_inspection(row: dict, frame: np.ndarray) -> np.ndarray:
        """Resize the captured frame to the station's inspection_width/height,
        when set - independent of the camera's native capture width/height,
        which the live preview loop still uses unchanged."""
        width, height = row.get("inspection_width"), row.get("inspection_height")
        if not width or not height:
            return frame
        return cv2.resize(frame, (int(width), int(height)))

    def _run_primary_inspection(self, trigger_source: str) -> dict:
        """Station 1: delegate to QCApp so it stays the single source of
        truth for the original single-camera workflow's state/behavior."""
        engine = self.primary_engine
        if engine.location is None:
            return {"camera_id": None, "result": None, "error": "No product/angle selected on the main Inspection screen."}
        try:
            engine.capture_inspection_image()
            comparison = (
                engine.compute_comparison_v2() if engine.inspection_mode == config.INSPECTION_MODE_FREE_POSE
                else engine.compute_comparison()
            )
            engine.save_result(trigger_source=trigger_source)
        except Exception as exc:
            return {"camera_id": None, "result": None, "error": str(exc)}
        result = getattr(comparison, "result", None)
        score = getattr(comparison, "final_score", None)
        if score is None:
            score = getattr(comparison, "score_percent", None)
        return {"camera_id": None, "result": result, "score": score, "inspection_id": engine.last_inspection_id}

    def _run_v1(self, row: dict, product: dict, angle: dict, location: ProductAngleLocation,
                inspection_path: Path, trigger_source: str, camera_index_or_address: str | None) -> dict:
        primary = self.db.get_primary_reference(angle["id"])
        if primary is None:
            raise RuntimeError("No GOOD reference saved yet for this product/angle.")
        threshold = self.db.get_setting_float("match_threshold_percent", config.DEFAULT_MATCH_THRESHOLD_PERCENT)
        diff_path = location.new_diff_path()
        comparison = compare_images(Path(primary["image_path"]), inspection_path, diff_path, threshold_percent=threshold)

        save_bad_products = self.db.get_setting_bool("save_bad_products", config.DEFAULT_SAVE_BAD_PRODUCTS)
        bad_image_path = None
        if comparison.result == "BAD" and save_bad_products:
            bad_image_path = location.new_bad_product_path()
            shutil.copy2(inspection_path, bad_image_path)
            shutil.copy2(comparison.diff_image_path, location.new_bad_product_path(suffix="_diff"))

        inspection_id = self.db.record_inspection(
            product_id=product["id"], angle_id=angle["id"], reference_image_id=primary["id"],
            inspection_image_path=str(inspection_path), difference_image_path=str(comparison.diff_image_path),
            bad_image_path=str(bad_image_path) if bad_image_path else None,
            result=comparison.result, score=comparison.score_percent, threshold=threshold,
            camera_mode=row["camera_type"], camera_index=row.get("device_index"), trigger_source=trigger_source,
            engine_version="v1",
            camera_id=row["id"], station_name=row["station_name"], camera_type=row["camera_type"],
            camera_index_or_address=camera_index_or_address,
        )
        return {"camera_id": row["id"], "result": comparison.result, "score": comparison.score_percent,
                "inspection_id": inspection_id}

    def _run_v2(self, row: dict, product: dict, angle: dict, location: ProductAngleLocation, frame: np.ndarray,
                inspection_path: Path, trigger_source: str, camera_index_or_address: str | None) -> dict:
        candidates = self.db.list_reference_images_for_product(product["id"])
        if not candidates:
            raise RuntimeError("No GOOD reference saved yet for this product.")

        threshold = self.db.get_setting_float("match_threshold_percent", config.DEFAULT_MATCH_THRESHOLD_PERCENT)
        matching_method = self.db.get_setting("matching_method", config.DEFAULT_MATCHING_METHOD)
        alignment_method = self.db.get_setting("alignment_method", config.DEFAULT_ALIGNMENT_METHOD)
        min_recognition_confidence = self.db.get_setting_float(
            "min_recognition_confidence", config.DEFAULT_MIN_RECOGNITION_CONFIDENCE)
        min_feature_matches = self.db.get_setting_int("min_feature_matches", config.DEFAULT_MIN_FEATURE_MATCHES)
        weights = (
            self.db.get_setting_float("feature_score_weight", config.DEFAULT_FEATURE_SCORE_WEIGHT),
            self.db.get_setting_float("shape_score_weight", config.DEFAULT_SHAPE_SCORE_WEIGHT),
            self.db.get_setting_float("pixel_score_weight", config.DEFAULT_PIXEL_SCORE_WEIGHT),
            self.db.get_setting_float("edge_score_weight", config.DEFAULT_EDGE_SCORE_WEIGHT),
        )

        result = compare_v2.compute_comparison_v2(
            frame, candidates, threshold_percent=threshold, alignment_method=alignment_method,
            min_feature_matches=min_feature_matches, min_recognition_confidence=min_recognition_confidence,
            matching_method=matching_method, score_weights=weights,
        )

        save_normalized_image = self.db.get_setting_bool("save_normalized_image", config.DEFAULT_SAVE_NORMALIZED_IMAGE)
        normalized_path = None
        if result.normalized_image is not None and save_normalized_image:
            normalized_path = location.new_normalized_path()
            cv2.imwrite(str(normalized_path), result.normalized_image)

        diff_path = None
        if result.diff_image is not None:
            diff_path = location.new_diff_path()
            cv2.imwrite(str(diff_path), result.diff_image)

        if result.result == config.RESULT_NO_PRODUCT_FOUND:
            return self._finalize_no_product(row, product, angle, location, result, inspection_path,
                                               trigger_source, camera_index_or_address)

        save_bad_products = self.db.get_setting_bool("save_bad_products", config.DEFAULT_SAVE_BAD_PRODUCTS)
        bad_image_path = None
        if result.result == config.RESULT_BAD and save_bad_products:
            bad_image_path = location.new_bad_product_path()
            shutil.copy2(inspection_path, bad_image_path)

        angle_id = result.best_angle_id or angle["id"]
        inspection_id = self.db.record_inspection(
            product_id=product["id"], angle_id=angle_id, reference_image_id=result.best_reference_image_id,
            inspection_image_path=str(inspection_path), difference_image_path=str(diff_path) if diff_path else None,
            bad_image_path=str(bad_image_path) if bad_image_path else None,
            result=result.result, score=result.final_score, threshold=threshold,
            camera_mode=row["camera_type"], camera_index=row.get("device_index"), trigger_source=trigger_source,
            engine_version="v2", feature_score=result.feature_score, shape_score=result.shape_score,
            pixel_score=result.pixel_score, edge_score=result.edge_score,
            recognition_confidence=result.recognition_confidence, alignment_quality=result.alignment_quality,
            alignment_method=result.alignment_method, detected_center_x=result.detected_center_x,
            detected_center_y=result.detected_center_y, detected_rotation_deg=result.detected_rotation_deg,
            detected_scale=result.detected_scale, normalized_image_path=str(normalized_path) if normalized_path else None,
            no_product_found=0, product_detected=1, skipped=0, detection_confidence=result.recognition_confidence,
            camera_id=row["id"], station_name=row["station_name"], camera_type=row["camera_type"],
            camera_index_or_address=camera_index_or_address,
        )
        return {"camera_id": row["id"], "result": result.result, "score": result.final_score,
                "inspection_id": inspection_id}

    def _finalize_no_product(self, row: dict, product: dict, angle: dict, location: ProductAngleLocation,
                              result, inspection_path: Path, trigger_source: str,
                              camera_index_or_address: str | None) -> dict:
        """Multi-camera equivalent of QCApp._finalize_no_product(). There is
        no per-station operator dialog in a background/automated multi-camera
        run, so "ask_operator" falls back to "skip" here - the single-camera
        Inspection tab still uses QCApp's interactive ask-operator flow
        unchanged for Station 1."""
        action = self.db.get_setting("no_product_action", config.DEFAULT_NO_PRODUCT_ACTION)
        if action == config.NO_PRODUCT_ACTION_ASK_OPERATOR:
            action = config.NO_PRODUCT_ACTION_SKIP
        log_skipped = self.db.get_setting_bool("log_skipped_inspections", config.DEFAULT_LOG_SKIPPED_INSPECTIONS)
        save_no_product_images = self.db.get_setting_bool("save_no_product_images", config.DEFAULT_SAVE_NO_PRODUCT_IMAGES)
        save_bad_products = self.db.get_setting_bool("save_bad_products", config.DEFAULT_SAVE_BAD_PRODUCTS)
        threshold = self.db.get_setting_float("match_threshold_percent", config.DEFAULT_MATCH_THRESHOLD_PERCENT)

        common = dict(
            product_id=product["id"], angle_id=angle["id"], reference_image_id=None,
            inspection_image_path=str(inspection_path), difference_image_path=None,
            score=0.0, threshold=threshold, camera_mode=row["camera_type"], camera_index=row.get("device_index"),
            trigger_source=trigger_source, engine_version="v2", recognition_confidence=result.recognition_confidence,
            detection_confidence=result.recognition_confidence, alignment_method=result.alignment_method,
            detected_center_x=result.detected_center_x, detected_center_y=result.detected_center_y,
            detected_rotation_deg=result.detected_rotation_deg, detected_scale=result.detected_scale,
            no_product_found=1, product_detected=0,
            camera_id=row["id"], station_name=row["station_name"], camera_type=row["camera_type"],
            camera_index_or_address=camera_index_or_address,
        )

        if action == config.NO_PRODUCT_ACTION_SKIP:
            if not log_skipped:
                return {"camera_id": row["id"], "result": None, "skipped": True}
            inspection_id = self.db.record_inspection(
                **common, bad_image_path=None, result=config.RESULT_SKIPPED, skipped=1,
                skip_reason="no_product_found", no_product_action=action,
            )
            return {"camera_id": row["id"], "result": config.RESULT_SKIPPED, "inspection_id": inspection_id}

        if action == config.NO_PRODUCT_ACTION_COUNT_AS_NO_PRODUCT:
            saved_path = None
            if save_no_product_images:
                saved_path = new_no_product_path()
                shutil.copy2(inspection_path, saved_path)
            inspection_id = self.db.record_inspection(
                **common, bad_image_path=None, result=config.RESULT_NO_PRODUCT_FOUND, skipped=0,
                no_product_action=action, saved_no_product_image_path=str(saved_path) if saved_path else None,
            )
            return {"camera_id": row["id"], "result": config.RESULT_NO_PRODUCT_FOUND, "inspection_id": inspection_id}

        # treat_as_bad
        bad_image_path = None
        if save_bad_products:
            bad_image_path = location.new_bad_product_path()
            shutil.copy2(inspection_path, bad_image_path)
        inspection_id = self.db.record_inspection(
            **common, bad_image_path=str(bad_image_path) if bad_image_path else None,
            result=config.RESULT_BAD, skipped=0, no_product_action=action,
        )
        return {"camera_id": row["id"], "result": config.RESULT_BAD, "inspection_id": inspection_id}

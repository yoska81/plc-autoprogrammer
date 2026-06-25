"""Regression test for the multi-camera/multi-station architecture
(core/camera_manager.py) and for No Product Found/Skip decision logic.

Covers exactly what the multi-camera spec requires:
  - At least 3 simulated cameras/stations running at once, each with its own
    independent status/result/counters.
  - One camera's failure (no hardware behind it) does not stop the others.
  - The three NO_PRODUCT_ACTION settings (skip, count_as_no_product,
    treat_as_bad) each produce the documented saved/skipped result, including
    the log_skipped_inspections toggle for the "skip" action.

Drives CameraManager directly against an isolated temporary database/temp
test-image folder - no QCApp/GUI, no real camera hardware, and the real
vision.db is never touched.

Every check fails loudly (assert with a message dumping the actual values)
rather than silently passing or adjusting expectations - if this test ever
needs to change, the engine/manager's behavior changed, not the test.

Run directly:
    python3 tools/test_multi_camera.py
"""
import shutil
import sys
import tempfile
import time
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core import compare_v2, config
from core.camera_manager import CameraManager
from core.db import Database

V1_SAMPLE_DIR = config.DATA_DIR / "test_images"
V2_DEMO_DIR = config.DATA_DIR / "test_images_v2_demo"
SAMPLE_GOOD_IMAGE = V1_SAMPLE_DIR / "sample_1_panel_good.png"
V2_REFERENCE_IMAGE = V2_DEMO_DIR / "v2_demo_reference.png"
NO_PRODUCT_DEMO_IMAGE = V2_DEMO_DIR / "v2_demo_random_no_product_01.png"


def test_multi_camera_independence() -> None:
    print("\n=== Multi-camera independence (>=3 stations, one failure isolated) ===")
    with tempfile.TemporaryDirectory(prefix="vision_test_multicam_") as tmp:
        db = Database(Path(tmp) / "test.db")
        product_id = db.create_product(name="Multi-Cam Test Product", part_number="TEST-MC-1")
        angle_id = db.create_angle(product_id, angle_name="Top")
        db.add_reference_image(product_id, angle_id, str(SAMPLE_GOOD_IMAGE), make_primary=True)

        manager = CameraManager(db, primary_engine=None)

        station_count = 3
        camera_ids = [
            manager.add_camera(
                f"Test Station {i}", camera_type=config.CAMERA_TYPE_TEST, device_index=i - 1,
                width=640, height=480, fps=10, product_id=product_id, angle_id=angle_id,
                inspection_mode=config.INSPECTION_MODE_FIXED, trigger_source=config.TRIGGER_SOURCE_MANUAL,
            )
            for i in range(1, station_count + 1)
        ]
        failed_camera_id = manager.add_camera(
            "Test Station (no hardware)", camera_type=config.CAMERA_TYPE_USB, device_index=98,
            width=640, height=480, fps=10, product_id=product_id, angle_id=angle_id,
            inspection_mode=config.INSPECTION_MODE_FIXED, trigger_source=config.TRIGGER_SOURCE_MANUAL,
        )

        try:
            manager.start_all()
            time.sleep(1.0)

            for camera_id in camera_ids:
                status = manager.get_camera_status(camera_id)
                assert status["status"] == config.CAMERA_STATUS_LIVE, (
                    f"camera {camera_id}: expected status LIVE after start, got {status}"
                )

            # Run a different number of inspections per station so each
            # station's counters are independently verifiable, not just
            # "all equal by coincidence".
            expected_totals = {}
            for i, camera_id in enumerate(camera_ids, start=1):
                for _ in range(i):
                    result = manager.run_inspection(camera_id, trigger_source=config.TRIGGER_SOURCE_MANUAL)
                    assert result.get("result") == config.RESULT_GOOD, (
                        f"camera {camera_id}: expected GOOD inspecting its own reference image, got {result}"
                    )
                expected_totals[camera_id] = i

            for camera_id, expected_total in expected_totals.items():
                counters = manager.get_counters(camera_id)
                assert counters.get("TOTAL") == expected_total, (
                    f"camera {camera_id}: expected TOTAL={expected_total} independent of the other "
                    f"stations, got counters={counters}"
                )
                assert counters.get("GOOD") == expected_total, (
                    f"camera {camera_id}: expected GOOD={expected_total}, got counters={counters}"
                )

            failed_status = manager.get_camera_status(failed_camera_id)
            assert failed_status["status"] == config.CAMERA_STATUS_ERROR, (
                f"the no-hardware station should have failed to open and report ERROR, got {failed_status}"
            )
            assert failed_status["last_error"], "expected a non-empty last_error for the no-hardware station"

            for camera_id in camera_ids:
                status = manager.get_camera_status(camera_id)
                assert status["status"] == config.CAMERA_STATUS_LIVE, (
                    f"camera {camera_id}: a sibling station's failure must not stop this station, "
                    f"but status is {status}"
                )
        finally:
            manager.stop_all()


def _setup_v2_reference(db: Database, tmp_dir: Path) -> tuple[int, int]:
    product_id = db.create_product(name="No-Product Test Product", part_number="TEST-NP-1")
    angle_id = db.create_angle(product_id, angle_name="Top")
    reference_id = db.add_reference_image(product_id, angle_id, str(V2_REFERENCE_IMAGE), make_primary=True)

    reference_image = cv2.imread(str(V2_REFERENCE_IMAGE))
    assert reference_image is not None, f"could not read {V2_REFERENCE_IMAGE}"
    features = compare_v2.build_reference_features(reference_image)
    feature_path = tmp_dir / "reference_features.npz"
    compare_v2.save_reference_features(features, feature_path)
    db.set_reference_feature_path(reference_id, str(feature_path))
    return product_id, angle_id


def test_no_product_action_settings() -> None:
    print("\n=== No Product Found / Skip decision logic ===")
    assert NO_PRODUCT_DEMO_IMAGE.exists(), (
        f"missing {NO_PRODUCT_DEMO_IMAGE} - run tools/generate_v2_demo_images.py first"
    )

    with tempfile.TemporaryDirectory(prefix="vision_test_noproduct_") as tmp:
        tmp_path = Path(tmp)
        db = Database(tmp_path / "test.db")
        product_id, angle_id = _setup_v2_reference(db, tmp_path)

        # A dedicated frame source folder containing only the no-product
        # demo image, so this station's TestImageCamera reliably cycles a
        # frame with no product in it.
        no_product_frames_dir = tmp_path / "no_product_frames"
        no_product_frames_dir.mkdir()
        shutil.copy2(NO_PRODUCT_DEMO_IMAGE, no_product_frames_dir / NO_PRODUCT_DEMO_IMAGE.name)

        manager = CameraManager(db, primary_engine=None)
        camera_id = manager.add_camera(
            "No-Product Station", camera_type=config.CAMERA_TYPE_TEST, device_index=0,
            width=640, height=480, fps=10, product_id=product_id, angle_id=angle_id,
            inspection_mode=config.INSPECTION_MODE_FREE_POSE, trigger_source=config.TRIGGER_SOURCE_MANUAL,
        )

        original_test_images_dir = config.TEST_IMAGES_DIR
        config.TEST_IMAGES_DIR = no_product_frames_dir
        try:
            manager.start_camera(camera_id)
            time.sleep(0.3)

            db.set_setting("no_product_action", config.NO_PRODUCT_ACTION_SKIP)
            db.set_setting("log_skipped_inspections", "false")
            result = manager.run_inspection(camera_id, trigger_source=config.TRIGGER_SOURCE_MANUAL)
            assert result.get("result") is None and result.get("skipped") is True, (
                f"skip action with log_skipped_inspections=False should not save anything, got {result}"
            )
            assert manager.get_counters(camera_id).get("TOTAL", 0) == 0, (
                "an unlogged skip must not be counted as any kind of inspection"
            )

            db.set_setting("log_skipped_inspections", "true")
            result = manager.run_inspection(camera_id, trigger_source=config.TRIGGER_SOURCE_MANUAL)
            assert result.get("result") == config.RESULT_SKIPPED, (
                f"skip action with log_skipped_inspections=True should save result=SKIPPED, got {result}"
            )

            db.set_setting("no_product_action", config.NO_PRODUCT_ACTION_COUNT_AS_NO_PRODUCT)
            result = manager.run_inspection(camera_id, trigger_source=config.TRIGGER_SOURCE_MANUAL)
            assert result.get("result") == config.RESULT_NO_PRODUCT_FOUND, (
                f"count_as_no_product action should save result=NO_PRODUCT_FOUND, got {result}"
            )

            db.set_setting("no_product_action", config.NO_PRODUCT_ACTION_TREAT_AS_BAD)
            result = manager.run_inspection(camera_id, trigger_source=config.TRIGGER_SOURCE_MANUAL)
            assert result.get("result") == config.RESULT_BAD, (
                f"treat_as_bad action should save result=BAD, got {result}"
            )

            counters = manager.get_counters(camera_id)
            assert counters.get("SKIPPED", 0) == 1, f"expected exactly 1 logged SKIPPED, got {counters}"
            assert counters.get("NO_PRODUCT_FOUND", 0) == 1, f"expected exactly 1 NO_PRODUCT_FOUND, got {counters}"
            assert counters.get("BAD", 0) == 1, f"expected exactly 1 BAD, got {counters}"
            assert counters.get("TOTAL", 0) == 3, f"expected TOTAL=3 (skip is unlogged), got {counters}"
        finally:
            manager.stop_camera(camera_id)
            config.TEST_IMAGES_DIR = original_test_images_dir


def main() -> None:
    failures = []
    for test_fn in (test_multi_camera_independence, test_no_product_action_settings):
        try:
            test_fn()
            print(f"[PASS] {test_fn.__name__}")
        except AssertionError as exc:
            print(f"[FAIL] {test_fn.__name__}: {exc}")
            failures.append(test_fn.__name__)

    if failures:
        print(f"\n{len(failures)} test(s) FAILED: {', '.join(failures)}")
        sys.exit(1)
    print("\nAll multi-camera tests passed.")


if __name__ == "__main__":
    main()

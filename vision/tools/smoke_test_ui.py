"""Headless smoke test for the VISION SYSTEM - QC desktop UI.

Drives MainWindow's screens directly (no .show(), no app.exec()) so it runs
under QT_QPA_PLATFORM=offscreen with no display - used locally and in CI
(the Windows GitHub Actions build) before packaging the .exe, as a basic
regression check that test-image mode, product/angle selection, reference
capture, inspection capture, compare, save-result, the simulated PLC
trigger, and report export still work end to end. Exits non-zero (via an
uncaught AssertionError) on failure.
"""
import sys
import tempfile
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PySide6.QtWidgets import QApplication

from core import config, reports
from core.app import get_or_create_angle, get_or_create_product
from ui.main_window import MainWindow
from ui.screens.camera_detail_screen import CameraDetailScreen


def _test_v2_region_scoring(window: MainWindow) -> None:
    """V2-mode sub-test: a product with inspection_regions defined must come
    back with region_scores populated (the per-region explainability layer
    from this pass), exercising the same core/app.py wiring the Inspection
    screen's Inspection Plan panel reads from."""
    engine = window.engine
    engine.set_inspection_mode(config.INSPECTION_MODE_FREE_POSE)

    demo_dir = config.DATA_DIR / "test_images_v2_demo"
    reference_path = demo_dir / "v2_demo_reference.png"
    good_path = demo_dir / "v2_demo_good_rotated.png"
    assert reference_path.exists() and good_path.exists(), (
        f"missing V2 demo images at {demo_dir} - run tools/generate_v2_demo_images.py first"
    )

    product = get_or_create_product(engine, "smoke_test_v2_region_product")
    engine.select_product(product["id"])
    angle = get_or_create_angle(engine, product["id"], "front")
    engine.select_angle(angle["id"])
    window.refresh_all()

    if engine.db.get_primary_reference(angle["id"]) is None:
        reference_image = cv2.imread(str(reference_path))
        assert reference_image is not None, f"could not read {reference_path}"
        engine.save_good_reference_from_image(reference_image, make_primary=True)

    regions = engine.db.list_regions(product["id"], angle["id"])
    if not regions:
        engine.db.add_region(
            product["id"], angle["id"], "smoke_region_a", config.REGION_TYPE_PRESENCE,
            0.1, 0.1, 0.3, 0.3, sort_order=0,
        )
        engine.db.add_region(
            product["id"], angle["id"], "smoke_region_b", config.REGION_TYPE_PRESENCE,
            0.6, 0.6, 0.9, 0.9, sort_order=1,
        )
        regions = engine.db.list_regions(product["id"], angle["id"])
    assert len(regions) == 2, f"expected 2 staged regions for this product, got {regions}"

    good_image = cv2.imread(str(good_path))
    assert good_image is not None, f"could not read {good_path}"
    location = engine._require_location()
    inspection_path = location.new_inspection_path()
    cv2.imwrite(str(inspection_path), good_image)
    engine.last_inspection_image_path = inspection_path

    result = engine.compute_comparison_v2()
    assert result.region_scores is not None and len(result.region_scores) == 2, (
        f"expected region_scores to populate for a product with 2 regions defined, got "
        f"{result.region_scores}"
    )
    for score in result.region_scores:
        assert score.result in config.REGION_RESULT_CHOICES, (
            f"region '{score.region_name}' returned an invalid result {score.result!r}"
        )
    print("[smoke_test_ui] V2 region scoring sub-test OK")


def _test_camera_detail_screen(window: MainWindow) -> None:
    """Headless instantiate-and-.refresh() check for the new 'Open Full
    View' window (ui/screens/camera_detail_screen.py) - confirms it builds
    and refreshes without a live display, against the primary station row
    every database always has (core/app.py's _ensure_primary_camera_row())."""
    engine = window.engine
    detail = CameraDetailScreen(engine, engine.primary_camera_id, on_change=lambda: None)
    detail.refresh()
    detail.close()
    print("[smoke_test_ui] CameraDetailScreen instantiate+refresh sub-test OK")


def main() -> None:
    app = QApplication(sys.argv)
    window = MainWindow(mode="test", device_index=0)
    engine = window.engine
    inspection = window.inspection_screen

    # This test exercises the V1 fixed-reference path specifically; force the
    # mode rather than trusting whatever inspection_mode was last persisted to
    # the database (e.g. by manual V2 testing), so the test is deterministic.
    engine.set_inspection_mode(config.INSPECTION_MODE_FIXED)

    inspection._on_start_camera()
    assert engine.camera_running, "camera did not start in test mode"
    inspection._update_live_preview()

    # get_or_create_* keeps this idempotent against the real database (no
    # UNIQUE-constraint failure on a second run against the same product name).
    product = get_or_create_product(engine, "smoke_test_product")
    engine.select_product(product["id"])
    angle = get_or_create_angle(engine, product["id"], "front")
    engine.select_angle(angle["id"])
    window.refresh_all()
    assert engine.location is not None, "product/angle was not selected"

    inspection._on_save_reference()
    primary = engine.db.get_primary_reference(angle["id"])
    assert primary is not None, "GOOD reference was not saved"
    assert Path(primary["image_path"]).exists(), "GOOD reference file is missing"

    inspection._on_take_inspection()
    assert engine.last_inspection_image_path is not None
    assert engine.last_inspection_image_path.exists(), "inspection image was not captured"

    inspection._on_compare()
    assert engine.last_comparison is not None, "compare did not produce a result"

    inspection._on_save_result()
    assert engine.last_inspection_id is not None, "result was not saved to the database"

    engine.fire_trigger()
    comparison = engine.poll_trigger_and_inspect(trigger_source="plc_simulated")
    assert comparison is not None, "simulated PLC trigger did not produce a result"

    with tempfile.TemporaryDirectory() as tmp:
        csv_path = reports.export_csv(engine.db, Path(tmp) / "report.csv")
        assert csv_path.exists(), "CSV report export failed"

    inspection._on_stop_camera()
    assert not engine.camera_running, "camera did not stop"

    _test_v2_region_scoring(window)
    _test_camera_detail_screen(window)

    print("[smoke_test_ui] OK")


if __name__ == "__main__":
    main()

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


def _test_setup_blocking(window: MainWindow) -> None:
    """Setup-status/blocking sub-test covering the usability-correction pass:
    a product is not inspectable until it has a GOOD reference (regardless
    of regions), region definitions are an additive layer (not required),
    and the Selected Product / Golden Reference / Inspection Plan panels on
    the Inspection screen reflect QCApp.setup_status() after each
    select_product()/select_angle()/refresh()."""
    engine = window.engine
    inspection = window.inspection_screen
    engine.set_inspection_mode(config.INSPECTION_MODE_FREE_POSE)

    # Start from a clean slate: this sub-test asserts a "not yet taught"
    # starting state, which only holds on a fresh product - re-running this
    # script against the same persistent database must not inherit a GOOD
    # reference saved by a previous run.
    existing = engine.db.get_product_by_name("smoke_test_setup_blocking_product")
    if existing is not None:
        engine.db.delete_product(existing["id"])

    product = get_or_create_product(engine, "smoke_test_setup_blocking_product")
    engine.select_product(product["id"])
    angle = get_or_create_angle(engine, product["id"], "front")
    engine.select_angle(angle["id"])
    window.refresh_all()

    # No GOOD reference yet -> not ready, and the panels must say so.
    # (Not exercising _require_setup_ready() here: when status is not ready
    # it pops a real modal QMessageBox.exec(), which would hang forever
    # under a headless/offscreen run with no display to click a button on.)
    status = engine.setup_status()
    assert not status["ready"], "product with no GOOD reference must not be ready"
    assert "not taught" in status["reason"].lower(), status["reason"]
    assert "No product selected" not in inspection.selected_product_panel.name_label.text()
    assert inspection.selected_product_panel.name_label.text() == product["name"]
    assert "Setup Complete" not in inspection.selected_product_panel.status_label.text()
    assert inspection.golden_panel.image_label.text() == "No GOOD reference saved" or \
        not inspection.golden_panel.image_label.pixmap(), (
        "Golden Reference panel must show the empty state until a reference is saved"
    )

    demo_dir = config.DATA_DIR / "test_images_v2_demo"
    reference_path = demo_dir / "v2_demo_reference.png"
    good_path = demo_dir / "v2_demo_good_rotated.png"
    reference_image = cv2.imread(str(reference_path))
    assert reference_image is not None, f"could not read {reference_path}"
    engine.save_good_reference_from_image(reference_image, make_primary=True)

    # GOOD reference saved, still zero regions -> ready (Whole Product Compare).
    status = engine.setup_status()
    assert status["ready"], f"product with a GOOD reference but no regions must be ready: {status}"
    assert status["plan_label"] == "Whole Product Compare"
    assert status["region_count"] == 0
    assert inspection._require_setup_ready(), (
        "_require_setup_ready() must allow inspection once a GOOD reference exists"
    )

    # Add ROIs -> still ready, now Region-Based, and the V2 result carries
    # region_scores/region_summary through to the database/report.
    engine.db.add_region(
        product["id"], angle["id"], "setup_blocking_region_a", config.REGION_TYPE_PRESENCE,
        0.1, 0.1, 0.3, 0.3, sort_order=0,
    )
    status = engine.setup_status()
    assert status["ready"], "adding regions must not make an already-taught product unready"
    assert status["plan_label"] == "Region-Based Inspection"
    assert status["region_count"] == 1

    window.refresh_all()
    assert inspection.selected_product_panel.status_label.text().startswith("✓"), (
        inspection.selected_product_panel.status_label.text()
    )
    assert inspection.selected_product_panel._rows["regions"].text() == "1"
    assert inspection.golden_panel.image_label.pixmap() is not None and \
        not inspection.golden_panel.image_label.pixmap().isNull(), (
        "Golden Reference panel must show the saved reference image once one exists"
    )
    assert inspection.region_plan_panel.list_widget.count() == 1, (
        "Inspection Plan panel must list the staged region definition before any compare runs"
    )

    good_image = cv2.imread(str(good_path))
    assert good_image is not None, f"could not read {good_path}"
    location = engine._require_location()
    inspection_path = location.new_inspection_path()
    cv2.imwrite(str(inspection_path), good_image)
    engine.last_inspection_image_path = inspection_path

    assert inspection._require_setup_ready(), (
        "_require_setup_ready() must allow inspection once regions are also defined"
    )
    inspection._on_compare()
    assert engine.last_comparison_v2 is not None, "compare did not produce a V2 result"
    assert engine.last_comparison_v2.region_scores is not None and \
        len(engine.last_comparison_v2.region_scores) == 1
    inspection._on_save_result()
    inspection_id = engine.last_inspection_id
    assert inspection_id is not None, "result was not saved to the database"

    rows = engine.db.list_inspections(limit=5)
    row = next(r for r in rows if r["id"] == inspection_id)
    assert row.get("region_summary"), f"report row is missing region_summary: {row}"
    print("[smoke_test_ui] setup blocking + panel/report sub-test OK")


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
    _test_setup_blocking(window)
    _test_camera_detail_screen(window)

    print("[smoke_test_ui] OK")


if __name__ == "__main__":
    main()

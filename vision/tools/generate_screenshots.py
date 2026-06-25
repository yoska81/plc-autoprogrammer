"""Headless screenshot generator for the VISION SYSTEM - QC desktop UI.

Drives MainWindow (and the Teach Product wizard) the same way
tools/smoke_test_ui.py does - QT_QPA_PLATFORM=offscreen, no real display,
no .exec()/app.exec() event loop - and saves a .grab() PNG of each key
screen/dialog/wizard-page state to docs/screenshots/, replacing the prior
set (which predates this pass's InspectionScreen/CamerasScreen/Teach
Product wizard redesign). Not part of the automated test suite; run
manually after a UI change to refresh the documentation images:

    QT_QPA_PLATFORM=offscreen python tools/generate_screenshots.py
"""
import os
import sys
import time
from pathlib import Path

import cv2

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PySide6.QtWidgets import QApplication

from core import config
from core.app import get_or_create_angle, get_or_create_product
from ui.main_window import MainWindow
from ui.screens.reports_screen import InspectionDetailDialog
from ui.wizards.teach_product_wizard import (
    PAGE_DEFINE_FEATURES, PAGE_DEFINE_OBJECT, PAGE_FINISH, PAGE_PRODUCT_SETUP,
    PAGE_SAVE_REFERENCES, PAGE_SELECT_CAMERA, PAGE_TEST_INSPECTION, TeachProductWizard,
)

SCREENSHOTS_DIR = Path(__file__).resolve().parent.parent / "docs" / "screenshots"

# Approximate canonical-space (fraction 0..1 of the 480x480 normalized frame)
# rects for the 4 corner screw holes + center ring drawn by
# tools/generate_v2_demo_images.py's _draw_panel() - close enough to the
# real feature positions to look right in a screenshot. Precision testing of
# score_regions() itself lives in tools/test_v2_pose_engine.py, against
# synthetic images built for that purpose - this script only needs a
# plausible illustration, not pixel-exact alignment.
DEMO_REGIONS = [
    ("top_left_hole", 0.06, 0.10, 0.18, 0.26),
    ("top_right_hole", 0.82, 0.10, 0.94, 0.26),
    ("bottom_left_hole", 0.06, 0.74, 0.18, 0.90),
    ("bottom_right_hole", 0.82, 0.74, 0.94, 0.90),
    ("center_ring", 0.38, 0.32, 0.62, 0.68),
]


def _grab(widget, name: str) -> None:
    QApplication.processEvents()
    path = SCREENSHOTS_DIR / name
    widget.grab().save(str(path))
    print(f"[generate_screenshots] wrote {path}")


def _seed_demo_product(window: MainWindow) -> dict:
    """Product+angle+regions+GOOD reference, reused by every screenshot that
    needs a populated Inspection screen. Idempotent against the real
    on-disk database (get_or_create_* + a regions-empty check), matching the
    convention tools/smoke_test_ui.py already uses."""
    engine = window.engine
    engine.set_inspection_mode(config.INSPECTION_MODE_FREE_POSE)

    demo_dir = config.DATA_DIR / "test_images_v2_demo"
    reference_path = demo_dir / "v2_demo_reference.png"
    good_path = demo_dir / "v2_demo_good_rotated.png"
    bad_path = demo_dir / "v2_demo_bad_rotated.png"
    assert reference_path.exists() and good_path.exists() and bad_path.exists(), (
        f"missing V2 demo images at {demo_dir} - run tools/generate_v2_demo_images.py first"
    )

    product = get_or_create_product(engine, "screenshot_demo_product")
    engine.select_product(product["id"])
    angle = get_or_create_angle(engine, product["id"], "front")
    engine.select_angle(angle["id"])
    window.refresh_all()

    if engine.db.get_primary_reference(angle["id"]) is None:
        reference_image = cv2.imread(str(reference_path))
        assert reference_image is not None, f"could not read {reference_path}"
        engine.save_good_reference_from_image(reference_image, make_primary=True)

    if not engine.db.list_regions(product["id"], angle["id"]):
        for index, (name, x0, y0, x1, y1) in enumerate(DEMO_REGIONS):
            engine.db.add_region(
                product["id"], angle["id"], name, config.REGION_TYPE_PRESENCE,
                x0, y0, x1, y1, sort_order=index,
            )

    return {"product": product, "angle": angle, "good_path": good_path, "bad_path": bad_path}


def _run_comparison_against(window: MainWindow, image_path: Path):
    engine = window.engine
    location = engine._require_location()
    inspection_path = location.new_inspection_path()
    image = cv2.imread(str(image_path))
    assert image is not None, f"could not read {image_path}"
    cv2.imwrite(str(inspection_path), image)
    engine.last_inspection_image_path = inspection_path
    result = engine.compute_comparison_v2()
    window.inspection_screen._show_comparison(result)
    return result


def _seed_extra_stations(window: MainWindow) -> None:
    """A couple of additional V2 stations so the Cameras screen actually
    illustrates multi-camera scaling (Tile/List/scale-slider) instead of
    showing just the lone primary station every database always has."""
    engine = window.engine
    demo = _seed_demo_product(window)
    existing_names = {camera["station_name"] for camera in engine.db.list_cameras()}
    for station_name in ("Line 2 - Side Camera", "Line 3 - Top Camera"):
        if station_name in existing_names:
            continue
        engine.camera_manager.add_camera(
            station_name, camera_type=config.CAMERA_TYPE_TEST, device_index=0,
            width=1920, height=1080, fps=10,
            product_id=demo["product"]["id"], angle_id=demo["angle"]["id"],
            inspection_mode=config.INSPECTION_MODE_FREE_POSE, trigger_source=config.TRIGGER_SOURCE_MANUAL,
        )


def _drive_teach_wizard(window: MainWindow) -> None:
    """Scripts the same sequence of operator actions the 7-step Teach
    Product wizard expects, capturing a screenshot at each step - the
    DefineObject/DefineFeatures/TestInspection pages only run for the V2
    Free-Pose product this picks, matching nextId()'s branching."""
    engine = window.engine

    existing = engine.db.get_product_by_name("Demo Bracket (Wizard)")
    if existing is not None:
        engine.db.delete_product(existing["id"])

    wizard = TeachProductWizard(engine, lambda: None, window)
    wizard.resize(900, 720)
    wizard.show()
    wizard.restart()
    _grab(wizard, "teach_wizard_step1_select_camera.png")

    page1 = wizard.currentPage()
    assert wizard.currentId() == PAGE_SELECT_CAMERA
    page1._on_start()
    wizard.next()
    assert wizard.currentId() == PAGE_PRODUCT_SETUP, "wizard step 1 -> 2 failed validation"

    page2 = wizard.currentPage()
    page2.name_edit.setText("Demo Bracket (Wizard)")
    page2.part_number_edit.setText("BRK-1001")
    page2.description_edit.setText("Illustrative product for documentation screenshots.")
    page2.angle_edit.setText("front")
    mode_index = page2.mode_combo.findData(config.INSPECTION_MODE_FREE_POSE)
    page2.mode_combo.setCurrentIndex(mode_index)
    _grab(wizard, "teach_wizard_step2_product_setup.png")
    wizard.next()
    assert wizard.currentId() == PAGE_DEFINE_OBJECT, "wizard step 2 -> 3 failed validation"

    _grab(wizard, "teach_wizard_step3_define_object.png")
    wizard.next()
    assert wizard.currentId() == PAGE_DEFINE_FEATURES, "wizard step 3 -> 4 failed validation"

    page4 = wizard.currentPage()
    wizard.regions = [
        {
            "region_name": name, "region_type": config.REGION_TYPE_PRESENCE,
            "frac_x0": x0, "frac_y0": y0, "frac_x1": x1, "frac_y1": y1,
        }
        for name, x0, y0, x1, y1 in DEMO_REGIONS
    ]
    page4.regions_widget.load_regions(wizard.regions)
    _grab(wizard, "teach_wizard_step4_define_features.png")
    wizard.next()
    assert wizard.currentId() == PAGE_SAVE_REFERENCES, "wizard step 4 -> 5 failed validation"

    page5 = wizard.currentPage()
    page5._on_capture()
    _grab(wizard, "teach_wizard_step5_save_references.png")
    wizard.next()
    assert wizard.currentId() == PAGE_TEST_INSPECTION, "wizard step 5 -> 6 failed validation"

    page6 = wizard.currentPage()
    page6._on_run_test()
    _grab(wizard, "teach_wizard_step6_test_inspection.png")
    wizard.next()
    assert wizard.currentId() == PAGE_FINISH, "wizard step 6 -> 7 failed validation"

    _grab(wizard, "teach_wizard_step7_finish.png")
    wizard.accept()

    if engine.camera_running:
        engine.stop()


def main() -> None:
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    for stale in SCREENSHOTS_DIR.glob("*.png"):
        stale.unlink()

    app = QApplication(sys.argv)
    window = MainWindow(mode="test", device_index=0)
    window.resize(1600, 980)
    window.show()
    QApplication.processEvents()

    demo = _seed_demo_product(window)
    engine = window.engine
    engine.start()
    window.inspection_screen.preview_timer.start()
    window.inspection_screen.live_panel.set_live(True)
    window.inspection_screen.camera_toggle_button.setText("Stop Camera")
    window.refresh_all()
    window.tabs.setCurrentWidget(window.inspection_screen)
    _grab(window, "main_inspection_screen.png")

    good_result = _run_comparison_against(window, demo["good_path"])
    assert good_result.result == config.RESULT_GOOD, f"expected GOOD, got {good_result.result}"
    window.refresh_all()
    _grab(window, "main_inspection_screen_good.png")

    window.inspection_screen.technical_toggle.setChecked(True)
    window.inspection_screen._on_toggle_technical()
    window.inspection_screen.advanced_toggle.setChecked(True)
    window.inspection_screen._on_toggle_advanced()
    _grab(window, "main_inspection_screen_good_technical.png")

    bad_result = _run_comparison_against(window, demo["bad_path"])
    assert bad_result.result == config.RESULT_BAD, f"expected BAD, got {bad_result.result}"
    window.refresh_all()
    _grab(window, "main_inspection_screen_bad_technical.png")

    window.inspection_screen.technical_toggle.setChecked(False)
    window.inspection_screen._on_toggle_technical()
    window.inspection_screen.advanced_toggle.setChecked(False)
    window.inspection_screen._on_toggle_advanced()

    engine.stop()
    window.inspection_screen.preview_timer.stop()
    window.refresh_all()

    _seed_extra_stations(window)
    window.tabs.setCurrentWidget(window.cameras_screen)
    window.cameras_screen.refresh()
    window.cameras_screen._set_view_mode("tile")
    _grab(window, "cameras_screen_tile.png")
    window.cameras_screen._set_view_mode("list")
    _grab(window, "cameras_screen_list.png")
    window.cameras_screen._set_view_mode("tile")

    primary_camera_id = engine.primary_camera_id
    window.cameras_screen._on_open_full_view(primary_camera_id)
    detail_window = window.cameras_screen._detail_windows[primary_camera_id]
    detail_window.resize(1100, 700)
    detail_window.refresh()
    _grab(detail_window, "camera_detail_screen.png")
    detail_window.close()

    window.tabs.setCurrentWidget(window.reports_screen)
    window.reports_screen.refresh()
    _grab(window, "reports_screen.png")
    if window.reports_screen.history_table.rowCount() > 0:
        window.reports_screen.history_table.selectRow(0)
        inspection_id = window.reports_screen.history_table.selected_row_id()
        detail = engine.db.get_inspection_detail(inspection_id)
        if detail is not None:
            dialog = InspectionDetailDialog(detail, window)
            dialog.resize(440, 360)
            dialog.show()
            _grab(dialog, "reports_view_details_dialog.png")
            dialog.close()

    window.tabs.setCurrentWidget(window.products_screen)
    window.products_screen.refresh()
    _grab(window, "products_screen.png")

    window.tabs.setCurrentWidget(window.references_screen)
    window.references_screen.refresh()
    _grab(window, "references_screen.png")

    window.tabs.setCurrentWidget(window.settings_screen)
    window.settings_screen.refresh()
    _grab(window, "settings_screen.png")

    window.tabs.setCurrentWidget(window.inspection_screen)
    _drive_teach_wizard(window)

    window.close()
    print(f"[generate_screenshots] OK - {len(list(SCREENSHOTS_DIR.glob('*.png')))} screenshots in {SCREENSHOTS_DIR}")


if __name__ == "__main__":
    main()

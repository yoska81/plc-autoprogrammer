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

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PySide6.QtWidgets import QApplication

from core import reports
from core.app import get_or_create_angle, get_or_create_product
from ui.main_window import MainWindow


def main() -> None:
    app = QApplication(sys.argv)
    window = MainWindow(mode="test", device_index=0)
    engine = window.engine
    inspection = window.inspection_screen

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

    print("[smoke_test_ui] OK")


if __name__ == "__main__":
    main()

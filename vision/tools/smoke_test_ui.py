"""Headless smoke test for the VISION SYSTEM - QC desktop UI.

Drives MainWindow directly (no .show(), no app.exec()) so it runs under
QT_QPA_PLATFORM=offscreen with no display - used locally and in CI (the
Windows GitHub Actions build) before packaging the .exe, as a basic
regression check that test-image mode, capture, compare, and save-result
still work end to end. Exits non-zero (via an uncaught AssertionError) on
failure.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PySide6.QtWidgets import QApplication

from ui.main_window import MainWindow


def main() -> None:
    app = QApplication(sys.argv)
    window = MainWindow(mode="test", device_index=0)

    window._on_start_camera()
    assert window.camera_running, "camera did not start in test mode"
    window._update_live_preview()

    window.engine.select_product_angle("smoke_test_product", "front")
    window._refresh_status()
    assert window.engine.location is not None, "product/angle was not selected"

    window._on_save_reference()
    assert window.engine.location.reference_path.exists(), "GOOD reference was not saved"

    window._on_take_inspection()
    assert window.engine.location.inspection_path.exists(), "inspection image was not captured"

    window._on_compare()
    assert window.engine.last_result is not None, "compare did not produce a result"

    window._on_save_result()

    window._on_stop_camera()
    assert not window.camera_running, "camera did not stop"

    print("[smoke_test_ui] OK")


if __name__ == "__main__":
    main()

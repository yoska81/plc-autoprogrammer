import argparse
import sys

from PySide6.QtWidgets import QApplication

from core import config
from core.camera.real_camera import probe_camera_indices

from .main_window import MainWindow


def main() -> None:
    parser = argparse.ArgumentParser(description="VISION SYSTEM - QC: Windows PC desktop UI")
    parser.add_argument("--mode", choices=["auto", "real", "test"], default=config.DEFAULT_CAMERA_MODE)
    parser.add_argument("--device-index", type=int, default=config.DEFAULT_DEVICE_INDEX)
    parser.add_argument(
        "--probe-cameras", action="store_true",
        help="list which camera device indices (0, 1, 2) respond, then exit without opening the UI",
    )
    args = parser.parse_args()

    if args.probe_cameras:
        for index, available in probe_camera_indices([0, 1, 2]).items():
            print(f"[vision] device index {index}: {'AVAILABLE' if available else 'not found'}")
        return

    app = QApplication(sys.argv)
    window = MainWindow(mode=args.mode, device_index=args.device_index)
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()

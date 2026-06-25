import argparse
import sys

from PySide6.QtWidgets import QApplication

from core import config

from .main_window import MainWindow


def main() -> None:
    parser = argparse.ArgumentParser(description="PLC Autoprogrammer - Vision QC desktop UI")
    parser.add_argument("--mode", choices=["auto", "real", "test"], default=config.DEFAULT_CAMERA_MODE)
    parser.add_argument("--device-index", type=int, default=config.DEFAULT_DEVICE_INDEX)
    args = parser.parse_args()

    app = QApplication(sys.argv)
    window = MainWindow(mode=args.mode, device_index=args.device_index)
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()

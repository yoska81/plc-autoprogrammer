from datetime import datetime

from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QFrame, QHBoxLayout, QLabel, QMainWindow, QTabWidget, QVBoxLayout, QWidget

from core.app import QCApp

from .screens.camera_setup_screen import CameraSetupScreen
from .screens.cameras_screen import CamerasScreen
from .screens.inspection_screen import InspectionScreen
from .screens.products_screen import ProductsScreen
from .screens.references_screen import ReferencesScreen
from .screens.reports_screen import ReportsScreen
from .screens.settings_screen import SettingsScreen
from .styles import TESLA_STYLE

CLOCK_INTERVAL_MS = 1000


class MainWindow(QMainWindow):
    """Tabbed shell hosting the 6 screens, all sharing one QCApp engine.
    Each screen calls `on_change` after an action that other screens'
    displayed state depends on (product/angle selection, camera state,
    settings, etc.) so this window can refresh every tab in step."""

    def __init__(self, mode: str = "auto", device_index: int = 0):
        super().__init__()
        self.setWindowTitle("VISION SYSTEM — QC")
        self.setStyleSheet(TESLA_STYLE)
        self.resize(1600, 980)

        self.engine = QCApp(mode=mode, device_index=device_index)

        central = QWidget()
        central_layout = QVBoxLayout(central)
        central_layout.setContentsMargins(0, 0, 0, 0)
        central_layout.setSpacing(0)
        central_layout.addWidget(self._build_top_bar())

        self.tabs = QTabWidget()
        self.tabs.setDocumentMode(True)
        central_layout.addWidget(self.tabs)
        self.setCentralWidget(central)

        self.inspection_screen = InspectionScreen(
            self.engine, self.refresh_all, self._switch_to_settings, self._switch_to_reports)
        self.camera_setup_screen = CameraSetupScreen(self.engine, self.refresh_all)
        self.cameras_screen = CamerasScreen(self.engine, self.refresh_all)
        self.products_screen = ProductsScreen(self.engine, self.refresh_all)
        self.references_screen = ReferencesScreen(self.engine, self.refresh_all)
        self.reports_screen = ReportsScreen(self.engine, self.refresh_all)
        self.settings_screen = SettingsScreen(self.engine, self.refresh_all, self._switch_to_camera_setup)

        self.tabs.addTab(self.inspection_screen, "Inspection")
        self.tabs.addTab(self.camera_setup_screen, "Camera Setup")
        self.tabs.addTab(self.cameras_screen, "Cameras / Stations")
        self.tabs.addTab(self.products_screen, "Products")
        self.tabs.addTab(self.references_screen, "References")
        self.tabs.addTab(self.reports_screen, "Reports")
        self.tabs.addTab(self.settings_screen, "Settings")

        self.status_timer = QTimer(self)
        self.status_timer.setInterval(CLOCK_INTERVAL_MS)
        self.status_timer.timeout.connect(self._update_top_bar)
        self.status_timer.start()
        self._update_top_bar()

    def _build_top_bar(self) -> QFrame:
        bar = QFrame()
        bar.setObjectName("topBar")
        layout = QHBoxLayout(bar)
        layout.setContentsMargins(24, 14, 24, 14)
        layout.setSpacing(28)

        title = QLabel("VISION SYSTEM — QC")
        title.setObjectName("appTitle")
        layout.addWidget(title)
        layout.addStretch()

        self.camera_status_dot = QLabel("●")
        self.camera_status_label = QLabel("CAMERA: STOPPED")
        self.camera_status_label.setObjectName("topBarStatus")
        layout.addWidget(self.camera_status_dot)
        layout.addWidget(self.camera_status_label)

        self.comm_status_dot = QLabel("●")
        self.comm_status_label = QLabel("COMM: —")
        self.comm_status_label.setObjectName("topBarStatus")
        layout.addWidget(self.comm_status_dot)
        layout.addWidget(self.comm_status_label)

        self.clock_label = QLabel("—")
        self.clock_label.setObjectName("clockLabel")
        layout.addWidget(self.clock_label)

        return bar

    def _update_top_bar(self) -> None:
        self.clock_label.setText(datetime.now().strftime("%Y-%m-%d  %H:%M:%S"))

        running = self.engine.camera_running
        self.camera_status_label.setText(f"CAMERA: {'LIVE' if running else 'STOPPED'}")
        self.camera_status_dot.setObjectName("statusDotGood" if running else "statusDotBad")
        self.camera_status_dot.style().unpolish(self.camera_status_dot)
        self.camera_status_dot.style().polish(self.camera_status_dot)

        comm = self.engine.get_machine_status()
        self.comm_status_label.setText(f"COMM: {comm.upper()}")
        comm_ok = "connect" in comm.lower() or "simulat" in comm.lower()
        self.comm_status_dot.setObjectName("statusDotGood" if comm_ok else "statusDotWarn")
        self.comm_status_dot.style().unpolish(self.comm_status_dot)
        self.comm_status_dot.style().polish(self.comm_status_dot)

    def _switch_to_settings(self) -> None:
        self.tabs.setCurrentWidget(self.settings_screen)

    def _switch_to_reports(self) -> None:
        self.tabs.setCurrentWidget(self.reports_screen)

    def _switch_to_camera_setup(self) -> None:
        self.tabs.setCurrentWidget(self.camera_setup_screen)

    def refresh_all(self) -> None:
        self.inspection_screen.refresh()
        self.camera_setup_screen.refresh()
        self.cameras_screen.refresh()
        self.products_screen.refresh()
        self.references_screen.refresh()
        self.reports_screen.refresh()
        self.settings_screen.refresh()
        self._update_top_bar()

    def closeEvent(self, event) -> None:
        self.status_timer.stop()
        self.inspection_screen.shutdown()
        self.camera_setup_screen.shutdown()
        self.cameras_screen.shutdown()
        self.engine.camera_manager.stop_all()
        event.accept()

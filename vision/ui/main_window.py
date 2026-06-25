from PySide6.QtWidgets import QMainWindow, QTabWidget

from core.app import QCApp

from .screens.camera_setup_screen import CameraSetupScreen
from .screens.inspection_screen import InspectionScreen
from .screens.products_screen import ProductsScreen
from .screens.references_screen import ReferencesScreen
from .screens.reports_screen import ReportsScreen
from .screens.settings_screen import SettingsScreen
from .styles import TESLA_STYLE


class MainWindow(QMainWindow):
    """Tabbed shell hosting the 6 screens, all sharing one QCApp engine.
    Each screen calls `on_change` after an action that other screens'
    displayed state depends on (product/angle selection, camera state,
    settings, etc.) so this window can refresh every tab in step."""

    def __init__(self, mode: str = "auto", device_index: int = 0):
        super().__init__()
        self.setWindowTitle("VISION SYSTEM — QC")
        self.setStyleSheet(TESLA_STYLE)
        self.resize(1280, 860)

        self.engine = QCApp(mode=mode, device_index=device_index)

        self.tabs = QTabWidget()
        self.setCentralWidget(self.tabs)

        self.inspection_screen = InspectionScreen(self.engine, self.refresh_all, self._switch_to_settings)
        self.camera_setup_screen = CameraSetupScreen(self.engine, self.refresh_all)
        self.products_screen = ProductsScreen(self.engine, self.refresh_all)
        self.references_screen = ReferencesScreen(self.engine, self.refresh_all)
        self.reports_screen = ReportsScreen(self.engine, self.refresh_all)
        self.settings_screen = SettingsScreen(self.engine, self.refresh_all)

        self.tabs.addTab(self.inspection_screen, "Inspection")
        self.tabs.addTab(self.camera_setup_screen, "Camera Setup")
        self.tabs.addTab(self.products_screen, "Products")
        self.tabs.addTab(self.references_screen, "References")
        self.tabs.addTab(self.reports_screen, "Reports")
        self.tabs.addTab(self.settings_screen, "Settings")

    def _switch_to_settings(self) -> None:
        self.tabs.setCurrentWidget(self.settings_screen)

    def refresh_all(self) -> None:
        self.inspection_screen.refresh()
        self.camera_setup_screen.refresh()
        self.products_screen.refresh()
        self.references_screen.refresh()
        self.reports_screen.refresh()
        self.settings_screen.refresh()

    def closeEvent(self, event) -> None:
        self.inspection_screen.shutdown()
        self.camera_setup_screen.shutdown()
        if self.engine.camera_running:
            self.engine.stop()
        event.accept()

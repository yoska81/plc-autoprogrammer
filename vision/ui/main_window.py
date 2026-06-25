import shutil
from datetime import datetime

from PySide6.QtCore import Qt, QTimer, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QFileDialog, QFrame, QGridLayout, QHBoxLayout, QLabel, QMainWindow,
    QMessageBox, QPushButton, QVBoxLayout, QWidget,
)

from core import config
from core.app import QCApp
from core.results_store import fetch_recent_results

from .dialogs import SelectProductAngleDialog, SettingsDialog, prompt_text
from .styles import TESLA_STYLE
from .widgets import HistoryTable, ImagePreviewPanel, ResultBadge

LIVE_PREVIEW_INTERVAL_MS = 200


class MainWindow(QMainWindow):
    def __init__(self, mode: str = "auto", device_index: int = 0):
        super().__init__()
        self.setWindowTitle("VISION SYSTEM — QC")
        self.setStyleSheet(TESLA_STYLE)
        self.resize(1180, 820)

        self.engine = QCApp(mode=mode, device_index=device_index)
        self.camera_running = False
        self.last_inspection_time: str | None = None

        self._build_ui()
        self._refresh_status()
        self._refresh_history()

        self.preview_timer = QTimer(self)
        self.preview_timer.setInterval(LIVE_PREVIEW_INTERVAL_MS)
        self.preview_timer.timeout.connect(self._update_live_preview)

    # ------------------------------------------------------------------ UI

    def _build_ui(self) -> None:
        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(24, 16, 24, 16)
        root.setSpacing(16)

        header = QFrame()
        header.setObjectName("headerBar")
        header_layout = QHBoxLayout(header)
        title = QLabel("VISION SYSTEM")
        title.setObjectName("appTitle")
        header_layout.addWidget(title)
        header_layout.addStretch()
        root.addWidget(header)

        previews_row = QHBoxLayout()
        self.live_panel = ImagePreviewPanel("Camera / Test Feed")
        self.reference_panel = ImagePreviewPanel("Good Reference")
        self.inspection_panel = ImagePreviewPanel("Inspection Image")
        previews_row.addWidget(self.live_panel)
        previews_row.addWidget(self.reference_panel)
        previews_row.addWidget(self.inspection_panel)
        root.addLayout(previews_row)

        info_row = QHBoxLayout()

        info_col = QVBoxLayout()
        self.product_label = QLabel("PRODUCT: —")
        self.angle_label = QLabel("ANGLE: —")
        self.last_inspection_label = QLabel("LAST INSPECTION: —")
        for label in (self.product_label, self.angle_label, self.last_inspection_label):
            label.setObjectName("infoLabel")
            info_col.addWidget(label)
        info_col.addStretch()
        info_row.addLayout(info_col, stretch=1)

        result_col = QVBoxLayout()
        self.result_badge = ResultBadge()
        self.score_label = QLabel("SCORE: —")
        self.score_label.setObjectName("scoreLabel")
        self.score_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        result_col.addWidget(self.result_badge, alignment=Qt.AlignmentFlag.AlignCenter)
        result_col.addWidget(self.score_label, alignment=Qt.AlignmentFlag.AlignCenter)
        info_row.addLayout(result_col, stretch=2)

        root.addLayout(info_row)

        history_title = QLabel("INSPECTION HISTORY")
        history_title.setObjectName("sectionTitle")
        root.addWidget(history_title)
        self.history_table = HistoryTable()
        self.history_table.setFixedHeight(160)
        root.addWidget(self.history_table)

        root.addLayout(self._build_button_grid())

    def _build_button_grid(self) -> QGridLayout:
        button_defs = [
            ("Start Camera", self._on_start_camera),
            ("Stop Camera", self._on_stop_camera),
            ("Add Product", self._on_add_product),
            ("Select Product", self._on_select_product),
            ("Add Angle", self._on_add_angle),
            ("Save GOOD Reference", self._on_save_reference),
            ("Take Inspection Picture", self._on_take_inspection),
            ("Compare", self._on_compare),
            ("Save Result", self._on_save_result),
            ("Open Bad Products Folder", self._on_open_bad_products),
            ("Export Report", self._on_export_report),
            ("Settings", self._on_settings),
        ]
        columns = 6
        grid = QGridLayout()
        grid.setSpacing(10)
        for i, (label, handler) in enumerate(button_defs):
            button = QPushButton(label)
            button.clicked.connect(handler)
            grid.addWidget(button, i // columns, i % columns)
        return grid

    # --------------------------------------------------------------- camera

    def _on_start_camera(self) -> None:
        if self.camera_running:
            return
        try:
            self.engine.start()
        except Exception as exc:
            QMessageBox.warning(self, "Camera", str(exc))
            return
        self.camera_running = True
        self.preview_timer.start()

    def _on_stop_camera(self) -> None:
        if not self.camera_running:
            return
        self.preview_timer.stop()
        self.engine.stop()
        self.camera_running = False
        self.live_panel.clear()

    def _update_live_preview(self) -> None:
        try:
            frame = self.engine.camera.read_frame()
        except Exception:
            return
        self.live_panel.set_frame(frame)

    def _require_camera_and_location(self) -> bool:
        if not self.camera_running:
            QMessageBox.warning(self, "Camera", "Start the camera first.")
            return False
        if self.engine.location is None:
            QMessageBox.warning(self, "Product / Angle", "Select or add a product/angle first.")
            return False
        return True

    # ------------------------------------------------------- product/angle

    def _on_add_product(self) -> None:
        product = prompt_text(self, "Add Product", "Product name:")
        if not product:
            return
        angle = prompt_text(self, "Add Product", "First angle name for this product:")
        if not angle:
            return
        self.engine.select_product_angle(product, angle)
        self._refresh_status()

    def _on_select_product(self) -> None:
        dialog = SelectProductAngleDialog(self)
        if dialog.exec() == SelectProductAngleDialog.DialogCode.Accepted and dialog.selected_product:
            self.engine.select_product_angle(dialog.selected_product, dialog.selected_angle)
            self._refresh_status()

    def _on_add_angle(self) -> None:
        if self.engine.location is None:
            QMessageBox.warning(self, "Add Angle", "Select or add a product first.")
            return
        angle = prompt_text(self, "Add Angle", "New angle name:")
        if not angle:
            return
        self.engine.select_product_angle(self.engine.location.product, angle)
        self._refresh_status()

    # ----------------------------------------------------------- capture

    def _on_save_reference(self) -> None:
        if not self._require_camera_and_location():
            return
        try:
            self.engine.save_good_reference()
        except Exception as exc:
            QMessageBox.warning(self, "Save GOOD Reference", str(exc))
            return
        self.reference_panel.set_image_path(self.engine.location.reference_path)

    def _on_take_inspection(self) -> None:
        if not self._require_camera_and_location():
            return
        try:
            self.engine.capture_inspection_image()
        except Exception as exc:
            QMessageBox.warning(self, "Take Inspection Picture", str(exc))
            return
        self.inspection_panel.set_image_path(self.engine.location.inspection_path)
        self.last_inspection_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self._refresh_status()

    def _on_compare(self) -> None:
        if self.engine.location is None:
            QMessageBox.warning(self, "Compare", "Select or add a product/angle first.")
            return
        comparison = self.engine.compute_comparison()
        if comparison is None:
            QMessageBox.warning(self, "Compare", "Make sure a GOOD reference and an inspection image exist.")
            return
        self.result_badge.set_state(comparison.result)
        self.score_label.setText(f"SCORE: {comparison.score_percent:.2f}%")

    def _on_save_result(self) -> None:
        if self.engine.last_result is None:
            QMessageBox.warning(self, "Save Result", "Run Compare first.")
            return
        self.engine.persist_last_result()
        self._refresh_history()

    # ------------------------------------------------------------ utility

    def _on_open_bad_products(self) -> None:
        folder = self.engine.location.bad_products_dir if self.engine.location else config.BAD_PRODUCTS_DIR
        folder.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(folder)))

    def _on_export_report(self) -> None:
        if not config.RESULTS_CSV_PATH.exists():
            QMessageBox.information(self, "Export Report", "No results logged yet.")
            return
        target, _ = QFileDialog.getSaveFileName(self, "Export Report", "vision_report.csv", "CSV files (*.csv)")
        if not target:
            return
        shutil.copy2(config.RESULTS_CSV_PATH, target)
        QMessageBox.information(self, "Export Report", f"Report exported to {target}")

    def _on_settings(self) -> None:
        dialog = SettingsDialog(self.engine.mode, self.engine.device_index, self.engine.threshold_percent, self)
        if dialog.exec() != SettingsDialog.DialogCode.Accepted:
            return
        mode, device_index, threshold = dialog.values()
        self.engine.threshold_percent = threshold
        if mode != self.engine.mode or device_index != self.engine.device_index:
            was_running = self.camera_running
            if was_running:
                self._on_stop_camera()
            self.engine.reconfigure_camera(mode, device_index)
            if was_running:
                self._on_start_camera()

    # ------------------------------------------------------------ refresh

    def _refresh_status(self) -> None:
        location = self.engine.location
        self.product_label.setText(f"PRODUCT: {location.product if location else '—'}")
        self.angle_label.setText(f"ANGLE: {location.angle if location else '—'}")
        self.last_inspection_label.setText(f"LAST INSPECTION: {self.last_inspection_time or '—'}")

        if location and location.reference_path.exists():
            self.reference_panel.set_image_path(location.reference_path)
        else:
            self.reference_panel.clear()

        if location and location.inspection_path.exists():
            self.inspection_panel.set_image_path(location.inspection_path)
        else:
            self.inspection_panel.clear()

    def _refresh_history(self) -> None:
        rows = fetch_recent_results(config.RESULTS_DB_PATH, limit=20)
        self.history_table.set_rows(rows)

    def closeEvent(self, event) -> None:
        if self.camera_running:
            self.engine.stop()
        event.accept()

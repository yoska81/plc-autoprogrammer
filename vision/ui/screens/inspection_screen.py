from datetime import datetime

from PySide6.QtCore import Qt, QTimer, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QFileDialog, QGridLayout, QHBoxLayout, QLabel, QMessageBox, QPushButton,
    QVBoxLayout, QWidget,
)

from core import config, reports
from core.app import QCApp

from ..dialogs import SelectProductAngleDialog, prompt_text
from ..widgets import HistoryTable, ImagePreviewPanel, ResultBadge

LIVE_PREVIEW_INTERVAL_MS = 200


class InspectionScreen(QWidget):
    """Main Inspection screen: live feed, GOOD/inspection/diff previews, the
    GOOD/BAD result, product/angle controls, and the Machine Signal
    Interface's communication/trigger status."""

    def __init__(self, engine: QCApp, on_change, switch_to_settings, parent=None):
        super().__init__(parent)
        self.engine = engine
        self.on_change = on_change
        self.switch_to_settings = switch_to_settings
        self.last_inspection_time: str | None = None

        self._build_ui()
        self.preview_timer = QTimer(self)
        self.preview_timer.setInterval(LIVE_PREVIEW_INTERVAL_MS)
        self.preview_timer.timeout.connect(self._update_live_preview)

        self.refresh()

    # ------------------------------------------------------------------ UI

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(24, 16, 24, 16)
        root.setSpacing(16)

        previews_row = QHBoxLayout()
        self.live_panel = ImagePreviewPanel("Camera / Test Feed")
        self.reference_panel = ImagePreviewPanel("Good Reference")
        self.inspection_panel = ImagePreviewPanel("Inspection Image")
        self.diff_panel = ImagePreviewPanel("Difference")
        for panel in (self.live_panel, self.reference_panel, self.inspection_panel, self.diff_panel):
            previews_row.addWidget(panel)
        root.addLayout(previews_row)

        info_row = QHBoxLayout()
        info_col = QVBoxLayout()
        self.product_label = QLabel("PRODUCT: —")
        self.angle_label = QLabel("ANGLE: —")
        self.camera_label = QLabel("CAMERA: —")
        self.threshold_label = QLabel("THRESHOLD: —")
        self.last_inspection_label = QLabel("LAST INSPECTION: —")
        self.comm_status_label = QLabel("COMMUNICATION: —")
        self.trigger_status_label = QLabel("TRIGGER: Waiting")
        for label in (
            self.product_label, self.angle_label, self.camera_label, self.threshold_label,
            self.last_inspection_label, self.comm_status_label, self.trigger_status_label,
        ):
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
        trigger_button = QPushButton("Simulate PLC Trigger")
        trigger_button.clicked.connect(self._on_simulate_trigger)
        result_col.addWidget(trigger_button, alignment=Qt.AlignmentFlag.AlignCenter)
        info_row.addLayout(result_col, stretch=2)
        root.addLayout(info_row)

        history_title = QLabel("RECENT INSPECTIONS")
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
        if self.engine.camera_running:
            return
        try:
            self.engine.start()
        except Exception as exc:
            QMessageBox.warning(self, "Camera", str(exc))
            return
        self.preview_timer.start()
        self.on_change()

    def _on_stop_camera(self) -> None:
        if not self.engine.camera_running:
            return
        self.preview_timer.stop()
        self.engine.stop()
        self.live_panel.clear()
        self.on_change()

    def _update_live_preview(self) -> None:
        try:
            frame = self.engine.camera.read_frame()
        except Exception:
            return
        self.live_panel.set_frame(frame)

    def _require_camera_and_location(self) -> bool:
        if not self.engine.camera_running:
            QMessageBox.warning(self, "Camera", "Start the camera first.")
            return False
        if self.engine.location is None:
            QMessageBox.warning(self, "Product / Angle", "Select or add a product/angle first.")
            return False
        return True

    # ------------------------------------------------------- product/angle

    def _on_add_product(self) -> None:
        name = prompt_text(self, "Add Product", "Product name:")
        if not name:
            return
        product_id = self.engine.db.create_product(name)
        self.engine.select_product(product_id)
        angle = prompt_text(self, "Add Product", "First angle name for this product:")
        if angle:
            angle_id = self.engine.db.create_angle(product_id, angle)
            self.engine.select_angle(angle_id)
        self.on_change()

    def _on_select_product(self) -> None:
        dialog = SelectProductAngleDialog(self.engine.db, self)
        if dialog.exec() == SelectProductAngleDialog.DialogCode.Accepted and dialog.selected_angle_id:
            self.engine.select_angle(dialog.selected_angle_id)
            self.on_change()

    def _on_add_angle(self) -> None:
        if self.engine.current_product is None:
            QMessageBox.warning(self, "Add Angle", "Select or add a product first.")
            return
        name = prompt_text(self, "Add Angle", "New angle name:")
        if not name:
            return
        angle_id = self.engine.db.create_angle(self.engine.current_product["id"], name)
        self.engine.select_angle(angle_id)
        self.on_change()

    # ----------------------------------------------------------- capture

    def _on_save_reference(self) -> None:
        if not self._require_camera_and_location():
            return
        try:
            self.engine.save_good_reference()
        except Exception as exc:
            QMessageBox.warning(self, "Save GOOD Reference", str(exc))
            return
        self.on_change()

    def _on_take_inspection(self) -> None:
        if not self._require_camera_and_location():
            return
        try:
            self.engine.capture_inspection_image()
        except Exception as exc:
            QMessageBox.warning(self, "Take Inspection Picture", str(exc))
            return
        self.last_inspection_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.on_change()

    def _on_compare(self) -> None:
        if self.engine.location is None:
            QMessageBox.warning(self, "Compare", "Select or add a product/angle first.")
            return
        try:
            comparison = self.engine.compute_comparison()
        except RuntimeError as exc:
            QMessageBox.warning(self, "Compare", str(exc))
            return
        self.result_badge.set_state(comparison.result)
        self.score_label.setText(f"SCORE: {comparison.score_percent:.2f}%")
        self.diff_panel.set_image_path(comparison.diff_image_path)

    def _on_save_result(self) -> None:
        if self.engine.last_comparison is None:
            QMessageBox.warning(self, "Save Result", "Run Compare first.")
            return
        self.engine.save_result(trigger_source="manual")
        self.on_change()

    def _on_simulate_trigger(self) -> None:
        """Stands in for a future real PLC pulse - see machine_interface/."""
        self.trigger_status_label.setText("TRIGGER: Trigger Received")
        self.engine.fire_trigger()
        if self.engine.location is None or not self.engine.camera_running:
            self.trigger_status_label.setText("TRIGGER: Waiting")
            QMessageBox.warning(self, "Simulate PLC Trigger",
                                 "Start the camera and select a product/angle first.")
            return
        self.trigger_status_label.setText("TRIGGER: Inspecting")
        try:
            comparison = self.engine.poll_trigger_and_inspect(trigger_source="plc_simulated")
        except RuntimeError as exc:
            self.trigger_status_label.setText("TRIGGER: Waiting")
            QMessageBox.warning(self, "Simulate PLC Trigger", str(exc))
            return
        if comparison is None:
            self.trigger_status_label.setText("TRIGGER: Waiting")
            return
        self.trigger_status_label.setText("TRIGGER: Complete")
        self.result_badge.set_state(comparison.result)
        self.score_label.setText(f"SCORE: {comparison.score_percent:.2f}%")
        self.diff_panel.set_image_path(comparison.diff_image_path)
        self.last_inspection_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.on_change()

    # ------------------------------------------------------------ utility

    def _on_open_bad_products(self) -> None:
        folder = self.engine.location.bad_products_dir if self.engine.location else config.BAD_PRODUCTS_DIR
        folder.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(folder)))

    def _on_export_report(self) -> None:
        target, _ = QFileDialog.getSaveFileName(self, "Export Report", "vision_report.csv", "CSV files (*.csv)")
        if not target:
            return
        reports.export_csv(self.engine.db, target)
        QMessageBox.information(self, "Export Report", f"Report exported to {target}")

    def _on_settings(self) -> None:
        self.switch_to_settings()

    # ------------------------------------------------------------ refresh

    def refresh(self) -> None:
        location = self.engine.location
        self.product_label.setText(f"PRODUCT: {location.product if location else '—'}")
        self.angle_label.setText(f"ANGLE: {location.angle if location else '—'}")
        self.camera_label.setText(f"CAMERA: {self.engine.mode} (index {self.engine.device_index})")
        self.threshold_label.setText(f"THRESHOLD: {self.engine.threshold_percent:.1f}%")
        self.last_inspection_label.setText(f"LAST INSPECTION: {self.last_inspection_time or '—'}")
        self.comm_status_label.setText(f"COMMUNICATION: {self.engine.get_machine_status()}")

        if self.engine.current_angle:
            primary = self.engine.db.get_primary_reference(self.engine.current_angle["id"])
            self.reference_panel.set_image_path(primary["image_path"]) if primary else self.reference_panel.clear()
        else:
            self.reference_panel.clear()

        if self.engine.last_inspection_image_path and self.engine.last_inspection_image_path.exists():
            self.inspection_panel.set_image_path(self.engine.last_inspection_image_path)
        else:
            self.inspection_panel.clear()

        self.history_table.set_rows(self.engine.db.list_inspections(limit=20))

    def shutdown(self) -> None:
        if self.engine.camera_running:
            self.preview_timer.stop()
            self.engine.stop()

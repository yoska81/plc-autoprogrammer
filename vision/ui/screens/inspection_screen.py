from datetime import datetime

from PySide6.QtCore import Qt, QTimer, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QFrame, QHBoxLayout, QLabel, QMessageBox, QPushButton, QVBoxLayout, QWidget,
)

from core import config
from core.app import NoProductDecisionRequired, QCApp
from core.compare_v2 import V2ComparisonResult

from ..dialogs import SelectProductAngleDialog, prompt_text
from ..widgets import CountersPanel, ImagePreviewPanel, ResultPanel

LIVE_PREVIEW_INTERVAL_MS = 200


class InspectionScreen(QWidget):
    """Main Inspection screen: a large live camera feed, secondary GOOD
    reference/inspection/diff previews, a large GOOD/BAD result readable
    from a distance, a product/angle/machine-signal sidebar, and a big
    bottom action bar. Buttons map directly onto the `QCApp` engine - the
    UI adds no new comparison or capture logic."""

    def __init__(self, engine: QCApp, on_change, switch_to_settings, switch_to_reports=None, parent=None):
        super().__init__(parent)
        self.engine = engine
        self.on_change = on_change
        self.switch_to_settings = switch_to_settings
        self.switch_to_reports = switch_to_reports
        self.last_inspection_time: str | None = None

        self._build_ui()
        self.preview_timer = QTimer(self)
        self.preview_timer.setInterval(LIVE_PREVIEW_INTERVAL_MS)
        self.preview_timer.timeout.connect(self._update_live_preview)

        self.refresh()

    # ------------------------------------------------------------------ UI

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(24, 20, 24, 20)
        root.setSpacing(18)

        content_row = QHBoxLayout()
        content_row.setSpacing(18)
        content_row.addWidget(self._build_sidebar())
        content_row.addLayout(self._build_main_column(), stretch=1)
        root.addLayout(content_row, stretch=1)

        root.addLayout(self._build_button_bar())

    def _build_sidebar(self) -> QFrame:
        sidebar = QFrame()
        sidebar.setObjectName("panelCard")
        sidebar.setFixedWidth(300)
        layout = QVBoxLayout(sidebar)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(6)

        layout.addWidget(self._section_title("STATUS"))

        self.product_label = QLabel("—")
        self.product_label.setObjectName("infoValue")
        self.product_label.setWordWrap(True)
        layout.addWidget(self._status_row("Product", self.product_label))

        self.part_number_label = QLabel("—")
        self.part_number_label.setObjectName("infoLabel")
        layout.addWidget(self._status_row("Part Number", self.part_number_label))

        self.angle_label = QLabel("—")
        self.angle_label.setObjectName("infoLabel")
        layout.addWidget(self._status_row("Angle", self.angle_label))

        self.camera_label = QLabel("—")
        self.camera_label.setObjectName("infoLabel")
        layout.addWidget(self._status_row("Camera Mode", self.camera_label))

        self.comm_status_label = QLabel("—")
        self.comm_status_label.setObjectName("infoLabel")
        layout.addWidget(self._status_row("Machine Signal", self.comm_status_label))

        self.detection_label = QLabel("—")
        self.detection_label.setObjectName("infoLabel")
        layout.addWidget(self._status_row("Product Detection", self.detection_label))

        self.last_inspection_label = QLabel("—")
        self.last_inspection_label.setObjectName("infoLabel")
        self.last_inspection_label.setWordWrap(True)
        layout.addWidget(self._status_row("Last Inspection", self.last_inspection_label))

        layout.addSpacing(10)
        self.trigger_status_label = QLabel("TRIGGER: Waiting")
        self.trigger_status_label.setObjectName("infoLabel")
        layout.addWidget(self.trigger_status_label)
        trigger_button = QPushButton("Simulate PLC Trigger")
        trigger_button.setObjectName("secondaryActionButton")
        trigger_button.clicked.connect(self._on_simulate_trigger)
        layout.addWidget(trigger_button)

        layout.addSpacing(10)
        layout.addWidget(self._section_title("V2 ENGINE"))
        self.best_match_label = QLabel("—")
        self.best_match_label.setObjectName("infoLabel")
        self.best_match_label.setWordWrap(True)
        layout.addWidget(self._status_row("Best Match", self.best_match_label))
        auto_match_button = QPushButton("Auto Match Reference")
        auto_match_button.setObjectName("secondaryActionButton")
        auto_match_button.clicked.connect(self._on_auto_match_reference)
        layout.addWidget(auto_match_button)

        layout.addStretch()

        layout.addWidget(self._section_title("PRODUCT SETUP"))
        select_button = QPushButton("Select Product")
        select_button.setObjectName("secondaryActionButton")
        select_button.clicked.connect(self._on_select_product)
        layout.addWidget(select_button)
        add_product_button = QPushButton("Add Product")
        add_product_button.setObjectName("secondaryActionButton")
        add_product_button.clicked.connect(self._on_add_product)
        layout.addWidget(add_product_button)
        add_angle_button = QPushButton("Add Angle")
        add_angle_button.setObjectName("secondaryActionButton")
        add_angle_button.clicked.connect(self._on_add_angle)
        layout.addWidget(add_angle_button)
        bad_folder_button = QPushButton("Open Bad Products Folder")
        bad_folder_button.setObjectName("secondaryActionButton")
        bad_folder_button.clicked.connect(self._on_open_bad_products)
        layout.addWidget(bad_folder_button)

        return sidebar

    def _build_main_column(self) -> QVBoxLayout:
        column = QVBoxLayout()
        column.setSpacing(18)

        previews_row = QHBoxLayout()
        previews_row.setSpacing(18)
        self.live_panel = ImagePreviewPanel("Camera / Test Feed", large=True, live=True)
        previews_row.addWidget(self.live_panel, stretch=4)

        secondary_col = QVBoxLayout()
        secondary_col.setSpacing(14)
        self.reference_panel = ImagePreviewPanel("Good Reference")
        self.inspection_panel = ImagePreviewPanel("Inspection Image")
        self.diff_panel = ImagePreviewPanel("Difference")
        self.normalized_panel = ImagePreviewPanel("Normalized (Aligned)")
        for panel in (self.reference_panel, self.inspection_panel, self.diff_panel, self.normalized_panel):
            secondary_col.addWidget(panel)
        previews_row.addLayout(secondary_col, stretch=1)
        column.addLayout(previews_row, stretch=1)

        result_row = QHBoxLayout()
        result_row.addStretch()
        self.result_panel = ResultPanel()
        self.result_panel.setMinimumWidth(560)
        result_row.addWidget(self.result_panel)
        result_row.addStretch()
        column.addLayout(result_row)

        score_row = QHBoxLayout()
        score_row.addStretch()
        self.v2_score_label = QLabel("")
        self.v2_score_label.setObjectName("instructionsText")
        score_row.addWidget(self.v2_score_label)
        score_row.addStretch()
        column.addLayout(score_row)

        counters_row = QHBoxLayout()
        counters_row.addStretch()
        self.counters_panel = CountersPanel()
        counters_row.addWidget(self.counters_panel)
        counters_row.addStretch()
        column.addLayout(counters_row)

        return column

    def _build_button_bar(self) -> QHBoxLayout:
        button_defs = [
            ("Start Camera", self._on_toggle_camera, "camera_toggle_button"),
            ("Save GOOD Reference", self._on_save_reference, None),
            ("Inspect", self._on_take_inspection, None),
            ("Compare", self._on_compare, None),
            ("Save Result", self._on_save_result, None),
            ("Reports", self._on_reports, None),
            ("Settings", self._on_settings, None),
        ]
        bar = QHBoxLayout()
        bar.setSpacing(14)
        for label, handler, attr_name in button_defs:
            button = QPushButton(label)
            button.setObjectName("primaryActionButton")
            button.clicked.connect(handler)
            if attr_name:
                setattr(self, attr_name, button)
            bar.addWidget(button, stretch=1)
        return bar

    @staticmethod
    def _section_title(text: str) -> QLabel:
        label = QLabel(text)
        label.setObjectName("panelTitle")
        return label

    @staticmethod
    def _status_row(caption: str, value_label: QLabel) -> QWidget:
        row = QWidget()
        row_layout = QVBoxLayout(row)
        row_layout.setContentsMargins(0, 0, 0, 0)
        row_layout.setSpacing(1)
        caption_label = QLabel(caption.upper())
        caption_label.setObjectName("statusCaption")
        row_layout.addWidget(caption_label)
        row_layout.addWidget(value_label)
        return row

    # --------------------------------------------------------------- camera

    def _on_toggle_camera(self) -> None:
        if self.engine.camera_running:
            self._on_stop_camera()
        else:
            self._on_start_camera()

    def _on_start_camera(self) -> None:
        if self.engine.camera_running:
            return
        try:
            self.engine.start()
        except Exception as exc:
            QMessageBox.warning(self, "Camera", str(exc))
            return
        self.preview_timer.start()
        self.live_panel.set_live(True)
        self.camera_toggle_button.setText("Stop Camera")
        self.on_change()

    def _on_stop_camera(self) -> None:
        if not self.engine.camera_running:
            return
        self.preview_timer.stop()
        self.engine.stop()
        self.live_panel.clear()
        self.live_panel.set_live(False)
        self.camera_toggle_button.setText("Start Camera")
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
            comparison = self.engine.compute_comparison_v2() if self.engine.inspection_mode == \
                config.INSPECTION_MODE_FREE_POSE else self.engine.compute_comparison()
        except RuntimeError as exc:
            QMessageBox.warning(self, "Compare", str(exc))
            return
        self._show_comparison(comparison)

    def _show_comparison(self, comparison) -> None:
        """Renders either a V1 ComparisonResult or a V2 V2ComparisonResult -
        the two engines report different score/diff-image fields."""
        if isinstance(comparison, V2ComparisonResult):
            self.result_panel.set_result(comparison.result, comparison.final_score)
            self.detection_label.setText("FOUND" if comparison.product_detected else "NOT FOUND")
            if self.engine._last_v2_diff_path:
                self.diff_panel.set_image_path(self.engine._last_v2_diff_path)
            else:
                self.diff_panel.clear()
            if self.engine._last_v2_normalized_path:
                self.normalized_panel.set_image_path(self.engine._last_v2_normalized_path)
            else:
                self.normalized_panel.clear()
            self.best_match_label.setText(comparison.best_angle_name or "—")
            self.v2_score_label.setText(self._format_v2_scores(comparison))
        else:
            self.result_panel.set_result(comparison.result, comparison.score_percent)
            self.detection_label.setText("FOUND")
            self.diff_panel.set_image_path(comparison.diff_image_path)
            self.normalized_panel.clear()
            self.best_match_label.setText("—")
            self.v2_score_label.setText("")

    @staticmethod
    def _format_v2_scores(comparison: V2ComparisonResult) -> str:
        parts = []
        for label, value in (
            ("Feature", comparison.feature_score),
            ("Shape", comparison.shape_score),
            ("Pixel", comparison.pixel_score),
            ("Edge", comparison.edge_score),
        ):
            if value is not None:
                parts.append(f"{label} {value:.1f}%")
        return "   ".join(parts)

    def _on_auto_match_reference(self) -> None:
        if self.engine.location is None:
            QMessageBox.warning(self, "Auto Match Reference", "Select or add a product/angle first.")
            return
        try:
            comparison = self.engine.auto_match_reference()
        except RuntimeError as exc:
            QMessageBox.warning(self, "Auto Match Reference", str(exc))
            return
        self._show_comparison(comparison)

    def _prompt_no_product_decision(self, trigger_source: str, notes: str = "") -> None:
        """Only reachable when Settings' No Product Action is "Ask Operator" -
        save_result()/poll_trigger_and_inspect() raised NoProductDecisionRequired
        instead of saving anything, and it's on us to ask and finalize."""
        box = QMessageBox(self)
        box.setWindowTitle("No Product Found")
        box.setText("No product found. Skip this inspection or count as BAD?")
        skip_button = box.addButton("Skip", QMessageBox.ButtonRole.AcceptRole)
        no_product_button = box.addButton("Save as NO PRODUCT", QMessageBox.ButtonRole.ActionRole)
        bad_button = box.addButton("Count as BAD", QMessageBox.ButtonRole.DestructiveRole)
        box.exec()
        clicked = box.clickedButton()
        if clicked is skip_button:
            action = config.NO_PRODUCT_ACTION_SKIP
        elif clicked is no_product_button:
            action = config.NO_PRODUCT_ACTION_COUNT_AS_NO_PRODUCT
        elif clicked is bad_button:
            action = config.NO_PRODUCT_ACTION_TREAT_AS_BAD
        else:
            return
        self.engine.save_no_product_decision(action, trigger_source=trigger_source, notes=notes)
        self.on_change()

    def _on_save_result(self) -> None:
        has_pending = self.engine.last_comparison_v2 is not None if \
            self.engine.inspection_mode == config.INSPECTION_MODE_FREE_POSE else self.engine.last_comparison is not None
        if not has_pending:
            QMessageBox.warning(self, "Save Result", "Run Compare first.")
            return
        try:
            self.engine.save_result(trigger_source="manual")
        except NoProductDecisionRequired:
            self._prompt_no_product_decision(trigger_source="manual")
            return
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
        except NoProductDecisionRequired:
            self.trigger_status_label.setText("TRIGGER: Awaiting Decision")
            self._show_comparison(self.engine.last_comparison_v2)
            self._prompt_no_product_decision(trigger_source="plc_simulated")
            self.trigger_status_label.setText("TRIGGER: Complete")
            self.last_inspection_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.on_change()
            return
        except RuntimeError as exc:
            self.trigger_status_label.setText("TRIGGER: Waiting")
            QMessageBox.warning(self, "Simulate PLC Trigger", str(exc))
            return
        if comparison is None:
            self.trigger_status_label.setText("TRIGGER: Waiting")
            return
        self.trigger_status_label.setText("TRIGGER: Complete")
        self._show_comparison(comparison)
        self.last_inspection_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.on_change()

    # ------------------------------------------------------------ utility

    def _on_open_bad_products(self) -> None:
        folder = self.engine.location.bad_products_dir if self.engine.location else config.BAD_PRODUCTS_DIR
        folder.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(folder)))

    def _on_reports(self) -> None:
        if self.switch_to_reports:
            self.switch_to_reports()

    def _on_settings(self) -> None:
        self.switch_to_settings()

    # ------------------------------------------------------------ refresh

    def refresh(self) -> None:
        location = self.engine.location
        if self.engine.current_product:
            self.product_label.setText(self.engine.current_product["name"])
            self.part_number_label.setText(self.engine.current_product.get("part_number") or "—")
        else:
            self.product_label.setText("—")
            self.part_number_label.setText("—")
        self.angle_label.setText(location.angle if location else "—")
        self.camera_label.setText(f"{self.engine.mode.title()} (index {self.engine.device_index})")
        self.last_inspection_label.setText(self.last_inspection_time or "—")
        self.comm_status_label.setText(self.engine.get_machine_status())

        self.camera_toggle_button.setText("Stop Camera" if self.engine.camera_running else "Start Camera")
        self.live_panel.set_live(self.engine.camera_running)

        if self.engine.current_angle:
            primary = self.engine.db.get_primary_reference(self.engine.current_angle["id"])
            self.reference_panel.set_image_path(primary["image_path"]) if primary else self.reference_panel.clear()
        else:
            self.reference_panel.clear()

        if self.engine.last_inspection_image_path and self.engine.last_inspection_image_path.exists():
            self.inspection_panel.set_image_path(self.engine.last_inspection_image_path)
        else:
            self.inspection_panel.clear()

        self.counters_panel.set_counts(
            self.engine.db.count_inspections(self.engine.current_product["name"] if self.engine.current_product else None)
        )

    def shutdown(self) -> None:
        if self.engine.camera_running:
            self.preview_timer.stop()
            self.engine.stop()

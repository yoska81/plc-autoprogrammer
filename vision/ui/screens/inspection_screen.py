from datetime import datetime

import cv2
import numpy as np
from PySide6.QtCore import Qt, QTimer, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QDialog, QFrame, QHBoxLayout, QLabel, QMessageBox, QPushButton, QToolButton,
    QVBoxLayout, QWidget,
)

from core import compare_v2, config
from core.app import NoProductDecisionRequired, QCApp
from core.compare_v2 import V2ComparisonResult

from ..dialogs import SelectProductAngleDialog, prompt_text
from ..widgets import CountersPanel, ImagePreviewPanel, RegionPlanList, ResultPanel
from ..wizards import TeachProductWizard

LIVE_PREVIEW_INTERVAL_MS = 200


class InspectionScreen(QWidget):
    """Main Inspection screen: a large live camera feed, secondary GOOD
    reference/inspection/diff previews, a large GOOD/BAD result readable
    from a distance, a product/angle/machine-signal sidebar, and a big
    bottom action bar. Buttons map directly onto the `QCApp` engine - the
    UI adds no new comparison or capture logic."""

    def __init__(self, engine: QCApp, on_change, switch_to_settings, switch_to_reports=None,
                 switch_to_camera_setup=None, parent=None):
        super().__init__(parent)
        self.engine = engine
        self.on_change = on_change
        self.switch_to_settings = switch_to_settings
        self.switch_to_reports = switch_to_reports
        self.switch_to_camera_setup = switch_to_camera_setup
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
        sidebar.setFixedWidth(230)
        layout = QVBoxLayout(sidebar)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(6)

        layout.addWidget(self._section_title("STATION"))

        self.station_name_label = QLabel("—")
        self.station_name_label.setObjectName("infoValue")
        layout.addWidget(self._status_row("Selected Station", self.station_name_label))

        self.station_camera_index_label = QLabel("—")
        self.station_camera_index_label.setObjectName("infoLabel")
        layout.addWidget(self._status_row("Camera Index", self.station_camera_index_label))

        self.station_product_label = QLabel("—")
        self.station_product_label.setObjectName("infoLabel")
        layout.addWidget(self._status_row("Product", self.station_product_label))

        self.station_status_label = QLabel("—")
        self.station_status_label.setObjectName("infoLabel")
        layout.addWidget(self._status_row("Status", self.station_status_label))

        open_camera_setup_button = QPushButton("Open Camera Setup")
        open_camera_setup_button.setObjectName("secondaryActionButton")
        open_camera_setup_button.clicked.connect(self._on_open_camera_setup)
        layout.addWidget(open_camera_setup_button)

        layout.addSpacing(10)
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

        self.report_status_label = QLabel("—")
        self.report_status_label.setObjectName("infoLabel")
        self.report_status_label.setWordWrap(True)
        layout.addWidget(self._status_row("Report Status", self.report_status_label))

        layout.addSpacing(10)
        self.trigger_status_label = QLabel("TRIGGER: Waiting")
        self.trigger_status_label.setObjectName("infoLabel")
        layout.addWidget(self.trigger_status_label)
        trigger_button = QPushButton("Simulate PLC Trigger")
        trigger_button.setObjectName("secondaryActionButton")
        trigger_button.clicked.connect(self._on_simulate_trigger)
        layout.addWidget(trigger_button)

        layout.addSpacing(10)
        self.advanced_toggle = QToolButton()
        self.advanced_toggle.setText("▸ Advanced")
        self.advanced_toggle.setObjectName("advancedToggle")
        self.advanced_toggle.setCheckable(True)
        self.advanced_toggle.setChecked(False)
        self.advanced_toggle.clicked.connect(self._on_toggle_advanced)
        layout.addWidget(self.advanced_toggle)

        self.advanced_frame = QFrame()
        advanced_layout = QVBoxLayout(self.advanced_frame)
        advanced_layout.setContentsMargins(0, 8, 0, 0)
        advanced_layout.setSpacing(6)
        advanced_layout.addWidget(self._section_title("V2 ENGINE"))

        self.best_match_label = QLabel("—")
        self.best_match_label.setObjectName("infoLabel")
        self.best_match_label.setWordWrap(True)
        advanced_layout.addWidget(self._status_row("Best Match", self.best_match_label))

        self.center_label = QLabel("—")
        self.center_label.setObjectName("infoLabel")
        advanced_layout.addWidget(self._status_row("Product Center (X, Y)", self.center_label))

        self.rotation_label = QLabel("—")
        self.rotation_label.setObjectName("infoLabel")
        advanced_layout.addWidget(self._status_row("Rotation Angle", self.rotation_label))

        self.scale_label = QLabel("—")
        self.scale_label.setObjectName("infoLabel")
        advanced_layout.addWidget(self._status_row("Detected Scale", self.scale_label))

        self.confidence_label = QLabel("—")
        self.confidence_label.setObjectName("infoLabel")
        advanced_layout.addWidget(self._status_row("Recognition Confidence", self.confidence_label))

        self.alignment_quality_label = QLabel("—")
        self.alignment_quality_label.setObjectName("infoLabel")
        advanced_layout.addWidget(self._status_row("Alignment Quality", self.alignment_quality_label))

        auto_match_button = QPushButton("Auto Match Reference")
        auto_match_button.setObjectName("secondaryActionButton")
        auto_match_button.clicked.connect(self._on_auto_match_reference)
        advanced_layout.addWidget(auto_match_button)

        self.advanced_frame.setVisible(False)
        layout.addWidget(self.advanced_frame)

        layout.addStretch()

        layout.addWidget(self._section_title("PRODUCT SETUP"))
        teach_button = QPushButton("Teach Product (Wizard)")
        teach_button.setObjectName("secondaryActionButton")
        teach_button.clicked.connect(self._on_teach_product)
        layout.addWidget(teach_button)
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
        column.setSpacing(14)

        previews_row = QHBoxLayout()
        previews_row.setSpacing(18)
        self.live_panel = ImagePreviewPanel("Camera / Test Feed", large=True, live=True, zoomable=True)
        previews_row.addWidget(self.live_panel, stretch=7)

        self.region_plan_panel = RegionPlanList()
        previews_row.addWidget(self.region_plan_panel, stretch=3)
        column.addLayout(previews_row, stretch=1)

        status_row = QHBoxLayout()
        status_row.setSpacing(14)
        self.result_panel = ResultPanel(compact=True)
        status_row.addWidget(self.result_panel, stretch=1)
        self.v2_score_label = QLabel("")
        self.v2_score_label.setObjectName("instructionsText")
        status_row.addWidget(self.v2_score_label)
        status_row.addStretch()
        self.counters_panel = CountersPanel()
        status_row.addWidget(self.counters_panel)
        column.addLayout(status_row)

        self.technical_toggle = QToolButton()
        self.technical_toggle.setText("▸ Technical Images")
        self.technical_toggle.setObjectName("advancedToggle")
        self.technical_toggle.setCheckable(True)
        self.technical_toggle.setChecked(False)
        self.technical_toggle.clicked.connect(self._on_toggle_technical)
        column.addWidget(self.technical_toggle)

        self.technical_frame = QFrame()
        technical_row = QHBoxLayout(self.technical_frame)
        technical_row.setContentsMargins(0, 8, 0, 0)
        technical_row.setSpacing(14)
        self.reference_panel = ImagePreviewPanel("Best Matching Reference")
        self.inspection_panel = ImagePreviewPanel("Inspection Image")
        self.overlay_panel = ImagePreviewPanel("Detection Overlay")
        self.diff_panel = ImagePreviewPanel("Difference")
        self.normalized_panel = ImagePreviewPanel("Normalized (Aligned)")
        for panel in (
            self.reference_panel, self.inspection_panel, self.overlay_panel,
            self.diff_panel, self.normalized_panel,
        ):
            technical_row.addWidget(panel)
        self.technical_frame.setVisible(False)
        column.addWidget(self.technical_frame)

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

    def _on_teach_product(self) -> None:
        wizard = TeachProductWizard(self.engine, self.on_change, self)
        wizard.exec()

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
            self._render_v2_details(comparison)
        else:
            self.result_panel.set_result(comparison.result, comparison.score_percent)
            self.detection_label.setText("FOUND")
            self.diff_panel.set_image_path(comparison.diff_image_path)
            self.normalized_panel.clear()
            self.overlay_panel.clear()
            self.best_match_label.setText("—")
            self.v2_score_label.setText("")
            self._clear_v2_detail_labels()
            self.region_plan_panel.clear()

    def _render_v2_details(self, comparison: V2ComparisonResult) -> None:
        self.detection_label.setText("FOUND" if comparison.product_detected else "NOT FOUND")
        if self.engine._last_v2_diff_path:
            self.diff_panel.set_image_path(self.engine._last_v2_diff_path)
        else:
            self.diff_panel.clear()
        if self.engine._last_v2_normalized_path:
            self.normalized_panel.set_image_path(self.engine._last_v2_normalized_path)
        else:
            self.normalized_panel.clear()
        if comparison.best_reference_image_path:
            self.reference_panel.set_image_path(comparison.best_reference_image_path)
        else:
            self.reference_panel.clear()
        overlay = self._build_detection_overlay(comparison)
        if overlay is not None:
            self.overlay_panel.set_frame(overlay)
        else:
            self.overlay_panel.clear()
        self.best_match_label.setText(comparison.best_angle_name or "—")
        self.v2_score_label.setText(self._format_v2_scores(comparison))
        self._set_v2_detail_labels(comparison)
        self.region_plan_panel.set_regions(comparison.region_scores)

    _REGION_OVERLAY_COLOR = {
        config.REGION_RESULT_PASS: config.OVERLAY_COLOR_GOOD,
        config.REGION_RESULT_FAIL: config.OVERLAY_COLOR_BAD,
        config.REGION_RESULT_WARN: config.OVERLAY_COLOR_WARN,
    }

    def _build_detection_overlay(self, comparison: V2ComparisonResult) -> np.ndarray | None:
        """Full inspection frame with the detected (rotated) product bounding
        box, its center marker, and - when the product has named inspection
        regions - one labeled, color-coded polygon per region (green=PASS,
        red=FAIL, yellow=WARN). Purely a display rendering, computed from
        fields the V2 engine already reports; never runs on the live preview
        timer, only after an explicit Inspect/Compare/trigger action."""
        path = self.engine.last_inspection_image_path
        if not comparison.product_detected or path is None or not path.exists():
            return None
        image = cv2.imread(str(path))
        if image is None:
            return None
        if comparison.detected_bbox_corners:
            points = np.array(comparison.detected_bbox_corners, dtype=np.int32).reshape((-1, 1, 2))
            cv2.polylines(image, [points], isClosed=True, color=(0, 220, 0), thickness=3)
        if comparison.detected_center_x is not None and comparison.detected_center_y is not None:
            center = (int(round(comparison.detected_center_x)), int(round(comparison.detected_center_y)))
            cv2.drawMarker(image, center, (0, 0, 255), cv2.MARKER_CROSS, 36, 3)
        if comparison.region_scores and comparison.product_bbox and comparison.alignment:
            for region in comparison.region_scores:
                corners = compare_v2.region_to_inspection_corners(
                    region.canonical_rect, comparison.product_bbox, comparison.alignment,
                )
                points = np.array(corners, dtype=np.int32).reshape((-1, 1, 2))
                color = self._REGION_OVERLAY_COLOR.get(region.result, config.OVERLAY_COLOR_WARN)
                cv2.polylines(image, [points], isClosed=True, color=color, thickness=2)
                label_pos = (int(points[0][0][0]), max(0, int(points[0][0][1]) - 8))
                cv2.putText(image, region.region_name, label_pos, cv2.FONT_HERSHEY_SIMPLEX,
                            0.5, color, 1, cv2.LINE_AA)
        return image

    def _set_v2_detail_labels(self, comparison: V2ComparisonResult) -> None:
        if comparison.detected_center_x is not None and comparison.detected_center_y is not None:
            self.center_label.setText(f"{comparison.detected_center_x:.1f}, {comparison.detected_center_y:.1f} px")
        else:
            self.center_label.setText("—")
        self.rotation_label.setText(
            f"{comparison.detected_rotation_deg:.2f}°" if comparison.detected_rotation_deg is not None else "—"
        )
        self.scale_label.setText(
            f"{comparison.detected_scale:.3f}" if comparison.detected_scale is not None else "—"
        )
        self.confidence_label.setText(f"{comparison.recognition_confidence:.1f}%")
        self.alignment_quality_label.setText(f"{comparison.alignment_quality:.1f}%")

    def _clear_v2_detail_labels(self) -> None:
        for label in (
            self.center_label, self.rotation_label, self.scale_label,
            self.confidence_label, self.alignment_quality_label,
        ):
            label.setText("—")

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

    def _on_toggle_advanced(self) -> None:
        expanded = self.advanced_toggle.isChecked()
        self.advanced_frame.setVisible(expanded)
        self.advanced_toggle.setText("▾ Advanced" if expanded else "▸ Advanced")

    def _on_toggle_technical(self) -> None:
        expanded = self.technical_toggle.isChecked()
        self.technical_frame.setVisible(expanded)
        self.technical_toggle.setText("▾ Technical Images" if expanded else "▸ Technical Images")

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

    def _on_open_camera_setup(self) -> None:
        if self.switch_to_camera_setup:
            self.switch_to_camera_setup()

    def _on_settings(self) -> None:
        self.switch_to_settings()

    # ------------------------------------------------------------ refresh

    def refresh(self) -> None:
        location = self.engine.location

        self.station_name_label.setText(config.DEFAULT_STATION_NAME)
        self.station_camera_index_label.setText(str(self.engine.device_index))
        self.station_product_label.setText(
            self.engine.current_product["name"] if self.engine.current_product else "—")
        self.station_status_label.setText("LIVE" if self.engine.camera_running else "STOPPED")
        self.report_status_label.setText(self.engine.last_report_status or "—")

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

        if self.engine.inspection_mode == config.INSPECTION_MODE_FREE_POSE and self.engine.last_comparison_v2 is not None:
            self._render_v2_details(self.engine.last_comparison_v2)
        elif self.engine.current_angle:
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

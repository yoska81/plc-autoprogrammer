from PySide6.QtWidgets import (
    QCheckBox, QComboBox, QDoubleSpinBox, QFormLayout, QGroupBox, QHBoxLayout,
    QLabel, QPushButton, QSpinBox, QVBoxLayout, QWidget,
)

from core import config
from core.app import QCApp

_MODE_CHOICES = ("auto", "real", "test")

_INSPECTION_MODE_LABELS = {
    config.INSPECTION_MODE_FIXED: "Fixed Reference (V1)",
    config.INSPECTION_MODE_FREE_POSE: "Free Position / Continuous Rotation (V2)",
}

_NO_PRODUCT_ACTION_LABELS = {
    config.NO_PRODUCT_ACTION_SKIP: "Skip and do not count",
    config.NO_PRODUCT_ACTION_COUNT_AS_NO_PRODUCT: "Count as NO PRODUCT",
    config.NO_PRODUCT_ACTION_TREAT_AS_BAD: "Treat as BAD",
    config.NO_PRODUCT_ACTION_ASK_OPERATOR: "Ask operator",
}


class SettingsScreen(QWidget):
    """Match threshold, snapshot/archival toggles, and the reserved Machine
    Signal Interface communication-type placeholder, grouped into cards:
    Camera Settings, Inspection Settings, Saving Options, Machine Signal
    Interface. Camera index/resolution/FPS/exposure controls live on the
    Camera Setup tab next to the live preview they affect; this screen's
    Camera Settings card links there."""

    def __init__(self, engine: QCApp, on_change, switch_to_camera_setup=None, parent=None):
        super().__init__(parent)
        self.engine = engine
        self.on_change = on_change
        self.switch_to_camera_setup = switch_to_camera_setup
        self._build_ui()
        self.refresh()

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(24, 20, 24, 20)
        root.setSpacing(18)

        title = QLabel("SETTINGS")
        title.setObjectName("panelTitle")
        root.addWidget(title)

        cards_row = QHBoxLayout()
        cards_row.setSpacing(18)

        camera_box = QGroupBox("Camera Settings")
        camera_form = QFormLayout(camera_box)
        self.mode_combo = QComboBox()
        self.mode_combo.addItems(_MODE_CHOICES)
        camera_form.addRow("Camera mode", self.mode_combo)
        open_camera_setup_button = QPushButton("Open Camera Setup")
        open_camera_setup_button.setObjectName("secondaryActionButton")
        open_camera_setup_button.clicked.connect(self._on_open_camera_setup)
        camera_form.addRow(open_camera_setup_button)
        cards_row.addWidget(camera_box)

        inspection_box = QGroupBox("Inspection Settings")
        inspection_form = QFormLayout(inspection_box)
        self.threshold_spin = QDoubleSpinBox()
        self.threshold_spin.setRange(0.0, 100.0)
        self.threshold_spin.setDecimals(1)
        self.threshold_spin.setSuffix(" %")
        inspection_form.addRow("Match threshold", self.threshold_spin)
        cards_row.addWidget(inspection_box)

        saving_box = QGroupBox("Saving Options")
        saving_form = QFormLayout(saving_box)
        self.save_all_checkbox = QCheckBox("Save all snapshots (GOOD and BAD)")
        saving_form.addRow(self.save_all_checkbox)
        self.save_bad_checkbox = QCheckBox("Save BAD product images to bad_products/")
        saving_form.addRow(self.save_bad_checkbox)
        cards_row.addWidget(saving_box)

        root.addLayout(cards_row)

        v2_row = QHBoxLayout()
        v2_row.setSpacing(18)

        engine_box = QGroupBox("Inspection Engine (V2)")
        engine_form = QFormLayout(engine_box)
        self.inspection_mode_combo = QComboBox()
        for value in config.INSPECTION_MODE_CHOICES:
            self.inspection_mode_combo.addItem(_INSPECTION_MODE_LABELS[value], userData=value)
        engine_form.addRow("Inspection mode", self.inspection_mode_combo)
        self.matching_method_combo = QComboBox()
        self.matching_method_combo.addItems(config.MATCHING_METHOD_CHOICES)
        engine_form.addRow("Matching method", self.matching_method_combo)
        self.alignment_method_combo = QComboBox()
        self.alignment_method_combo.addItems(config.ALIGNMENT_METHOD_CHOICES)
        engine_form.addRow("Alignment method", self.alignment_method_combo)
        self.min_confidence_spin = QDoubleSpinBox()
        self.min_confidence_spin.setRange(0.0, 100.0)
        self.min_confidence_spin.setDecimals(1)
        self.min_confidence_spin.setSuffix(" %")
        engine_form.addRow("Minimum product detection confidence", self.min_confidence_spin)
        self.min_feature_matches_spin = QSpinBox()
        self.min_feature_matches_spin.setRange(1, 200)
        engine_form.addRow("Minimum feature matches", self.min_feature_matches_spin)
        self.save_normalized_checkbox = QCheckBox("Save normalized (aligned) inspection image")
        engine_form.addRow(self.save_normalized_checkbox)
        v2_row.addWidget(engine_box)

        no_product_box = QGroupBox("No Product Handling (V2)")
        no_product_form = QFormLayout(no_product_box)
        self.no_product_action_combo = QComboBox()
        for value in config.NO_PRODUCT_ACTION_CHOICES:
            self.no_product_action_combo.addItem(_NO_PRODUCT_ACTION_LABELS[value], userData=value)
        no_product_form.addRow("No Product Action", self.no_product_action_combo)
        self.save_no_product_images_checkbox = QCheckBox("Save no-product images")
        no_product_form.addRow(self.save_no_product_images_checkbox)
        self.log_skipped_checkbox = QCheckBox("Log skipped inspections")
        no_product_form.addRow(self.log_skipped_checkbox)
        no_product_note = QLabel(
            "NO PRODUCT FOUND is never the same as BAD: BAD means a product was "
            "located and failed inspection; NO PRODUCT FOUND means nothing was "
            "located at all (early trigger, empty conveyor gap, manual trigger "
            "with nothing in frame, ...)."
        )
        no_product_note.setObjectName("instructionsText")
        no_product_note.setWordWrap(True)
        no_product_form.addRow(no_product_note)
        v2_row.addWidget(no_product_box)

        root.addLayout(v2_row)

        machine_box = QGroupBox("Machine Signal Interface (future PLC connection)")
        machine_form = QFormLayout(machine_box)

        self.plc_simulation_checkbox = QCheckBox("Simulation mode (no real PLC connected)")
        machine_form.addRow(self.plc_simulation_checkbox)

        self.communication_combo = QComboBox()
        self.communication_combo.addItems(config.COMMUNICATION_TYPE_CHOICES)
        machine_form.addRow("Communication type", self.communication_combo)

        note = QLabel(
            "Only Simulation is implemented in V1. The other choices are reserved "
            "so this screen doesn't need to change shape when a real PLC/machine "
            "connection is added (see TODO_NEXT_STEPS.md)."
        )
        note.setObjectName("instructionsText")
        note.setWordWrap(True)
        machine_form.addRow(note)

        root.addWidget(machine_box)

        button_row = QHBoxLayout()
        save_button = QPushButton("Save Settings")
        save_button.setObjectName("primaryActionButton")
        save_button.clicked.connect(self._on_save)
        button_row.addWidget(save_button)
        button_row.addStretch()
        root.addLayout(button_row)

        storage_note = QLabel(
            f"Database: {config.DATABASE_PATH}    |    Reports folder: {config.REPORTS_DIR}"
        )
        storage_note.setObjectName("instructionsText")
        storage_note.setWordWrap(True)
        root.addWidget(storage_note)

        root.addStretch()

    # ------------------------------------------------------------- actions

    def _on_open_camera_setup(self) -> None:
        if self.switch_to_camera_setup:
            self.switch_to_camera_setup()

    def _on_save(self) -> None:
        mode = self.mode_combo.currentText()
        if mode != self.engine.mode:
            self.engine.reconfigure_camera(mode=mode)
        self.engine.set_threshold(self.threshold_spin.value())
        self.engine.set_save_all_snapshots(self.save_all_checkbox.isChecked())
        self.engine.set_save_bad_products(self.save_bad_checkbox.isChecked())
        self.engine.set_plc_simulation_mode(self.plc_simulation_checkbox.isChecked())
        self.engine.set_communication_type(self.communication_combo.currentText())

        self.engine.set_inspection_mode(self.inspection_mode_combo.currentData())
        self.engine.set_matching_method(self.matching_method_combo.currentText())
        self.engine.set_alignment_method(self.alignment_method_combo.currentText())
        self.engine.set_min_recognition_confidence(self.min_confidence_spin.value())
        self.engine.set_min_feature_matches(self.min_feature_matches_spin.value())
        self.engine.set_save_normalized_image(self.save_normalized_checkbox.isChecked())

        self.engine.set_no_product_action(self.no_product_action_combo.currentData())
        self.engine.set_save_no_product_images(self.save_no_product_images_checkbox.isChecked())
        self.engine.set_log_skipped_inspections(self.log_skipped_checkbox.isChecked())

        self.on_change()

    # ------------------------------------------------------------ refresh

    def refresh(self) -> None:
        self.mode_combo.setCurrentText(self.engine.mode)
        self.threshold_spin.setValue(self.engine.threshold_percent)
        self.save_all_checkbox.setChecked(self.engine.save_all_snapshots)
        self.save_bad_checkbox.setChecked(self.engine.save_bad_products)
        self.plc_simulation_checkbox.setChecked(self.engine.plc_simulation_mode)
        self.communication_combo.setCurrentText(self.engine.communication_type)

        self.inspection_mode_combo.setCurrentIndex(
            self.inspection_mode_combo.findData(self.engine.inspection_mode))
        self.matching_method_combo.setCurrentText(self.engine.matching_method)
        self.alignment_method_combo.setCurrentText(self.engine.alignment_method)
        self.min_confidence_spin.setValue(self.engine.min_recognition_confidence)
        self.min_feature_matches_spin.setValue(self.engine.min_feature_matches)
        self.save_normalized_checkbox.setChecked(self.engine.save_normalized_image)

        self.no_product_action_combo.setCurrentIndex(
            self.no_product_action_combo.findData(self.engine.no_product_action))
        self.save_no_product_images_checkbox.setChecked(self.engine.save_no_product_images)
        self.log_skipped_checkbox.setChecked(self.engine.log_skipped_inspections)

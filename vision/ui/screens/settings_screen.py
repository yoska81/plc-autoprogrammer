from PySide6.QtWidgets import (
    QCheckBox, QComboBox, QDoubleSpinBox, QFormLayout, QGroupBox, QHBoxLayout,
    QLabel, QPushButton, QVBoxLayout, QWidget,
)

from core import config
from core.app import QCApp

_MODE_CHOICES = ("auto", "real", "test")


class SettingsScreen(QWidget):
    """Match threshold, snapshot/archival toggles, and the reserved Machine
    Signal Interface communication-type placeholder. Camera index/resolution/
    FPS/exposure live on the Camera Setup / Calibration screen instead, next
    to the live preview they affect."""

    def __init__(self, engine: QCApp, on_change, parent=None):
        super().__init__(parent)
        self.engine = engine
        self.on_change = on_change
        self._build_ui()
        self.refresh()

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(24, 16, 24, 16)
        root.setSpacing(16)

        title = QLabel("SETTINGS")
        title.setObjectName("sectionTitle")
        root.addWidget(title)

        inspection_box = QGroupBox("Inspection")
        inspection_form = QFormLayout(inspection_box)

        self.mode_combo = QComboBox()
        self.mode_combo.addItems(_MODE_CHOICES)
        inspection_form.addRow("Camera mode", self.mode_combo)

        self.threshold_spin = QDoubleSpinBox()
        self.threshold_spin.setRange(0.0, 100.0)
        self.threshold_spin.setDecimals(1)
        self.threshold_spin.setSuffix(" %")
        inspection_form.addRow("Match threshold", self.threshold_spin)

        self.save_all_checkbox = QCheckBox("Save all snapshots (GOOD and BAD)")
        inspection_form.addRow(self.save_all_checkbox)

        self.save_bad_checkbox = QCheckBox("Save BAD product images to bad_products/")
        inspection_form.addRow(self.save_bad_checkbox)

        root.addWidget(inspection_box)

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

        info_box = QGroupBox("Storage (display only)")
        info_form = QFormLayout(info_box)
        info_form.addRow("Database", QLabel(str(config.DATABASE_PATH)))
        info_form.addRow("Reports folder", QLabel(str(config.REPORTS_DIR)))
        root.addWidget(info_box)

        button_row = QHBoxLayout()
        save_button = QPushButton("Save Settings")
        save_button.clicked.connect(self._on_save)
        button_row.addWidget(save_button)
        button_row.addStretch()
        root.addLayout(button_row)

        root.addStretch()

    # ------------------------------------------------------------- actions

    def _on_save(self) -> None:
        mode = self.mode_combo.currentText()
        if mode != self.engine.mode:
            self.engine.reconfigure_camera(mode=mode)
        self.engine.set_threshold(self.threshold_spin.value())
        self.engine.set_save_all_snapshots(self.save_all_checkbox.isChecked())
        self.engine.set_save_bad_products(self.save_bad_checkbox.isChecked())
        self.engine.set_plc_simulation_mode(self.plc_simulation_checkbox.isChecked())
        self.engine.set_communication_type(self.communication_combo.currentText())
        self.on_change()

    # ------------------------------------------------------------ refresh

    def refresh(self) -> None:
        self.mode_combo.setCurrentText(self.engine.mode)
        self.threshold_spin.setValue(self.engine.threshold_percent)
        self.save_all_checkbox.setChecked(self.engine.save_all_snapshots)
        self.save_bad_checkbox.setChecked(self.engine.save_bad_products)
        self.plc_simulation_checkbox.setChecked(self.engine.plc_simulation_mode)
        self.communication_combo.setCurrentText(self.engine.communication_type)

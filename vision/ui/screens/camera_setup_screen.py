import cv2
from PySide6.QtCore import QTimer
from PySide6.QtWidgets import (
    QComboBox, QFormLayout, QFrame, QGroupBox, QHBoxLayout, QLabel, QMessageBox,
    QPushButton, QSlider, QSpinBox, QVBoxLayout, QWidget,
)
from PySide6.QtCore import Qt

from core import config
from core.app import QCApp
from core.camera.real_camera import RealCamera, probe_camera_indices

from ..widgets import ImagePreviewPanel

PREVIEW_INTERVAL_MS = 200

INSTRUCTIONS = (
    "1. Frame the shot, then lock the camera's physical position (mount/clamp it - "
    "do not hand-hold).\n"
    "2. Adjust zoom, focus, and aperture by hand on the lens rings, then lock them "
    "in place.\n"
    "3. Use stable, consistent lighting. Re-check GOOD references if the camera, "
    "lens, or lighting ever changes - V1 has no automatic re-alignment."
)


class CameraPickerForm(QWidget):
    """Device index / resolution / FPS picker, shared by CameraSetupScreen's
    main form and the Teach Product wizard's SelectCameraPage - extracted so
    neither place re-derives the same spinbox/combo wiring."""

    def __init__(self, engine: QCApp, parent=None):
        super().__init__(parent)
        self.engine = engine

        form = QFormLayout(self)

        self.device_spin = QSpinBox()
        self.device_spin.setRange(0, 10)
        device_row = QHBoxLayout()
        device_row.addWidget(self.device_spin)
        detect_button = QPushButton("Detect Cameras")
        detect_button.clicked.connect(self._on_detect_cameras)
        device_row.addWidget(detect_button)
        form.addRow("Device index", device_row)

        self.resolution_combo = QComboBox()
        for width, height in config.RESOLUTION_FALLBACKS:
            self.resolution_combo.addItem(f"{width} x {height}", (width, height))
        form.addRow("Resolution", self.resolution_combo)

        self.fps_spin = QSpinBox()
        self.fps_spin.setRange(1, 120)
        form.addRow("FPS", self.fps_spin)

    def _on_detect_cameras(self) -> None:
        results = probe_camera_indices([0, 1, 2])
        lines = [f"Index {index}: {'available' if available else 'not found'}" for index, available in results.items()]
        QMessageBox.information(self, "Detect Cameras", "\n".join(lines))

    def refresh(self) -> None:
        self.device_spin.blockSignals(True)
        self.device_spin.setValue(self.engine.device_index)
        self.device_spin.blockSignals(False)

        for i in range(self.resolution_combo.count()):
            if self.resolution_combo.itemData(i) == (self.engine.frame_width, self.engine.frame_height):
                self.resolution_combo.setCurrentIndex(i)
                break

        self.fps_spin.blockSignals(True)
        self.fps_spin.setValue(self.engine.frame_fps)
        self.fps_spin.blockSignals(False)

    def apply(self) -> None:
        """Push the form's current values into the engine's camera config.
        Does not start/stop the camera - the caller decides that."""
        width, height = self.resolution_combo.currentData()
        self.engine.reconfigure_camera(
            device_index=self.device_spin.value(), width=width, height=height, fps=self.fps_spin.value(),
        )


class CameraSetupScreen(QWidget):
    """Camera index/resolution/FPS/exposure setup for the SVPRO USB UVC
    prototype camera (or any other plain UVC USB camera). Zoom/focus/
    aperture are manual on the lens - this screen never drives them."""

    def __init__(self, engine: QCApp, on_change, parent=None):
        super().__init__(parent)
        self.engine = engine
        self.on_change = on_change

        self._build_ui()
        self.preview_timer = QTimer(self)
        self.preview_timer.setInterval(PREVIEW_INTERVAL_MS)
        self.preview_timer.timeout.connect(self._update_preview)

        self.refresh()

    def _build_ui(self) -> None:
        root = QHBoxLayout(self)
        root.setContentsMargins(24, 20, 24, 20)
        root.setSpacing(18)

        preview_card = QFrame()
        preview_card.setObjectName("panelCard")
        preview_card_layout = QVBoxLayout(preview_card)
        preview_card_layout.setContentsMargins(20, 20, 20, 20)
        self.preview_panel = ImagePreviewPanel("Live Preview", large=True)
        preview_card_layout.addWidget(self.preview_panel)
        root.addWidget(preview_card, stretch=2)

        right = QVBoxLayout()

        form_box = QGroupBox("Camera")
        form = QVBoxLayout(form_box)
        self.camera_form = CameraPickerForm(self.engine)
        form.addWidget(self.camera_form)

        apply_row = QHBoxLayout()
        start_button = QPushButton("Start Preview")
        start_button.clicked.connect(self._on_start_preview)
        stop_button = QPushButton("Stop Preview")
        stop_button.clicked.connect(self._on_stop_preview)
        apply_button = QPushButton("Apply")
        apply_button.clicked.connect(self._on_apply)
        apply_row.addWidget(start_button)
        apply_row.addWidget(stop_button)
        apply_row.addWidget(apply_button)
        form.addLayout(apply_row)

        right.addWidget(form_box)

        exposure_box = QGroupBox("Exposure / Brightness (if supported by the camera)")
        exposure_form = QFormLayout(exposure_box)
        self.exposure_slider = QSlider(Qt.Orientation.Horizontal)
        self.exposure_slider.setRange(-13, 0)
        self.exposure_slider.valueChanged.connect(self._on_exposure_changed)
        exposure_form.addRow("Exposure", self.exposure_slider)
        self.brightness_slider = QSlider(Qt.Orientation.Horizontal)
        self.brightness_slider.setRange(0, 255)
        self.brightness_slider.valueChanged.connect(self._on_brightness_changed)
        exposure_form.addRow("Brightness", self.brightness_slider)
        right.addWidget(exposure_box)

        instructions_box = QGroupBox("Setup Checklist")
        instructions_layout = QVBoxLayout(instructions_box)
        instructions_label = QLabel(INSTRUCTIONS)
        instructions_label.setObjectName("instructionsText")
        instructions_label.setWordWrap(True)
        instructions_layout.addWidget(instructions_label)
        right.addWidget(instructions_box)

        right.addStretch()
        root.addLayout(right, stretch=1)

    # ------------------------------------------------------------- actions

    def _on_start_preview(self) -> None:
        if not self.engine.camera_running:
            try:
                self.engine.start()
            except Exception as exc:
                QMessageBox.warning(self, "Camera", str(exc))
                return
            self.on_change()
        self.preview_timer.start()
        self._update_exposure_controls()

    def _on_stop_preview(self) -> None:
        self.preview_timer.stop()
        if self.engine.camera_running:
            self.engine.stop()
            self.preview_panel.clear()
            self.on_change()

    def _update_preview(self) -> None:
        try:
            frame = self.engine.camera.read_frame()
        except Exception:
            return
        self.preview_panel.set_frame(frame)

    def _on_apply(self) -> None:
        was_running = self.engine.camera_running
        if was_running:
            self.preview_timer.stop()
            self.engine.stop()
        self.camera_form.apply()
        if was_running:
            try:
                self.engine.start()
                self.preview_timer.start()
            except Exception as exc:
                QMessageBox.warning(self, "Camera", str(exc))
        self.on_change()
        self._update_exposure_controls()

    def _update_exposure_controls(self) -> None:
        camera = self.engine.camera
        supports_properties = isinstance(camera, RealCamera) and self.engine.camera_running
        self.exposure_slider.setEnabled(supports_properties)
        self.brightness_slider.setEnabled(supports_properties)
        if not supports_properties:
            return
        exposure = camera.get_property(cv2.CAP_PROP_EXPOSURE)
        if exposure is not None and exposure != -1:
            self.exposure_slider.blockSignals(True)
            self.exposure_slider.setValue(int(exposure))
            self.exposure_slider.blockSignals(False)
        brightness = camera.get_property(cv2.CAP_PROP_BRIGHTNESS)
        if brightness is not None and brightness != -1:
            self.brightness_slider.blockSignals(True)
            self.brightness_slider.setValue(int(brightness))
            self.brightness_slider.blockSignals(False)

    def _on_exposure_changed(self, value: int) -> None:
        if isinstance(self.engine.camera, RealCamera):
            self.engine.camera.set_property(cv2.CAP_PROP_EXPOSURE, value)

    def _on_brightness_changed(self, value: int) -> None:
        if isinstance(self.engine.camera, RealCamera):
            self.engine.camera.set_property(cv2.CAP_PROP_BRIGHTNESS, value)

    # ------------------------------------------------------------ refresh

    def refresh(self) -> None:
        self.camera_form.refresh()
        self._update_exposure_controls()

    def shutdown(self) -> None:
        self.preview_timer.stop()

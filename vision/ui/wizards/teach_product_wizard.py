"""TeachProductWizard: the guided "teach a new product" flow requested by
live testing feedback (operators didn't know how to set up a new product).
A modal QWizard - it never replaces the existing Products / Camera Setup /
References screens, which stay as the manual/advanced fallback for one-off
edits. Reuses CameraPickerForm (camera_setup_screen.py), RegionDrawWidget
(widgets_roi.py), and the same engine.* calls those screens already use -
no new comparison/scoring logic lives here.

Page flow (non-linear via nextId() so Fixed/V1 mode skips the V2-only ROI/
region/test pages - V1 has no localization step to anchor a region to):

    SelectCamera -> ProductSetup -> [DefineObjectROI -> DefineFeatures] ->
    SaveGoodReferences -> [TestInspection] -> Finish

Bracketed pages only run in Free Position / Continuous Rotation (V2) mode.
"""
from __future__ import annotations

import cv2
import numpy as np
from PySide6.QtCore import QTimer
from PySide6.QtWidgets import (
    QComboBox, QFormLayout, QHBoxLayout, QLabel, QLineEdit, QMessageBox,
    QPlainTextEdit, QPushButton, QVBoxLayout, QWizard, QWizardPage,
)

from core import compare_v2, config
from core.app import QCApp

from ..screens.camera_setup_screen import CameraPickerForm
from ..widgets import ImagePreviewPanel
from ..widgets_roi import RegionDrawWidget

PAGE_SELECT_CAMERA = 0
PAGE_PRODUCT_SETUP = 1
PAGE_DEFINE_OBJECT = 2
PAGE_DEFINE_FEATURES = 3
PAGE_SAVE_REFERENCES = 4
PAGE_TEST_INSPECTION = 5
PAGE_FINISH = 6

_PREVIEW_INTERVAL_MS = 200


class SelectCameraPage(QWizardPage):
    """Step 1: pick/confirm the camera, start its preview. Every later page
    assumes the camera is already running."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setTitle("Select Camera")
        self.setSubTitle("Pick the camera this product will be taught and inspected with, then start the preview.")

        layout = QVBoxLayout(self)
        self.camera_form = CameraPickerForm(None)  # engine attached in initializePage()
        layout.addWidget(self.camera_form)

        button_row = QHBoxLayout()
        self.start_button = QPushButton("Start Preview")
        self.start_button.clicked.connect(self._on_start)
        self.stop_button = QPushButton("Stop Preview")
        self.stop_button.clicked.connect(self._on_stop)
        apply_button = QPushButton("Apply")
        apply_button.clicked.connect(self._on_apply)
        button_row.addWidget(self.start_button)
        button_row.addWidget(self.stop_button)
        button_row.addWidget(apply_button)
        layout.addLayout(button_row)

        self.preview_panel = ImagePreviewPanel("Live Preview", preview_size=(480, 320))
        layout.addWidget(self.preview_panel)

        self._timer = QTimer(self)
        self._timer.setInterval(_PREVIEW_INTERVAL_MS)
        self._timer.timeout.connect(self._update_preview)

    def initializePage(self) -> None:
        engine = self.wizard().engine
        self.camera_form.engine = engine
        self.camera_form.refresh()
        if engine.camera_running:
            self._timer.start()

    def cleanupPage(self) -> None:
        self._timer.stop()

    def _on_start(self) -> None:
        engine = self.wizard().engine
        if not engine.camera_running:
            try:
                engine.start()
            except Exception as exc:
                QMessageBox.warning(self, "Camera", str(exc))
                return
        self._timer.start()
        self.wizard().on_change()

    def _on_stop(self) -> None:
        engine = self.wizard().engine
        self._timer.stop()
        if engine.camera_running:
            engine.stop()
            self.preview_panel.clear()
            self.wizard().on_change()

    def _on_apply(self) -> None:
        engine = self.wizard().engine
        was_running = engine.camera_running
        if was_running:
            self._timer.stop()
            engine.stop()
        self.camera_form.apply()
        if was_running:
            try:
                engine.start()
                self._timer.start()
            except Exception as exc:
                QMessageBox.warning(self, "Camera", str(exc))
        self.wizard().on_change()

    def _update_preview(self) -> None:
        try:
            frame = self.wizard().engine.camera.read_frame()
        except Exception:
            return
        self.preview_panel.set_frame(frame)

    def validatePage(self) -> bool:
        if not self.wizard().engine.camera_running:
            QMessageBox.warning(self, "Camera", "Start the camera preview before continuing.")
            return False
        return True

    def nextId(self) -> int:
        return PAGE_PRODUCT_SETUP


class ProductSetupPage(QWizardPage):
    """Step 2: product identity, angle name, and Fixed/Free-Pose inspection
    mode. Commits the product+angle to the database immediately (so later
    pages can call engine.select_angle()/save_good_reference_from_image()) -
    revisiting this page via Back does not create duplicates."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setTitle("Product Setup")
        self.setSubTitle("Name the product and choose how it will be inspected.")

        form = QFormLayout(self)
        self.name_edit = QLineEdit()
        form.addRow("Product name", self.name_edit)
        self.part_number_edit = QLineEdit()
        form.addRow("Part number", self.part_number_edit)
        self.description_edit = QLineEdit()
        form.addRow("Description", self.description_edit)
        self.customer_edit = QLineEdit()
        form.addRow("Customer / project", self.customer_edit)
        self.notes_edit = QPlainTextEdit()
        self.notes_edit.setFixedHeight(50)
        form.addRow("Notes", self.notes_edit)
        self.angle_edit = QLineEdit("front")
        form.addRow("Angle / view name", self.angle_edit)

        self.mode_combo = QComboBox()
        self.mode_combo.addItem("Fixed Reference (simpler, product always in the same spot)", config.INSPECTION_MODE_FIXED)
        self.mode_combo.addItem("Free Position / Continuous Rotation (product can be anywhere/any angle)", config.INSPECTION_MODE_FREE_POSE)
        form.addRow("Inspection mode", self.mode_combo)

    def validatePage(self) -> bool:
        name = self.name_edit.text().strip()
        angle_name = self.angle_edit.text().strip()
        if not name:
            QMessageBox.warning(self, "Product Setup", "Enter a product name.")
            return False
        if not angle_name:
            QMessageBox.warning(self, "Product Setup", "Enter an angle/view name.")
            return False

        wiz = self.wizard()
        wiz.mode = self.mode_combo.currentData()
        wiz.engine.set_inspection_mode(wiz.mode)

        if wiz.product_id is None:
            wiz.product_id = wiz.engine.db.create_product(
                name, part_number=self.part_number_edit.text().strip(),
                description=self.description_edit.text().strip(),
                customer=self.customer_edit.text().strip(),
                notes=self.notes_edit.toPlainText().strip(),
            )
        if wiz.angle_id is None:
            wiz.angle_id = wiz.engine.db.create_angle(wiz.product_id, angle_name)
        wiz.engine.select_angle(wiz.angle_id)
        return True

    def nextId(self) -> int:
        if self.wizard().mode == config.INSPECTION_MODE_FREE_POSE:
            return PAGE_DEFINE_OBJECT
        return PAGE_SAVE_REFERENCES


class DefineObjectROIPage(QWizardPage):
    """Step 3 (V2 only): confirm/override the product boundary. The
    auto-detected contour bbox is pre-filled; the operator can accept it or
    drag a manual override, which becomes the stored manual_bbox for every
    later reference of this product/angle."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setTitle("Define Object")
        self.setSubTitle("Confirm the product boundary, or drag a rectangle to override it.")

        layout = QVBoxLayout(self)
        self.roi_widget = RegionDrawWidget(single_rect=True)
        self.roi_widget.setMinimumSize(480, 360)
        layout.addWidget(self.roi_widget)

        button_row = QHBoxLayout()
        recapture_button = QPushButton("Recapture + Auto-Detect")
        recapture_button.clicked.connect(self._on_recapture)
        button_row.addWidget(recapture_button)
        layout.addLayout(button_row)

    def initializePage(self) -> None:
        wiz = self.wizard()
        if wiz.captured_frame is None:
            self._capture_and_detect()
        else:
            self.roi_widget.set_image(wiz.captured_frame)
            height, width = wiz.captured_frame.shape[:2]
            x0, y0, x1, y1 = wiz.manual_bbox
            self.roi_widget.set_rect((x0 / width, y0 / height, x1 / width, y1 / height))

    def _capture_and_detect(self) -> None:
        wiz = self.wizard()
        try:
            frame = wiz.engine.read_frame()
        except Exception as exc:
            QMessageBox.warning(self, "Camera", str(exc))
            return
        wiz.captured_frame = frame
        height, width = frame.shape[:2]
        bbox = compare_v2.detect_product_bbox(frame) or (0, 0, width, height)
        wiz.manual_bbox = bbox
        self.roi_widget.set_image(frame)
        x0, y0, x1, y1 = bbox
        self.roi_widget.set_rect((x0 / width, y0 / height, x1 / width, y1 / height))

    def _on_recapture(self) -> None:
        self._capture_and_detect()

    def validatePage(self) -> bool:
        rect = self.roi_widget.roi_rect()
        if rect is None:
            QMessageBox.warning(self, "Define Object", "Draw or accept a product boundary first.")
            return False
        wiz = self.wizard()
        height, width = wiz.captured_frame.shape[:2]
        frac_x0, frac_y0, frac_x1, frac_y1 = rect
        wiz.manual_bbox = (
            int(round(frac_x0 * width)), int(round(frac_y0 * height)),
            int(round(frac_x1 * width)), int(round(frac_y1 * height)),
        )
        return True

    def nextId(self) -> int:
        return PAGE_DEFINE_FEATURES


class DefineFeaturesRegionsPage(QWizardPage):
    """Step 4 (V2 only): drag named, typed rectangles over the canonical
    (product-cropped, 480x480) preview. Staged in wizard().regions as plain
    fraction dicts - nothing touches the database until Finish."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setTitle("Define Inspection Features")
        self.setSubTitle("Drag a rectangle over each feature you want individually checked, then name it.")

        layout = QVBoxLayout(self)
        self.regions_widget = RegionDrawWidget(single_rect=False)
        self.regions_widget.setMinimumSize(480, 480)
        self.regions_widget.regions_changed.connect(self._on_regions_changed)
        layout.addWidget(self.regions_widget)

        button_row = QHBoxLayout()
        undo_button = QPushButton("Undo Last")
        undo_button.clicked.connect(self.regions_widget.remove_last)
        clear_button = QPushButton("Clear All")
        clear_button.clicked.connect(self.regions_widget.clear)
        button_row.addWidget(undo_button)
        button_row.addWidget(clear_button)
        layout.addLayout(button_row)

    def initializePage(self) -> None:
        wiz = self.wizard()
        x0, y0, x1, y1 = wiz.manual_bbox
        crop = wiz.captured_frame[y0:y1, x0:x1]
        wiz.canonical_preview = cv2.resize(crop, config.CANONICAL_SIZE)
        self.regions_widget.set_image(wiz.canonical_preview)
        self.regions_widget.load_regions(wiz.regions)

    def _on_regions_changed(self) -> None:
        self.wizard().regions = self.regions_widget.regions()

    def nextId(self) -> int:
        return PAGE_SAVE_REFERENCES


class SaveGoodReferencesPage(QWizardPage):
    """Step 5: capture one or more GOOD reference images. Each is saved with
    the manual_bbox override (if this product is V2/Free-Pose) so later
    inspections reuse it instead of recomputing a contour."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setTitle("Save GOOD References")
        self.setSubTitle("Capture at least one GOOD reference image of the product.")

        layout = QVBoxLayout(self)
        self.preview_panel = ImagePreviewPanel("Live Preview", preview_size=(480, 320))
        layout.addWidget(self.preview_panel)

        capture_button = QPushButton("Capture Reference")
        capture_button.clicked.connect(self._on_capture)
        layout.addWidget(capture_button)

        self.count_label = QLabel("References captured: 0")
        layout.addWidget(self.count_label)

        self._timer = QTimer(self)
        self._timer.setInterval(_PREVIEW_INTERVAL_MS)
        self._timer.timeout.connect(self._update_preview)
        self._captured_count = 0

    def initializePage(self) -> None:
        self._timer.start()

    def cleanupPage(self) -> None:
        self._timer.stop()

    def _update_preview(self) -> None:
        try:
            frame = self.wizard().engine.camera.read_frame()
        except Exception:
            return
        self.preview_panel.set_frame(frame)

    def _on_capture(self) -> None:
        wiz = self.wizard()
        manual_bbox = wiz.manual_bbox if wiz.mode == config.INSPECTION_MODE_FREE_POSE else None
        try:
            if manual_bbox is None:
                wiz.engine.save_good_reference()
            else:
                wiz.engine.save_good_reference_from_image(wiz.engine.read_frame(), manual_bbox=manual_bbox)
        except Exception as exc:
            QMessageBox.warning(self, "Save GOOD Reference", str(exc))
            return
        self._captured_count += 1
        self.count_label.setText(f"References captured: {self._captured_count}")
        wiz.on_change()

    def validatePage(self) -> bool:
        if self._captured_count < 1:
            QMessageBox.warning(self, "Save GOOD References", "Capture at least one GOOD reference image.")
            return False
        return True

    def nextId(self) -> int:
        if self.wizard().mode == config.INSPECTION_MODE_FREE_POSE:
            return PAGE_TEST_INSPECTION
        return PAGE_FINISH


class TestInspectionPage(QWizardPage):
    """Step 6 (V2 only): run a real test inspection and score the staged
    (not-yet-committed) regions directly, so the operator sees per-feature
    PASS/FAIL before anything is saved to the database."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setTitle("Test Inspection")
        self.setSubTitle("Run a test inspection to confirm each feature scores as expected.")

        layout = QVBoxLayout(self)
        self.regions_widget = RegionDrawWidget(single_rect=False)
        self.regions_widget.setMinimumSize(480, 480)
        layout.addWidget(self.regions_widget)

        run_button = QPushButton("Run Test Inspection")
        run_button.clicked.connect(self._on_run_test)
        layout.addWidget(run_button)

        self.result_label = QLabel("—")
        layout.addWidget(self.result_label)

    def initializePage(self) -> None:
        wiz = self.wizard()
        self.regions_widget.set_image(wiz.canonical_preview)
        self.regions_widget.load_regions(wiz.regions)
        self.result_label.setText("—")

    def _on_run_test(self) -> None:
        wiz = self.wizard()
        try:
            wiz.engine.capture_inspection_image()
            result = wiz.engine.compute_comparison_v2()
        except Exception as exc:
            QMessageBox.warning(self, "Test Inspection", str(exc))
            return
        self.result_label.setText(f"{result.result} ({result.final_score:.1f}%)")
        if wiz.regions and result.ref_gray is not None and result.norm_gray is not None:
            scores = compare_v2.score_regions(result.ref_gray, result.norm_gray, wiz.regions)
            self.regions_widget.set_region_results(scores)
        wiz.on_change()

    def nextId(self) -> int:
        return PAGE_FINISH


class FinishPage(QWizardPage):
    """Step 7: summary. Committing the staged region list to the database
    happens here, in validatePage() (called when Finish is clicked) -
    everything before this point only touched in-memory wizard state."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setTitle("Finish")
        self.setSubTitle("Review the summary, then click Finish to save the inspection plan.")
        self.summary_label = QLabel()
        self.summary_label.setWordWrap(True)
        layout = QVBoxLayout(self)
        layout.addWidget(self.summary_label)

    def initializePage(self) -> None:
        wiz = self.wizard()
        mode_label = "Free Position / Continuous Rotation" if wiz.mode == config.INSPECTION_MODE_FREE_POSE else "Fixed Reference"
        self.summary_label.setText(
            f"Product: {wiz.engine.db.get_product(wiz.product_id)['name']}\n"
            f"Mode: {mode_label}\n"
            f"Inspection features defined: {len(wiz.regions)}\n\n"
            "Click Finish to save this inspection plan."
        )

    def validatePage(self) -> bool:
        wiz = self.wizard()
        for index, region in enumerate(wiz.regions):
            wiz.engine.db.add_region(
                wiz.product_id, wiz.angle_id,
                region_name=region["region_name"], region_type=region["region_type"],
                frac_x0=region["frac_x0"], frac_y0=region["frac_y0"],
                frac_x1=region["frac_x1"], frac_y1=region["frac_y1"],
                sort_order=index,
            )
        wiz.on_change()
        return True

    def nextId(self) -> int:
        return -1


class TeachProductWizard(QWizard):
    """Guided "teach a new product" flow. Holds staged, not-yet-committed
    state shared across pages as plain attributes (product_id/angle_id are
    the exception - committed early in ProductSetupPage since later pages
    need an active engine.location to capture references)."""

    def __init__(self, engine: QCApp, on_change, parent=None):
        super().__init__(parent)
        self.engine = engine
        self.on_change = on_change

        self.mode: str = config.INSPECTION_MODE_FIXED
        self.product_id: int | None = None
        self.angle_id: int | None = None
        self.captured_frame: np.ndarray | None = None
        self.manual_bbox: tuple[int, int, int, int] | None = None
        self.canonical_preview: np.ndarray | None = None
        self.regions: list[dict] = []

        self.setWindowTitle("Teach Product")
        self.setMinimumSize(720, 640)

        self.setPage(PAGE_SELECT_CAMERA, SelectCameraPage())
        self.setPage(PAGE_PRODUCT_SETUP, ProductSetupPage())
        self.setPage(PAGE_DEFINE_OBJECT, DefineObjectROIPage())
        self.setPage(PAGE_DEFINE_FEATURES, DefineFeaturesRegionsPage())
        self.setPage(PAGE_SAVE_REFERENCES, SaveGoodReferencesPage())
        self.setPage(PAGE_TEST_INSPECTION, TestInspectionPage())
        self.setPage(PAGE_FINISH, FinishPage())
        self.setStartId(PAGE_SELECT_CAMERA)

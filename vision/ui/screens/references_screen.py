from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QHBoxLayout, QLabel, QListWidget, QListWidgetItem, QMessageBox,
    QPushButton, QVBoxLayout, QWidget,
)

from core.app import QCApp

from ..dialogs import SelectProductAngleDialog
from ..widgets import ImagePreviewPanel

_ID_ROLE = Qt.ItemDataRole.UserRole


class ReferencesScreen(QWidget):
    """Manage GOOD reference images for the currently selected product/angle.
    V1 always compares against the primary reference; the rest are kept for
    future multi-reference comparison."""

    def __init__(self, engine: QCApp, on_change, parent=None):
        super().__init__(parent)
        self.engine = engine
        self.on_change = on_change
        self._build_ui()
        self.refresh()

    def _build_ui(self) -> None:
        root = QHBoxLayout(self)
        root.setContentsMargins(24, 16, 24, 16)
        root.setSpacing(16)

        left = QVBoxLayout()
        self.selection_label = QLabel("PRODUCT / ANGLE: —")
        self.selection_label.setObjectName("sectionTitle")
        left.addWidget(self.selection_label)

        select_button = QPushButton("Select Product / Angle")
        select_button.clicked.connect(self._on_select)
        left.addWidget(select_button)

        self.reference_list = QListWidget()
        self.reference_list.currentItemChanged.connect(self._on_reference_selected)
        left.addWidget(self.reference_list)

        button_row = QHBoxLayout()
        add_button = QPushButton("Add Reference (capture)")
        add_button.clicked.connect(self._on_add_reference)
        primary_button = QPushButton("Mark Primary")
        primary_button.clicked.connect(self._on_mark_primary)
        delete_button = QPushButton("Delete")
        delete_button.clicked.connect(self._on_delete_reference)
        for button in (add_button, primary_button, delete_button):
            button_row.addWidget(button)
        left.addLayout(button_row)
        root.addLayout(left, stretch=1)

        self.preview_panel = ImagePreviewPanel("Reference Preview")
        root.addWidget(self.preview_panel)

    # ------------------------------------------------------------- actions

    def _on_select(self) -> None:
        dialog = SelectProductAngleDialog(self.engine.db, self)
        if dialog.exec() == SelectProductAngleDialog.DialogCode.Accepted and dialog.selected_angle_id:
            self.engine.select_angle(dialog.selected_angle_id)
            self.refresh()
            self.on_change()

    def _on_add_reference(self) -> None:
        if self.engine.current_angle is None:
            QMessageBox.warning(self, "Add Reference", "Select a product/angle first.")
            return
        if not self.engine.camera_running:
            QMessageBox.warning(self, "Add Reference", "Start the camera on the Inspection screen first.")
            return
        self.engine.save_good_reference()
        self._load_references()
        self.on_change()

    def _on_mark_primary(self) -> None:
        item = self.reference_list.currentItem()
        if item is None:
            return
        ref = item.data(_ID_ROLE)
        self.engine.db.set_primary_reference(self.engine.current_angle["id"], ref["id"])
        self._load_references()
        self.on_change()

    def _on_delete_reference(self) -> None:
        item = self.reference_list.currentItem()
        if item is None:
            return
        reply = QMessageBox.question(
            self, "Delete Reference", "Delete this reference image?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return
        ref = item.data(_ID_ROLE)
        self.engine.db.delete_reference_image(ref["id"])
        self._load_references()
        self.on_change()

    def _on_reference_selected(self, current, _previous=None) -> None:
        if current is None:
            self.preview_panel.clear()
            return
        ref = current.data(_ID_ROLE)
        self.preview_panel.set_image_path(ref["image_path"])

    def _load_references(self) -> None:
        self.reference_list.clear()
        if self.engine.current_angle is None:
            return
        for ref in self.engine.db.list_reference_images(self.engine.current_angle["id"]):
            label = Path(ref["image_path"]).name
            if ref["is_primary"]:
                label += "  [PRIMARY]"
            item = QListWidgetItem(label)
            item.setData(_ID_ROLE, ref)
            self.reference_list.addItem(item)

    # ------------------------------------------------------------ refresh

    def refresh(self) -> None:
        if self.engine.current_product and self.engine.current_angle:
            self.selection_label.setText(
                f"PRODUCT / ANGLE: {self.engine.current_product['name']} / {self.engine.current_angle['angle_name']}"
            )
        else:
            self.selection_label.setText("PRODUCT / ANGLE: —")
        self._load_references()

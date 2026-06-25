from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QDialog, QDialogButtonBox, QFormLayout, QHBoxLayout, QInputDialog,
    QLabel, QLineEdit, QListWidget, QListWidgetItem, QPlainTextEdit,
    QVBoxLayout, QWidget,
)

from core.db import Database

_ID_ROLE = Qt.ItemDataRole.UserRole


def prompt_text(parent: QWidget, title: str, label: str) -> str | None:
    text, ok = QInputDialog.getText(parent, title, label)
    text = text.strip()
    if not ok or not text:
        return None
    return text


class AddEditProductDialog(QDialog):
    """Add or edit a product: name, part number, description, customer, notes."""

    def __init__(self, parent=None, product: dict | None = None):
        super().__init__(parent)
        self.setWindowTitle("Edit Product" if product else "Add Product")
        self.setMinimumWidth(420)
        form = QFormLayout(self)

        self.name_edit = QLineEdit(product["name"] if product else "")
        self.part_number_edit = QLineEdit(product["part_number"] if product else "")
        self.description_edit = QLineEdit(product["description"] if product else "")
        self.customer_edit = QLineEdit(product["customer"] if product else "")
        self.notes_edit = QPlainTextEdit(product["notes"] if product else "")
        self.notes_edit.setFixedHeight(60)

        form.addRow("Name", self.name_edit)
        form.addRow("Part number", self.part_number_edit)
        form.addRow("Description", self.description_edit)
        form.addRow("Customer / project", self.customer_edit)
        form.addRow("Notes", self.notes_edit)

        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        form.addRow(buttons)

    def _on_accept(self) -> None:
        if not self.name_edit.text().strip():
            self.name_edit.setFocus()
            return
        self.accept()

    def values(self) -> dict:
        return {
            "name": self.name_edit.text().strip(),
            "part_number": self.part_number_edit.text().strip(),
            "description": self.description_edit.text().strip(),
            "customer": self.customer_edit.text().strip(),
            "notes": self.notes_edit.toPlainText().strip(),
        }


class SelectProductAngleDialog(QDialog):
    """Lets the operator pick an existing product/angle from the database."""

    def __init__(self, db: Database, parent=None):
        super().__init__(parent)
        self.db = db
        self.setWindowTitle("Select Product / Angle")
        self.setMinimumSize(440, 320)
        self.selected_product_id: int | None = None
        self.selected_angle_id: int | None = None

        root = QVBoxLayout(self)

        lists_row = QHBoxLayout()
        product_col = QVBoxLayout()
        product_col.addWidget(QLabel("PRODUCT"))
        self.product_list = QListWidget()
        product_col.addWidget(self.product_list)
        lists_row.addLayout(product_col)

        angle_col = QVBoxLayout()
        angle_col.addWidget(QLabel("ANGLE"))
        self.angle_list = QListWidget()
        angle_col.addWidget(self.angle_list)
        lists_row.addLayout(angle_col)

        root.addLayout(lists_row)

        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        root.addWidget(buttons)

        self.product_list.currentItemChanged.connect(self._load_angles)
        self._load_products()

    def _load_products(self) -> None:
        self.product_list.clear()
        for product in self.db.list_products():
            item = QListWidgetItem(product["name"])
            item.setData(_ID_ROLE, product["id"])
            self.product_list.addItem(item)

    def _load_angles(self, current: QListWidgetItem, _previous=None) -> None:
        self.angle_list.clear()
        if current is None:
            return
        product_id = current.data(_ID_ROLE)
        for angle in self.db.list_angles(product_id):
            item = QListWidgetItem(angle["angle_name"])
            item.setData(_ID_ROLE, angle["id"])
            self.angle_list.addItem(item)

    def _on_accept(self) -> None:
        product_item = self.product_list.currentItem()
        angle_item = self.angle_list.currentItem()
        if product_item is None or angle_item is None:
            return
        self.selected_product_id = product_item.data(_ID_ROLE)
        self.selected_angle_id = angle_item.data(_ID_ROLE)
        self.accept()

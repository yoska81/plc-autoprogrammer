from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QAbstractItemView, QHBoxLayout, QLabel, QListWidget, QListWidgetItem,
    QMessageBox, QPushButton, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget,
)

from core.app import QCApp

from ..dialogs import AddEditProductDialog, prompt_text

_ID_ROLE = Qt.ItemDataRole.UserRole


class ProductsScreen(QWidget):
    """Add/edit/delete products and manage each product's angles."""

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
        title = QLabel("PRODUCTS")
        title.setObjectName("sectionTitle")
        left.addWidget(title)

        self.product_table = QTableWidget(0, 4)
        self.product_table.setHorizontalHeaderLabels(["Name", "Part Number", "Customer", "Angles"])
        self.product_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.product_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.product_table.verticalHeader().setVisible(False)
        self.product_table.horizontalHeader().setStretchLastSection(True)
        self.product_table.itemSelectionChanged.connect(self._load_angles)
        left.addWidget(self.product_table)

        button_row = QHBoxLayout()
        add_button = QPushButton("Add Product")
        add_button.clicked.connect(self._on_add_product)
        edit_button = QPushButton("Edit Product")
        edit_button.clicked.connect(self._on_edit_product)
        delete_button = QPushButton("Delete Product")
        delete_button.clicked.connect(self._on_delete_product)
        for button in (add_button, edit_button, delete_button):
            button_row.addWidget(button)
        left.addLayout(button_row)
        root.addLayout(left, stretch=2)

        right = QVBoxLayout()
        angle_title = QLabel("ANGLES")
        angle_title.setObjectName("sectionTitle")
        right.addWidget(angle_title)
        self.angle_list = QListWidget()
        right.addWidget(self.angle_list)

        angle_button_row = QHBoxLayout()
        add_angle_button = QPushButton("Add Angle")
        add_angle_button.clicked.connect(self._on_add_angle)
        delete_angle_button = QPushButton("Delete Angle")
        delete_angle_button.clicked.connect(self._on_delete_angle)
        angle_button_row.addWidget(add_angle_button)
        angle_button_row.addWidget(delete_angle_button)
        right.addLayout(angle_button_row)
        root.addLayout(right, stretch=1)

    # ------------------------------------------------------------- helpers

    def _selected_product_id(self) -> int | None:
        row = self.product_table.currentRow()
        if row < 0:
            return None
        item = self.product_table.item(row, 0)
        return item.data(_ID_ROLE) if item else None

    # ------------------------------------------------------------- actions

    def _on_add_product(self) -> None:
        dialog = AddEditProductDialog(self)
        if dialog.exec() != AddEditProductDialog.DialogCode.Accepted:
            return
        self.engine.db.create_product(**dialog.values())
        self.refresh()
        self.on_change()

    def _on_edit_product(self) -> None:
        product_id = self._selected_product_id()
        if product_id is None:
            QMessageBox.warning(self, "Edit Product", "Select a product first.")
            return
        product = self.engine.db.get_product(product_id)
        dialog = AddEditProductDialog(self, product=product)
        if dialog.exec() != AddEditProductDialog.DialogCode.Accepted:
            return
        self.engine.db.update_product(product_id, **dialog.values())
        self.refresh()
        self.on_change()

    def _on_delete_product(self) -> None:
        product_id = self._selected_product_id()
        if product_id is None:
            QMessageBox.warning(self, "Delete Product", "Select a product first.")
            return
        product = self.engine.db.get_product(product_id)
        reply = QMessageBox.question(
            self, "Delete Product",
            f"Delete '{product['name']}' and all its angles, reference images, "
            "and inspection history? This cannot be undone.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return
        self.engine.db.delete_product(product_id)
        if self.engine.current_product and self.engine.current_product["id"] == product_id:
            self.engine.current_product = None
            self.engine.current_angle = None
            self.engine.location = None
        self.refresh()
        self.on_change()

    def _on_add_angle(self) -> None:
        product_id = self._selected_product_id()
        if product_id is None:
            QMessageBox.warning(self, "Add Angle", "Select a product first.")
            return
        name = prompt_text(self, "Add Angle", "Angle name:")
        if not name:
            return
        self.engine.db.create_angle(product_id, name)
        self._load_angles()
        self.on_change()

    def _on_delete_angle(self) -> None:
        items = self.angle_list.selectedItems()
        if not items:
            QMessageBox.warning(self, "Delete Angle", "Select an angle first.")
            return
        angle_id = items[0].data(_ID_ROLE)
        reply = QMessageBox.question(
            self, "Delete Angle",
            "Delete this angle and all its reference images and inspection history? "
            "This cannot be undone.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return
        self.engine.db.delete_angle(angle_id)
        if self.engine.current_angle and self.engine.current_angle["id"] == angle_id:
            self.engine.current_angle = None
            self.engine.location = None
        self._load_angles()
        self.on_change()

    def _load_angles(self) -> None:
        self.angle_list.clear()
        product_id = self._selected_product_id()
        if product_id is None:
            return
        for angle in self.engine.db.list_angles(product_id):
            ref_count = len(self.engine.db.list_reference_images(angle["id"]))
            item = QListWidgetItem(f"{angle['angle_name']} ({ref_count} reference image(s))")
            item.setData(_ID_ROLE, angle["id"])
            self.angle_list.addItem(item)

    # ------------------------------------------------------------ refresh

    def refresh(self) -> None:
        selected_id = self._selected_product_id()
        products = self.engine.db.list_products()
        self.product_table.setRowCount(len(products))
        for r, product in enumerate(products):
            angle_count = len(self.engine.db.list_angles(product["id"]))
            values = [product["name"], product["part_number"], product["customer"], str(angle_count)]
            for c, value in enumerate(values):
                item = QTableWidgetItem(value)
                if c == 0:
                    item.setData(_ID_ROLE, product["id"])
                self.product_table.setItem(r, c, item)
            if selected_id == product["id"]:
                self.product_table.selectRow(r)
        self._load_angles()

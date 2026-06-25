from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QCheckBox, QComboBox, QDialog, QDialogButtonBox, QFormLayout, QHBoxLayout, QInputDialog,
    QLabel, QLineEdit, QListWidget, QListWidgetItem, QPlainTextEdit, QSpinBox,
    QVBoxLayout, QWidget,
)

from core import config
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


class AddEditCameraDialog(QDialog):
    """Add or edit one camera/station row (core/db.py's `cameras` table):
    station name, camera type, device index or IP address, resolution/FPS,
    assigned product/angle, inspection mode, trigger source, save-images,
    notes. Used by the Cameras/Stations screen."""

    def __init__(self, db: Database, parent=None, camera: dict | None = None):
        super().__init__(parent)
        self.db = db
        self.setWindowTitle("Edit Station" if camera else "Add Station")
        self.setMinimumWidth(440)
        form = QFormLayout(self)

        self.name_edit = QLineEdit(camera["station_name"] if camera else "")
        form.addRow("Station name", self.name_edit)

        self.camera_type_combo = QComboBox()
        self.camera_type_combo.addItems(config.CAMERA_TYPE_CHOICES)
        if camera:
            self.camera_type_combo.setCurrentText(camera["camera_type"])
        self.camera_type_combo.currentTextChanged.connect(self._update_address_field)
        form.addRow("Camera type", self.camera_type_combo)

        self.device_index_spin = QSpinBox()
        self.device_index_spin.setRange(0, 50)
        self.device_index_spin.setValue(camera["device_index"] if camera and camera.get("device_index") is not None else 0)
        form.addRow("Device index (USB/test)", self.device_index_spin)

        self.ip_address_edit = QLineEdit(camera.get("ip_address") or "" if camera else "")
        self.ip_address_edit.setPlaceholderText("e.g. 192.168.1.50 (GigE/IP cameras)")
        form.addRow("IP address (GigE/IP)", self.ip_address_edit)

        self.width_spin = QSpinBox()
        self.width_spin.setRange(160, 7680)
        self.width_spin.setValue(camera["width"] if camera else config.DEFAULT_FRAME_WIDTH)
        self.height_spin = QSpinBox()
        self.height_spin.setRange(120, 4320)
        self.height_spin.setValue(camera["height"] if camera else config.DEFAULT_FRAME_HEIGHT)
        resolution_row = QHBoxLayout()
        resolution_row.addWidget(self.width_spin)
        resolution_row.addWidget(QLabel("x"))
        resolution_row.addWidget(self.height_spin)
        form.addRow("Resolution", resolution_row)

        self.fps_spin = QSpinBox()
        self.fps_spin.setRange(1, 120)
        self.fps_spin.setValue(camera["fps"] if camera else 30)
        form.addRow("FPS", self.fps_spin)

        self.product_combo = QComboBox()
        self.product_combo.addItem("(none)", None)
        for product in self.db.list_products():
            self.product_combo.addItem(product["name"], product["id"])
        self.product_combo.currentIndexChanged.connect(self._load_angles)
        form.addRow("Assigned product", self.product_combo)

        self.angle_combo = QComboBox()
        form.addRow("Assigned angle/view", self.angle_combo)

        self.inspection_mode_combo = QComboBox()
        self.inspection_mode_combo.addItem("Fixed Reference (V1)", config.INSPECTION_MODE_FIXED)
        self.inspection_mode_combo.addItem("Free Position / Continuous Rotation (V2)", config.INSPECTION_MODE_FREE_POSE)
        form.addRow("Inspection mode", self.inspection_mode_combo)

        self.trigger_source_combo = QComboBox()
        self.trigger_source_combo.addItem("Manual", config.TRIGGER_SOURCE_MANUAL)
        self.trigger_source_combo.addItem("Simulation", config.TRIGGER_SOURCE_SIMULATION)
        self.trigger_source_combo.addItem("Machine Signal (future)", config.TRIGGER_SOURCE_MACHINE_SIGNAL)
        form.addRow("Trigger source", self.trigger_source_combo)

        self.save_images_check = QCheckBox("Save images")
        self.save_images_check.setChecked(camera["save_images"] if camera else True)
        form.addRow(self.save_images_check)

        self.notes_edit = QPlainTextEdit(camera["notes"] if camera and camera.get("notes") else "")
        self.notes_edit.setFixedHeight(50)
        form.addRow("Notes", self.notes_edit)

        if camera:
            self._select_combo_data(self.product_combo, camera.get("product_id"))
            self._load_angles()
            self._select_combo_data(self.angle_combo, camera.get("angle_id"))
            self._select_combo_data(self.inspection_mode_combo, camera.get("inspection_mode"))
            self._select_combo_data(self.trigger_source_combo, camera.get("trigger_source"))
        else:
            self._load_angles()
        self._update_address_field(self.camera_type_combo.currentText())

        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        form.addRow(buttons)

    @staticmethod
    def _select_combo_data(combo: QComboBox, data) -> None:
        for i in range(combo.count()):
            if combo.itemData(i) == data:
                combo.setCurrentIndex(i)
                return

    def _update_address_field(self, camera_type: str) -> None:
        is_network = camera_type in (config.CAMERA_TYPE_GIGE, config.CAMERA_TYPE_IP)
        self.ip_address_edit.setEnabled(is_network)
        self.device_index_spin.setEnabled(not is_network)

    def _load_angles(self) -> None:
        self.angle_combo.clear()
        self.angle_combo.addItem("(none)", None)
        product_id = self.product_combo.currentData()
        if product_id is None:
            return
        for angle in self.db.list_angles(product_id):
            self.angle_combo.addItem(angle["angle_name"], angle["id"])

    def _on_accept(self) -> None:
        if not self.name_edit.text().strip():
            self.name_edit.setFocus()
            return
        self.accept()

    def values(self) -> dict:
        return {
            "station_name": self.name_edit.text().strip(),
            "camera_type": self.camera_type_combo.currentText(),
            "device_index": self.device_index_spin.value(),
            "ip_address": self.ip_address_edit.text().strip() or None,
            "width": self.width_spin.value(),
            "height": self.height_spin.value(),
            "fps": self.fps_spin.value(),
            "product_id": self.product_combo.currentData(),
            "angle_id": self.angle_combo.currentData(),
            "inspection_mode": self.inspection_mode_combo.currentData(),
            "trigger_source": self.trigger_source_combo.currentData(),
            "save_images": self.save_images_check.isChecked(),
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

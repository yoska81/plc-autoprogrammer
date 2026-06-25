from PySide6.QtWidgets import (
    QComboBox, QDialog, QDialogButtonBox, QDoubleSpinBox, QFormLayout,
    QHBoxLayout, QInputDialog, QLabel, QListWidget, QSpinBox, QVBoxLayout, QWidget,
)

from core import config


def prompt_text(parent: QWidget, title: str, label: str) -> str | None:
    text, ok = QInputDialog.getText(parent, title, label)
    text = text.strip()
    if not ok or not text:
        return None
    return text


class SelectProductAngleDialog(QDialog):
    """Lets the operator browse existing product/angle folders under data/products/.

    Folder names are slugified (lowercase, underscores), so the list shows
    those slugs rather than the original free-text names typed at Add time.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Select Product / Angle")
        self.setMinimumSize(440, 320)
        self.selected_product: str | None = None
        self.selected_angle: str | None = None

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

        self.product_list.currentTextChanged.connect(self._load_angles)
        self._load_products()

    def _load_products(self) -> None:
        self.product_list.clear()
        if config.PRODUCTS_DIR.exists():
            for entry in sorted(p.name for p in config.PRODUCTS_DIR.iterdir() if p.is_dir()):
                self.product_list.addItem(entry)

    def _load_angles(self, product_slug: str) -> None:
        self.angle_list.clear()
        if not product_slug:
            return
        product_dir = config.PRODUCTS_DIR / product_slug
        if product_dir.exists():
            for entry in sorted(p.name for p in product_dir.iterdir() if p.is_dir()):
                self.angle_list.addItem(entry)

    def _on_accept(self) -> None:
        product_item = self.product_list.currentItem()
        angle_item = self.angle_list.currentItem()
        if product_item is None or angle_item is None:
            return
        self.selected_product = product_item.text()
        self.selected_angle = angle_item.text()
        self.accept()


class SettingsDialog(QDialog):
    def __init__(self, mode: str, device_index: int, threshold_percent: float, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Settings")
        form = QFormLayout(self)

        self.mode_combo = QComboBox()
        self.mode_combo.addItems(["auto", "real", "test"])
        self.mode_combo.setCurrentText(mode)
        form.addRow("Camera mode", self.mode_combo)

        self.device_spin = QSpinBox()
        self.device_spin.setRange(0, 10)
        self.device_spin.setValue(device_index)
        form.addRow("Device index", self.device_spin)

        self.threshold_spin = QDoubleSpinBox()
        self.threshold_spin.setRange(0.0, 100.0)
        self.threshold_spin.setDecimals(1)
        self.threshold_spin.setValue(threshold_percent)
        form.addRow("Match threshold %", self.threshold_spin)

        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        form.addRow(buttons)

    def values(self) -> tuple[str, int, float]:
        return self.mode_combo.currentText(), self.device_spin.value(), self.threshold_spin.value()

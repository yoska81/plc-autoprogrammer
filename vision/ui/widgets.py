from pathlib import Path

import cv2
import numpy as np
from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QAbstractItemView, QLabel, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget,
)

from .image_utils import frame_to_pixmap


class ImagePreviewPanel(QWidget):
    def __init__(self, title: str, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)

        caption = QLabel(title.upper())
        caption.setObjectName("sectionTitle")
        layout.addWidget(caption)

        self.image_label = QLabel("NO IMAGE")
        self.image_label.setObjectName("imagePreview")
        self.image_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.image_label.setFixedSize(340, 240)
        layout.addWidget(self.image_label)
        layout.addStretch()

    def set_frame(self, frame: np.ndarray) -> None:
        pixmap = frame_to_pixmap(frame)
        scaled = pixmap.scaled(
            self.image_label.size(),
            Qt.AspectRatioMode.KeepAspectRatio,
            Qt.TransformationMode.SmoothTransformation,
        )
        self.image_label.setPixmap(scaled)

    def set_image_path(self, path: Path) -> None:
        frame = cv2.imread(str(path))
        if frame is not None:
            self.set_frame(frame)

    def clear(self) -> None:
        self.image_label.clear()
        self.image_label.setText("NO IMAGE")


class ResultBadge(QLabel):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setMinimumWidth(220)
        self.set_state(None)

    def set_state(self, result: str | None) -> None:
        if result == "GOOD":
            self.setObjectName("resultBadgeGood")
            self.setText("GOOD")
        elif result == "BAD":
            self.setObjectName("resultBadgeBad")
            self.setText("BAD")
        else:
            self.setObjectName("resultBadgeNone")
            self.setText("—")
        self.style().unpolish(self)
        self.style().polish(self)


class HistoryTable(QTableWidget):
    """Renders rows shaped like core/db.py's list_inspections() output.
    `columns` is a list of (dict_key, header_label) pairs; defaults to a
    short summary suitable for the Inspection screen's recent-activity
    strip. The Reports screen passes the full core/reports.py column set."""

    DEFAULT_COLUMNS = [
        ("created_at", "Date/Time"),
        ("product_name", "Product"),
        ("angle_name", "Angle"),
        ("result", "Result"),
        ("score", "Score %"),
    ]

    def __init__(self, columns: list[tuple[str, str]] | None = None, parent=None):
        self.columns = columns or self.DEFAULT_COLUMNS
        super().__init__(0, len(self.columns), parent)
        self.setHorizontalHeaderLabels([label for _, label in self.columns])
        self.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.setSelectionMode(QAbstractItemView.SelectionMode.NoSelection)
        self.verticalHeader().setVisible(False)
        self.horizontalHeader().setStretchLastSection(True)

    def set_rows(self, rows: list[dict]) -> None:
        self.setRowCount(len(rows))
        for r, row in enumerate(rows):
            for c, (key, _label) in enumerate(self.columns):
                value = row.get(key, "")
                if value is None:
                    value = ""
                elif key == "score" and isinstance(value, (int, float)):
                    value = f"{value:.2f}"
                elif key.endswith("_path"):
                    value = Path(value).name
                self.setItem(r, c, QTableWidgetItem(str(value)))
        self.resizeColumnsToContents()

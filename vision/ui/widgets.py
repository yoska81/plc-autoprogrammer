from pathlib import Path

import cv2
import numpy as np
from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QAbstractItemView, QFrame, QHBoxLayout, QLabel, QTableWidget, QTableWidgetItem,
    QVBoxLayout, QWidget,
)

from .image_utils import frame_to_pixmap


class ImagePreviewPanel(QWidget):
    """An image preview with a caption. `large=True` is used for the one
    dominant panel on a screen (the live camera/test feed); the default
    (smaller) size is for secondary previews (GOOD reference, inspection
    image, difference image)."""

    def __init__(self, title: str, large: bool = False, live: bool = False, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        caption_row = QHBoxLayout()
        caption_row.setSpacing(8)
        caption = QLabel(title.upper())
        caption.setObjectName("panelTitle")
        caption_row.addWidget(caption)
        caption_row.addStretch()
        self.live_dot = QLabel("● LIVE")
        self.live_dot.setObjectName("liveDot")
        self.live_dot.setVisible(False)
        caption_row.addWidget(self.live_dot)
        layout.addLayout(caption_row)

        self.image_label = QLabel("NO IMAGE")
        self.image_label.setObjectName("imagePreviewLive" if large else "imagePreview")
        self.image_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        if large:
            self.image_label.setMinimumSize(760, 480)
        else:
            self.image_label.setFixedSize(300, 200)
        layout.addWidget(self.image_label, stretch=1 if large else 0)
        if not large:
            layout.addStretch()

        if live:
            self.set_live(False)

    def set_live(self, is_live: bool) -> None:
        self.live_dot.setVisible(is_live)

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
        self.setMinimumWidth(300)
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


class ResultPanel(QFrame):
    """Large, centered GOOD/BAD result card: the one thing an operator
    should be able to read from across the room."""

    _CARD_NAMES = {"GOOD": "resultCardGood", "BAD": "resultCardBad", None: "resultCardNone"}

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(32, 24, 32, 24)
        layout.setSpacing(10)

        self.badge = ResultBadge()
        layout.addWidget(self.badge, alignment=Qt.AlignmentFlag.AlignCenter)

        self.score_label = QLabel("SCORE: —")
        self.score_label.setObjectName("scoreLabel")
        self.score_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.score_label)

        self.set_result(None, None)

    def set_result(self, result: str | None, score_percent: float | None) -> None:
        self.badge.set_state(result)
        self.score_label.setText(f"SCORE: {score_percent:.2f}%" if score_percent is not None else "SCORE: —")
        self.setObjectName(self._CARD_NAMES.get(result, "resultCardNone"))
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
        self.verticalHeader().setDefaultSectionSize(34)
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

from pathlib import Path

import cv2
import numpy as np
from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QAbstractItemView, QFrame, QGridLayout, QHBoxLayout, QLabel, QListWidget,
    QListWidgetItem, QPushButton, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget,
)

from core import config

from .image_utils import frame_to_pixmap

# Matches ui/styles.py's QSS hex colors #00d97e/#ff4d4f/#ffb020 - the one
# Tesla-style green/red/yellow palette used everywhere a result is shown.
REGION_DOT_COLOR = {
    "PASS": QColor("#00d97e"),
    "FAIL": QColor("#ff4d4f"),
    "WARN": QColor("#ffb020"),
}


class ImagePreviewPanel(QWidget):
    """An image preview with a caption. `large=True` is used for the one
    dominant panel on a screen (the live camera/test feed); the default
    (smaller) size is for secondary previews (GOOD reference, inspection
    image, difference image)."""

    def __init__(self, title: str, large: bool = False, live: bool = False, zoomable: bool = False,
                 preview_size: tuple[int, int] = (300, 200), parent=None):
        super().__init__(parent)
        self._zoom_mode = "fit"
        self._last_pixmap = None
        self._large = large
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
        if zoomable:
            for label, mode in (("Fit", "fit"), ("100%", "100%")):
                button = QPushButton(label)
                button.setObjectName("zoomButton")
                button.setCheckable(True)
                button.setChecked(mode == "fit")
                button.clicked.connect(lambda _checked, m=mode: self._set_zoom_mode(m))
                caption_row.addWidget(button)
                if mode == "fit":
                    self._fit_button = button
                else:
                    self._hundred_button = button
        layout.addLayout(caption_row)

        self.image_label = QLabel("NO IMAGE")
        self.image_label.setObjectName("imagePreviewLive" if large else "imagePreview")
        self.image_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        if large:
            self.image_label.setMinimumSize(760, 480)
        else:
            self.image_label.setFixedSize(*preview_size)
        layout.addWidget(self.image_label, stretch=1 if large else 0)
        if not large:
            layout.addStretch()

        if live:
            self.set_live(False)

    def set_live(self, is_live: bool) -> None:
        self.live_dot.setVisible(is_live)

    def set_preview_size(self, size: tuple[int, int]) -> None:
        """Resizes a non-`large` panel's image area, e.g. for a Cameras
        screen scale slider. No-op on `large` panels (which size via layout
        stretch, not a fixed pixel size)."""
        if not self._large:
            self.image_label.setFixedSize(*size)

    def _set_zoom_mode(self, mode: str) -> None:
        self._zoom_mode = mode
        self._fit_button.setChecked(mode == "fit")
        self._hundred_button.setChecked(mode == "100%")
        if self._last_pixmap is not None:
            self._apply_pixmap(self._last_pixmap)

    def _apply_pixmap(self, pixmap) -> None:
        if self._zoom_mode == "100%":
            self.image_label.setPixmap(pixmap)
        else:
            scaled = pixmap.scaled(
                self.image_label.size(),
                Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation,
            )
            self.image_label.setPixmap(scaled)

    def set_frame(self, frame: np.ndarray) -> None:
        pixmap = frame_to_pixmap(frame)
        self._last_pixmap = pixmap
        self._apply_pixmap(pixmap)

    def set_image_path(self, path: Path) -> None:
        frame = cv2.imread(str(path))
        if frame is not None:
            self.set_frame(frame)

    def clear(self, message: str = "NO IMAGE") -> None:
        self._last_pixmap = None
        self.image_label.clear()
        self.image_label.setText(message)


class ResultBadge(QLabel):
    def __init__(self, parent=None, compact: bool = False):
        super().__init__(parent)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        if not compact:
            self.setMinimumWidth(300)
        self.set_state(None)

    _STATES = {
        "GOOD": ("resultBadgeGood", "GOOD"),
        "BAD": ("resultBadgeBad", "BAD"),
        # NO_PRODUCT_FOUND is a detection problem, not a quality failure - it
        # gets the warning color (yellow/orange), never the BAD color (red).
        "NO_PRODUCT_FOUND": ("resultBadgeWarn", "NO PRODUCT FOUND"),
        "SKIPPED": ("resultBadgeSkipped", "SKIPPED — NO PRODUCT FOUND"),
        "ERROR": ("resultBadgeWarn", "ERROR"),
    }

    def set_state(self, result: str | None) -> None:
        object_name, text = self._STATES.get(result, ("resultBadgeNone", "—"))
        self.setObjectName(object_name)
        self.setText(text)
        self.style().unpolish(self)
        self.style().polish(self)


class ResultPanel(QFrame):
    """Large, centered GOOD/BAD result card: the one thing an operator
    should be able to read from across the room."""

    _CARD_NAMES = {
        "GOOD": "resultCardGood",
        "BAD": "resultCardBad",
        "NO_PRODUCT_FOUND": "resultCardWarn",
        "SKIPPED": "resultCardSkipped",
        "ERROR": "resultCardWarn",
        None: "resultCardNone",
    }

    def __init__(self, parent=None, compact: bool = False):
        super().__init__(parent)
        self._compact = compact
        if compact:
            layout = QHBoxLayout(self)
            layout.setContentsMargins(16, 8, 16, 8)
            layout.setSpacing(14)
        else:
            layout = QVBoxLayout(self)
            layout.setContentsMargins(32, 24, 32, 24)
            layout.setSpacing(10)

        self.badge = ResultBadge(compact=compact)
        self.badge.setProperty("compact", "true" if compact else "false")
        if compact:
            layout.addWidget(self.badge, alignment=Qt.AlignmentFlag.AlignVCenter)
        else:
            layout.addWidget(self.badge, alignment=Qt.AlignmentFlag.AlignCenter)

        self.score_label = QLabel("SCORE: —")
        self.score_label.setObjectName("scoreLabel")
        self.score_label.setProperty("compact", "true" if compact else "false")
        self.score_label.setAlignment(
            Qt.AlignmentFlag.AlignVCenter if compact else Qt.AlignmentFlag.AlignCenter
        )
        layout.addWidget(self.score_label)
        if compact:
            layout.addStretch()

        self.setProperty("compact", "true" if compact else "false")
        self.set_result(None, None)

    def set_result(self, result: str | None, score_percent: float | None) -> None:
        self.badge.set_state(result)
        self.score_label.setText(f"SCORE: {score_percent:.2f}%" if score_percent is not None else "SCORE: —")
        self.setObjectName(self._CARD_NAMES.get(result, "resultCardNone"))
        self.style().unpolish(self)
        self.style().polish(self)
        self.style().unpolish(self.badge)
        self.style().polish(self.badge)
        self.style().unpolish(self.score_label)
        self.style().polish(self.score_label)


class RegionPlanList(QFrame):
    """The 'Inspection Plan' panel: one row per named inspection region
    (core/compare_v2.RegionScore), each with a colored PASS/FAIL/WARN dot,
    the region name, and its combined score - what makes a V2 inspection
    explainable instead of a single opaque GOOD/BAD number. Empty (just a
    placeholder message) for products with no regions defined."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("panelCard")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(8)

        caption = QLabel("INSPECTION PLAN")
        caption.setObjectName("panelTitle")
        layout.addWidget(caption)

        self.list_widget = QListWidget()
        self.list_widget.setFrameShape(QFrame.Shape.NoFrame)
        layout.addWidget(self.list_widget, stretch=1)

        self.empty_label = QLabel("No named regions defined for this product/angle.")
        self.empty_label.setObjectName("infoLabel")
        self.empty_label.setWordWrap(True)
        layout.addWidget(self.empty_label)
        self.empty_label.setVisible(True)
        self.list_widget.setVisible(False)

    def set_regions(self, region_scores: list | None) -> None:
        """Accepts either core.compare_v2.RegionScore objects (attribute
        access) or plain dicts shaped like db.list_region_results() rows
        (e.g. from CameraDetailScreen, which reads history, not a live
        RegionScore) - both have the same region_name/result/combined_score
        fields, just accessed differently."""
        self.list_widget.clear()
        if not region_scores:
            self.list_widget.setVisible(False)
            self.empty_label.setVisible(True)
            return
        self.empty_label.setVisible(False)
        self.list_widget.setVisible(True)
        for rs in region_scores:
            get = rs.get if isinstance(rs, dict) else lambda key: getattr(rs, key)
            name, result, score = get("region_name"), get("result"), get("combined_score")
            score_text = f"{score:.1f}%" if score is not None else "—"
            item = QListWidgetItem(f"●  {name} — {result}  ({score_text})")
            item.setForeground(REGION_DOT_COLOR.get(result, QColor("#cfcfcf")))
            self.list_widget.addItem(item)

    def set_plan(self, regions: list[dict] | None) -> None:
        """Static pre-inspection view: one row per region *definition*
        (core/db.py's list_regions() rows) with its type and Ready/Disabled
        status, shown as soon as a product/angle is selected - before any
        comparison has run. set_regions() (live PASS/FAIL/WARN dots) replaces
        this once an inspection actually executes."""
        self.list_widget.clear()
        if not regions:
            self.list_widget.setVisible(False)
            self.empty_label.setVisible(True)
            return
        self.empty_label.setVisible(False)
        self.list_widget.setVisible(True)
        for region in regions:
            type_label = config.REGION_TYPE_LABELS.get(region["region_type"], region["region_type"])
            enabled = bool(region.get("enabled", 1))
            status = "Ready" if enabled else "Disabled"
            item = QListWidgetItem(f"○  {region['region_name']} — {type_label}  ({status})")
            item.setForeground(QColor("#cfcfcf") if enabled else QColor("#6b7280"))
            self.list_widget.addItem(item)

    def clear(self) -> None:
        self.set_regions(None)


class SelectedProductPanel(QFrame):
    """'Selected Product' identity card: the always-visible answer to 'what
    product am I working on right now?' - name, part number, station,
    setup-complete status, and reference/region counts, fed by
    core/app.py's QCApp.setup_status(). Distinct from ResultPanel (which
    answers 'did the LAST PART pass?'), so an operator never confuses 'is
    this product taught?' with 'did this part pass?'."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("panelCard")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(6)

        caption = QLabel("SELECTED PRODUCT")
        caption.setObjectName("panelTitle")
        layout.addWidget(caption)

        self.name_label = QLabel("No product selected")
        self.name_label.setObjectName("infoValue")
        self.name_label.setWordWrap(True)
        layout.addWidget(self.name_label)

        self.status_label = QLabel("")
        self.status_label.setWordWrap(True)
        layout.addWidget(self.status_label)

        self._rows: dict[str, QLabel] = {}
        for key, caption_text in (
            ("part_number", "Part Number"), ("station", "Station"),
            ("references", "GOOD References"), ("regions", "Inspection Regions"),
            ("mode", "Inspection Mode"), ("plan", "Inspection Plan"),
        ):
            row = QHBoxLayout()
            label = QLabel(caption_text)
            label.setObjectName("statusCaption")
            row.addWidget(label)
            row.addStretch()
            value = QLabel("—")
            value.setObjectName("statusValue")
            value.setAlignment(Qt.AlignmentFlag.AlignRight)
            row.addWidget(value)
            layout.addLayout(row)
            self._rows[key] = value

    def set_status(self, status: dict, part_number: str = "", inspection_mode_label: str = "") -> None:
        if not status["has_product"]:
            self.name_label.setText("No product selected")
            self.status_label.setText("Select or teach a product to begin.")
            self.status_label.setStyleSheet("color: #ffb020;")
            for value in self._rows.values():
                value.setText("—")
            return

        self.name_label.setText(status.get("product_name", "—"))
        if status["ready"]:
            self.status_label.setText("✓ Setup Complete")
            self.status_label.setStyleSheet("color: #00d97e; font-weight: 600;")
        else:
            self.status_label.setText(f"✗ {status['reason']}")
            self.status_label.setStyleSheet("color: #ff4d4f; font-weight: 600;")

        self._rows["part_number"].setText(part_number or "—")
        self._rows["station"].setText(status.get("station_name", "—"))
        self._rows["references"].setText(str(status["reference_count"]))
        self._rows["regions"].setText(str(status["region_count"]))
        self._rows["mode"].setText(inspection_mode_label or "—")
        self._rows["plan"].setText(status.get("plan_label", "—"))


class CountersPanel(QFrame):
    """Compact GOOD/BAD/NO PRODUCT/SKIPPED/ERROR counter grid, fed by
    core/db.py's count_inspections(). Lives in the Inspection screen
    sidebar, next to the ResultPanel."""

    _FIELDS = [
        ("TOTAL", "TOTAL", "counterValue"),
        ("GOOD", "GOOD", "counterValueGood"),
        ("BAD", "BAD", "counterValueBad"),
        ("NO_PRODUCT_FOUND", "NO PRODUCT", "counterValueWarn"),
        ("SKIPPED", "SKIPPED", "counterValue"),
        ("ERROR", "ERROR", "counterValueWarn"),
    ]

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("panelCard")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(10)

        caption = QLabel("COUNTERS")
        caption.setObjectName("panelTitle")
        layout.addWidget(caption)

        grid = QGridLayout()
        grid.setHorizontalSpacing(16)
        grid.setVerticalSpacing(10)
        self._value_labels: dict[str, QLabel] = {}
        for i, (key, caption_text, style_name) in enumerate(self._FIELDS):
            row, col = divmod(i, 3)
            cell = QVBoxLayout()
            cell.setSpacing(2)
            value = QLabel("0")
            value.setObjectName(style_name)
            value.setAlignment(Qt.AlignmentFlag.AlignCenter)
            cell.addWidget(value)
            cap = QLabel(caption_text)
            cap.setObjectName("counterCaption")
            cap.setAlignment(Qt.AlignmentFlag.AlignCenter)
            cell.addWidget(cap)
            grid.addLayout(cell, row, col)
            self._value_labels[key] = value
        layout.addLayout(grid)

    def set_counts(self, counts: dict) -> None:
        for key, label in self._value_labels.items():
            label.setText(str(counts.get(key, 0)))


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
        self.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
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
                item = QTableWidgetItem(str(value))
                if c == 0:
                    item.setData(Qt.ItemDataRole.UserRole, row.get("id"))
                self.setItem(r, c, item)
        self.resizeColumnsToContents()

    def selected_row_id(self) -> int | None:
        row = self.currentRow()
        if row < 0:
            return None
        item = self.item(row, 0)
        return item.data(Qt.ItemDataRole.UserRole) if item else None

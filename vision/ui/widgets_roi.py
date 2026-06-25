"""RegionDrawWidget: a mouse-driven rectangle-drawing surface used by the
Teach Product wizard's Define Object (single_rect=True) and Define
Inspection Features (single_rect=False) pages. Kept separate from
ui/widgets.py since every other widget there is purely declarative
(set_* then paint) while this one owns its own mouse-event state machine.

No new dependency: plain QPainter/QRect drawing on top of the same
frame_to_pixmap() conversion ImagePreviewPanel already uses.
"""
from __future__ import annotations

import numpy as np
from PySide6.QtCore import QPoint, QRect, Qt, Signal
from PySide6.QtGui import QColor, QFont, QMouseEvent, QPainter, QPaintEvent, QPen, QPixmap
from PySide6.QtWidgets import (
    QComboBox, QDialog, QDialogButtonBox, QFormLayout, QLineEdit, QVBoxLayout, QWidget,
)

from core import config

from .image_utils import frame_to_pixmap

_REGION_COLOR = {
    config.REGION_RESULT_PASS: QColor("#00d97e"),
    config.REGION_RESULT_FAIL: QColor("#ff4d4f"),
    config.REGION_RESULT_WARN: QColor("#ffb020"),
}
_UNTESTED_COLOR = QColor("#9aa5b1")
_MIN_DRAG_PIXELS = 6  # shorter drags are treated as accidental clicks, not a rect


class _RegionDetailsDialog(QDialog):
    """Small modal prompting for a new region's name + type, shown once per
    completed drag in multi-rect mode."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Name This Region")
        layout = QVBoxLayout(self)
        form = QFormLayout()
        self.name_edit = QLineEdit()
        form.addRow("Region name", self.name_edit)
        self.type_combo = QComboBox()
        for type_id in config.REGION_TYPE_CHOICES:
            self.type_combo.addItem(config.REGION_TYPE_LABELS[type_id], type_id)
        form.addRow("Check type", self.type_combo)
        layout.addLayout(form)
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def values(self) -> tuple[str, str]:
        return self.name_edit.text().strip(), self.type_combo.currentData()


class RegionDrawWidget(QWidget):
    """Displays an ndarray frame; lets the operator drag rectangles over it.

    single_rect=True (wizard Step 3, Define Object): one rect, replaced on
    each new drag, no naming prompt - it's the product-boundary override.
    single_rect=False (wizard Step 4, Define Features/Regions): each
    completed drag prompts for a name + type and appends a labeled region;
    existing regions stay visible, gray until set_region_results() recolors
    them green/red/yellow.
    """

    regions_changed = Signal()

    def __init__(self, single_rect: bool = False, parent=None):
        super().__init__(parent)
        self.single_rect = single_rect
        self.setMinimumSize(320, 240)
        self.setMouseTracking(True)

        self._pixmap: QPixmap | None = None
        self._image_size: tuple[int, int] = (0, 0)  # (width, height) of the source frame
        self._regions: list[dict] = []  # each: region_name, region_type, frac_x0/y0/x1/y1
        self._results: dict[str, str] = {}  # region_name -> PASS/FAIL/WARN

        self._dragging = False
        self._drag_start: QPoint | None = None
        self._drag_current: QPoint | None = None

    # --------------------------------------------------------------- display

    def _display_rect(self) -> QRect:
        """Where the source image is actually drawn within this widget,
        letterboxed to preserve aspect ratio."""
        if self._pixmap is None or self._pixmap.isNull():
            return QRect()
        pw, ph = self._pixmap.width(), self._pixmap.height()
        if pw <= 0 or ph <= 0:
            return QRect()
        scale = min(self.width() / pw, self.height() / ph)
        dw, dh = int(pw * scale), int(ph * scale)
        x0 = (self.width() - dw) // 2
        y0 = (self.height() - dh) // 2
        return QRect(x0, y0, dw, dh)

    def set_image(self, frame: np.ndarray) -> None:
        self._pixmap = frame_to_pixmap(frame)
        self._image_size = (frame.shape[1], frame.shape[0])
        self.update()

    # ---------------------------------------------------------------- state

    def regions(self) -> list[dict]:
        return [dict(region) for region in self._regions]

    def set_rect(self, frac_rect: tuple[float, float, float, float]) -> None:
        """Convenience for single_rect mode: preset/replace the one region
        (e.g. with the auto-detected contour bbox) without a drag."""
        self._regions = [{
            "region_name": "", "region_type": "",
            "frac_x0": frac_rect[0], "frac_y0": frac_rect[1],
            "frac_x1": frac_rect[2], "frac_y1": frac_rect[3],
        }]
        self.update()
        self.regions_changed.emit()

    def roi_rect(self) -> tuple[float, float, float, float] | None:
        if not self._regions:
            return None
        r = self._regions[0]
        return r["frac_x0"], r["frac_y0"], r["frac_x1"], r["frac_y1"]

    def load_regions(self, regions: list[dict]) -> None:
        """Restore a previously-staged region list verbatim (no prompts) -
        used when a wizard page is revisited via Back so drawn regions
        survive navigation instead of resetting to empty."""
        self._regions = [dict(region) for region in regions]
        self._results = {}
        self.update()

    def set_region_results(self, results: list) -> None:
        """Recolor staged rects to match a list of RegionScore (dataclass or
        dict) by region_name. Unmatched/untested rects stay gray."""
        self._results = {}
        for rs in results or []:
            get = rs.get if isinstance(rs, dict) else (lambda key: getattr(rs, key))
            self._results[get("region_name")] = get("result")
        self.update()

    def clear(self) -> None:
        self._regions = []
        self._results = {}
        self.update()
        self.regions_changed.emit()

    def remove_last(self) -> None:
        if self._regions:
            self._regions.pop()
            self.update()
            self.regions_changed.emit()

    # ---------------------------------------------------------- coord mapping

    def _widget_to_frac(self, point: QPoint, display: QRect) -> tuple[float, float]:
        x = (point.x() - display.x()) / display.width() if display.width() else 0.0
        y = (point.y() - display.y()) / display.height() if display.height() else 0.0
        return max(0.0, min(1.0, x)), max(0.0, min(1.0, y))

    def _frac_to_widget_rect(self, region: dict, display: QRect) -> QRect:
        x0 = display.x() + region["frac_x0"] * display.width()
        y0 = display.y() + region["frac_y0"] * display.height()
        x1 = display.x() + region["frac_x1"] * display.width()
        y1 = display.y() + region["frac_y1"] * display.height()
        return QRect(QPoint(int(x0), int(y0)), QPoint(int(x1), int(y1))).normalized()

    # ------------------------------------------------------------- mouse events

    def mousePressEvent(self, event: QMouseEvent) -> None:
        display = self._display_rect()
        if display.isEmpty() or not display.contains(event.position().toPoint()):
            return
        self._dragging = True
        self._drag_start = event.position().toPoint()
        self._drag_current = self._drag_start

    def mouseMoveEvent(self, event: QMouseEvent) -> None:
        if not self._dragging:
            return
        self._drag_current = event.position().toPoint()
        self.update()

    def mouseReleaseEvent(self, event: QMouseEvent) -> None:
        if not self._dragging or self._drag_start is None:
            return
        self._dragging = False
        display = self._display_rect()
        end = event.position().toPoint()
        drag_rect = QRect(self._drag_start, end).normalized()
        self._drag_start = self._drag_current = None
        if drag_rect.width() < _MIN_DRAG_PIXELS or drag_rect.height() < _MIN_DRAG_PIXELS or display.isEmpty():
            self.update()
            return

        clamped = drag_rect.intersected(display)
        frac_x0, frac_y0 = self._widget_to_frac(clamped.topLeft(), display)
        frac_x1, frac_y1 = self._widget_to_frac(clamped.bottomRight(), display)

        if self.single_rect:
            self.set_rect((frac_x0, frac_y0, frac_x1, frac_y1))
            return

        dialog = _RegionDetailsDialog(self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            self.update()
            return
        name, region_type = dialog.values()
        if not name:
            self.update()
            return
        self._regions.append({
            "region_name": name, "region_type": region_type,
            "frac_x0": frac_x0, "frac_y0": frac_y0, "frac_x1": frac_x1, "frac_y1": frac_y1,
        })
        self.update()
        self.regions_changed.emit()

    # ------------------------------------------------------------------ paint

    def paintEvent(self, event: QPaintEvent) -> None:
        painter = QPainter(self)
        painter.fillRect(self.rect(), QColor("#0c0c0c"))
        display = self._display_rect()
        if self._pixmap is not None and not display.isEmpty():
            painter.drawPixmap(display, self._pixmap)

        font = QFont()
        font.setPointSize(9)
        painter.setFont(font)

        for region in self._regions:
            name = region.get("region_name") or ""
            result = self._results.get(name)
            color = _REGION_COLOR.get(result, _UNTESTED_COLOR)
            rect = self._frac_to_widget_rect(region, display)
            painter.setPen(QPen(color, 2))
            painter.drawRect(rect)
            if name:
                painter.setPen(QPen(color, 1))
                painter.drawText(rect.topLeft() + QPoint(4, 14), name)

        if self._dragging and self._drag_start is not None and self._drag_current is not None:
            painter.setPen(QPen(QColor("#5b9dff"), 1, Qt.PenStyle.DashLine))
            painter.drawRect(QRect(self._drag_start, self._drag_current).normalized())

        painter.end()

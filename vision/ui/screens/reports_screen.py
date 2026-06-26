from PySide6.QtCore import QUrl
from PySide6.QtGui import QColor, QDesktopServices
from PySide6.QtWidgets import (
    QComboBox, QDialog, QFileDialog, QFrame, QHBoxLayout, QLabel, QLineEdit,
    QListWidget, QListWidgetItem, QMessageBox, QPushButton, QVBoxLayout, QWidget,
)

from core import config, reports
from core.app import QCApp

from ..widgets import REGION_DOT_COLOR, HistoryTable

_RESULT_CHOICES = ("All", "GOOD", "BAD")


class InspectionDetailDialog(QDialog):
    """Read-only 'View Details' popup for one inspection row: the same
    region-by-region PASS/FAIL/WARN breakdown the Inspection screen's live
    Inspection Plan panel shows, but for a historical row pulled from
    db.get_inspection_detail()."""

    def __init__(self, detail: dict, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Inspection #{detail['id']} Details")
        self.setMinimumWidth(420)

        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        header = QLabel(
            f"{detail.get('product_name', '(unknown)')} / {detail.get('angle_name', '')}\n"
            f"{detail.get('created_at', '')}  —  {detail.get('result', '')}"
            + (f"  ({detail['score']:.2f}%)" if detail.get("score") is not None else "")
        )
        header.setObjectName("infoValue")
        header.setWordWrap(True)
        layout.addWidget(header)

        region_results = detail.get("region_results") or []
        if region_results:
            caption = QLabel("REGION RESULTS")
            caption.setObjectName("statusCaption")
            layout.addWidget(caption)
            region_list = QListWidget()
            for region in region_results:
                score = region.get("combined_score")
                score_text = f"{score:.1f}%" if score is not None else "—"
                item = QListWidgetItem(f"●  {region['region_name']} — {region['result']}  ({score_text})")
                item.setForeground(REGION_DOT_COLOR.get(region["result"], QColor("#cfcfcf")))
                region_list.addItem(item)
            layout.addWidget(region_list)
        else:
            empty = QLabel("No per-region results for this inspection.")
            empty.setObjectName("instructionsText")
            layout.addWidget(empty)

        close_button = QPushButton("Close")
        close_button.clicked.connect(self.accept)
        layout.addWidget(close_button)


class ReportsScreen(QWidget):
    """Browse inspection history and export it to CSV/Excel."""

    def __init__(self, engine: QCApp, on_change, parent=None):
        super().__init__(parent)
        self.engine = engine
        self.on_change = on_change
        self._build_ui()
        self.refresh()

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(24, 20, 24, 20)
        root.setSpacing(16)

        card = QFrame()
        card.setObjectName("panelCard")
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(20, 20, 20, 20)
        card_layout.setSpacing(14)

        title = QLabel("INSPECTION HISTORY / REPORTS")
        title.setObjectName("panelTitle")
        card_layout.addWidget(title)

        filter_row = QHBoxLayout()
        filter_row.setSpacing(10)
        filter_row.addWidget(QLabel("Product:"))
        self.product_filter = QLineEdit()
        self.product_filter.setPlaceholderText("(all products)")
        filter_row.addWidget(self.product_filter)

        filter_row.addWidget(QLabel("Result:"))
        self.result_filter = QComboBox()
        self.result_filter.addItems(_RESULT_CHOICES)
        filter_row.addWidget(self.result_filter)

        apply_button = QPushButton("Apply Filter")
        apply_button.clicked.connect(self.refresh)
        filter_row.addWidget(apply_button)
        filter_row.addStretch()
        card_layout.addLayout(filter_row)

        self.history_table = HistoryTable(reports.REPORT_COLUMNS)
        card_layout.addWidget(self.history_table)

        export_row = QHBoxLayout()
        export_row.setSpacing(10)
        view_details_button = QPushButton("View Details")
        view_details_button.clicked.connect(self._on_view_details)
        export_row.addWidget(view_details_button)
        open_folder_button = QPushButton("Open Reports Folder")
        open_folder_button.clicked.connect(self._on_open_reports_folder)
        export_row.addWidget(open_folder_button)
        export_csv_button = QPushButton("Export CSV")
        export_csv_button.clicked.connect(self._on_export_csv)
        export_row.addWidget(export_csv_button)
        export_excel_button = QPushButton("Export Excel")
        export_excel_button.clicked.connect(self._on_export_excel)
        export_row.addWidget(export_excel_button)
        export_row.addStretch()
        card_layout.addLayout(export_row)

        root.addWidget(card)

    # ------------------------------------------------------------- helpers

    def _filters(self) -> dict:
        filters = {}
        product_name = self.product_filter.text().strip()
        if product_name:
            filters["product_name"] = product_name
        result = self.result_filter.currentText()
        if result != "All":
            filters["result"] = result
        return filters

    # ------------------------------------------------------------- actions

    def _on_view_details(self) -> None:
        inspection_id = self.history_table.selected_row_id()
        if inspection_id is None:
            QMessageBox.warning(self, "View Details", "Select an inspection row first.")
            return
        detail = self.engine.db.get_inspection_detail(inspection_id)
        if detail is None:
            QMessageBox.warning(self, "View Details", "That inspection record no longer exists.")
            return
        InspectionDetailDialog(detail, self).exec()

    def _on_open_reports_folder(self) -> None:
        config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(config.REPORTS_DIR)))

    def _on_export_csv(self) -> None:
        target, _ = QFileDialog.getSaveFileName(
            self, "Export Report", str(reports.default_report_path("csv")), "CSV files (*.csv)",
        )
        if not target:
            return
        reports.export_csv(self.engine.db, target, **self._filters())
        QMessageBox.information(self, "Export Report", f"Report exported to {target}")

    def _on_export_excel(self) -> None:
        if not reports.excel_available():
            QMessageBox.warning(
                self, "Export Report",
                "Excel export requires the 'openpyxl' package. Install it or use Export CSV instead.",
            )
            return
        target, _ = QFileDialog.getSaveFileName(
            self, "Export Report", str(reports.default_report_path("xlsx")), "Excel files (*.xlsx)",
        )
        if not target:
            return
        reports.export_excel(self.engine.db, target, **self._filters())
        QMessageBox.information(self, "Export Report", f"Report exported to {target}")

    # ------------------------------------------------------------ refresh

    def refresh(self) -> None:
        rows = self.engine.db.list_inspections(**self._filters())
        self.history_table.set_rows(rows)

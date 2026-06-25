from PySide6.QtCore import QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QComboBox, QFileDialog, QFrame, QHBoxLayout, QLabel, QLineEdit, QMessageBox,
    QPushButton, QVBoxLayout, QWidget,
)

from core import config, reports
from core.app import QCApp

from ..widgets import HistoryTable

_RESULT_CHOICES = ("All", "GOOD", "BAD")


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

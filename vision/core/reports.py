"""Inspection history export (CSV always, Excel when openpyxl is installed).

A view over core/db.py's `inspections` table - every export reads straight
from the database with whatever filters the Reports screen has applied; it
is never a second source of truth.
"""
import csv
from datetime import datetime
from pathlib import Path

from . import config
from .db import Database, REPORT_COLUMNS  # noqa: F401 - re-exported for existing importers


def default_report_path(extension: str) -> Path:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return config.REPORTS_DIR / f"inspections_{stamp}.{extension}"


def excel_available() -> bool:
    try:
        import openpyxl  # noqa: F401
        return True
    except ImportError:
        return False


def export_csv(db: Database, output_path: Path, **filters) -> Path:
    rows = db.list_inspections(**filters)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([label for _, label in REPORT_COLUMNS])
        for row in rows:
            writer.writerow([row.get(key, "") for key, _ in REPORT_COLUMNS])
    return output_path


def export_excel(db: Database, output_path: Path, **filters) -> Path:
    import openpyxl  # caller should check excel_available() first

    rows = db.list_inspections(**filters)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Inspections"
    sheet.append([label for _, label in REPORT_COLUMNS])
    for row in rows:
        sheet.append([row.get(key, "") for key, _ in REPORT_COLUMNS])
    workbook.save(output_path)
    return output_path

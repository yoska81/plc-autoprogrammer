"""Inspection history export (CSV always, Excel when openpyxl is installed).

A view over core/db.py's `inspections` table - every export reads straight
from the database with whatever filters the Reports screen has applied; it
is never a second source of truth.
"""
import csv
from datetime import datetime
from pathlib import Path

from . import config
from .db import Database

REPORT_COLUMNS = [
    ("created_at", "Date/Time"),
    ("product_name", "Product"),
    ("angle_name", "Angle"),
    ("result", "Result"),
    ("score", "Score %"),
    ("inspection_image_path", "Inspection Image"),
    ("bad_image_path", "Bad Image"),
    ("difference_image_path", "Diff Image"),
    ("notes", "Notes"),
    # V2 "Free Position / Continuous Rotation" engine fields. Blank for V1 rows.
    ("engine_version", "Engine"),
    ("recognition_confidence", "Recognition Confidence %"),
    ("alignment_method", "Alignment Method"),
    ("alignment_quality", "Alignment Quality %"),
    ("feature_score", "Feature Score %"),
    ("shape_score", "Shape Score %"),
    ("pixel_score", "Pixel Score %"),
    ("edge_score", "Edge Score %"),
    ("detected_center_x", "Detected X"),
    ("detected_center_y", "Detected Y"),
    ("detected_rotation_deg", "Detected Rotation (deg)"),
    ("detected_scale", "Detected Scale"),
    ("normalized_image_path", "Normalized Image"),
    ("no_product_found", "No Product Found"),
    ("reference_image_path", "Best Reference Image"),
    # No Product Found / Skip / Error fields. Blank for V1 rows and for V2
    # rows where a product was located normally.
    ("product_detected", "Product Detected"),
    ("detection_confidence", "Detection Confidence %"),
    ("skipped", "Skipped"),
    ("skip_reason", "Skip Reason"),
    ("no_product_action", "No Product Action"),
    ("saved_no_product_image_path", "No-Product Image"),
    # Multi-camera / multi-station identity (core/camera_manager.py). Blank
    # for inspections recorded before this feature existed.
    ("camera_id", "Camera ID"),
    ("station_name", "Station"),
    ("camera_type", "Camera Type"),
    ("camera_index_or_address", "Camera Index/Address"),
]


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

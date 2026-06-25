import csv
import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path

from .compare import ComparisonResult

CSV_FIELDS = [
    "timestamp", "product", "angle", "result", "score_percent",
    "reference_image", "inspection_image", "diff_image",
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    product TEXT NOT NULL,
    angle TEXT NOT NULL,
    result TEXT NOT NULL,
    score_percent REAL NOT NULL,
    reference_image TEXT,
    inspection_image TEXT,
    diff_image TEXT
)
"""


def record_result(
    csv_path: Path,
    db_path: Path,
    product: str,
    angle: str,
    comparison: ComparisonResult,
    reference_image: Path,
    inspection_image: Path,
) -> None:
    row = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "product": product,
        "angle": angle,
        "result": comparison.result,
        "score_percent": comparison.score_percent,
        "reference_image": str(reference_image),
        "inspection_image": str(inspection_image),
        "diff_image": str(comparison.diff_image_path),
    }

    csv_path.parent.mkdir(parents=True, exist_ok=True)
    write_header = not csv_path.exists()
    with csv_path.open("a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if write_header:
            writer.writeheader()
        writer.writerow(row)

    db_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(db_path)) as conn:
        conn.execute(SCHEMA)
        conn.execute(
            "INSERT INTO results (timestamp, product, angle, result, score_percent, "
            "reference_image, inspection_image, diff_image) VALUES "
            "(:timestamp, :product, :angle, :result, :score_percent, "
            ":reference_image, :inspection_image, :diff_image)",
            row,
        )
        conn.commit()


def fetch_recent_results(db_path: Path, limit: int = 20) -> list[dict]:
    """Used by the UI's inspection history table."""
    if not db_path.exists():
        return []
    with closing(sqlite3.connect(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            "SELECT timestamp, product, angle, result, score_percent "
            "FROM results ORDER BY id DESC LIMIT ?",
            (limit,),
        )
        return [dict(row) for row in cursor.fetchall()]

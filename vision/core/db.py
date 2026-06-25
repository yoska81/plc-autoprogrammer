"""SQLite-backed catalog and inspection history for VISION SYSTEM - QC.

The single source of truth for products, angles, reference images,
inspections, and settings. No other module talks to sqlite3 directly -
core/app.py and the UI screens go through a Database instance.
"""
import sqlite3
from datetime import datetime
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    part_number TEXT,
    description TEXT,
    customer TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS angles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    angle_name TEXT NOT NULL,
    notes TEXT,
    UNIQUE(product_id, angle_name)
);

CREATE TABLE IF NOT EXISTS reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    angle_id INTEGER NOT NULL REFERENCES angles(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    angle_id INTEGER NOT NULL REFERENCES angles(id) ON DELETE CASCADE,
    reference_image_id INTEGER REFERENCES reference_images(id) ON DELETE SET NULL,
    inspection_image_path TEXT,
    difference_image_path TEXT,
    bad_image_path TEXT,
    result TEXT NOT NULL,
    score REAL NOT NULL,
    threshold REAL NOT NULL,
    camera_mode TEXT,
    camera_index INTEGER,
    trigger_source TEXT,
    created_at TEXT NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""

# Columns added after V1 shipped. Applied with ALTER TABLE on every connect
# (guarded by _ensure_columns() checking PRAGMA table_info first) instead of
# being part of SCHEMA above, since SQLite's CREATE TABLE IF NOT EXISTS does
# not retrofit columns onto a database file that already exists on disk.
_REFERENCE_IMAGE_MIGRATION_COLUMNS = [
    # Sidecar .npz path holding the V2 engine's ORB/AKAZE keypoints+descriptors,
    # contour, mask, and reference size for this image (core/compare_v2.py).
    # NULL for references saved before the V2 engine existed, or whenever
    # feature extraction found nothing usable - compute_comparison_v2() skips
    # such references rather than failing.
    ("feature_path", "TEXT"),
]
_INSPECTION_MIGRATION_COLUMNS = [
    ("engine_version", "TEXT"),        # "v1" (fixed pixel diff) | "v2" (free pose match)
    ("feature_score", "REAL"),         # V2: ORB/AKAZE inlier match score, 0-100
    ("shape_score", "REAL"),           # V2: post-alignment contour similarity, 0-100
    ("pixel_score", "REAL"),           # V2: post-alignment grayscale diff score, 0-100
    ("edge_score", "REAL"),            # V2: post-alignment Canny-edge similarity, 0-100
    ("recognition_confidence", "REAL"),  # V2: how confidently the product was located, 0-100
    ("alignment_quality", "REAL"),     # V2: how well the inspection aligned to the reference, 0-100
    ("alignment_method", "TEXT"),      # V2: "orb" | "akaze" | "contour" | "none"
    ("detected_center_x", "REAL"),     # V2: located product center, pixels in the inspection frame
    ("detected_center_y", "REAL"),
    ("detected_rotation_deg", "REAL"),  # V2: in-plane rotation vs. the matched reference
    ("detected_scale", "REAL"),        # V2: size ratio vs. the matched reference
    ("normalized_image_path", "TEXT"),  # V2: the cropped/derotated/rescaled image actually compared
    ("no_product_found", "INTEGER"),   # V2: 1 if localization failed outright, else 0
    ("product_detected", "INTEGER"),   # V2: 1 if a product was located above min confidence, else 0
    ("skipped", "INTEGER"),            # V2: 1 if this cycle was excluded from GOOD/BAD/NO_PRODUCT counts
    ("skip_reason", "TEXT"),           # V2: why it was skipped, e.g. "no_product_found"
    ("no_product_action", "TEXT"),     # V2: the No Product Action setting in effect when this was saved
    ("detection_confidence", "REAL"),  # V2: confidence the product-detection step reported, 0-100
    ("saved_no_product_image_path", "TEXT"),  # V2: copy under data/no_product/, if that setting was on
]

INSPECTION_COLUMNS = [
    "product_id", "angle_id", "reference_image_id", "inspection_image_path",
    "difference_image_path", "bad_image_path", "result", "score", "threshold",
    "camera_mode", "camera_index", "trigger_source", "created_at", "notes",
] + [name for name, _type in _INSPECTION_MIGRATION_COLUMNS]


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


class Database:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.executescript(SCHEMA)
        self._conn.commit()
        self._ensure_columns()

    def close(self) -> None:
        self._conn.close()

    def _ensure_columns(self) -> None:
        migrations = [
            ("reference_images", _REFERENCE_IMAGE_MIGRATION_COLUMNS),
            ("inspections", _INSPECTION_MIGRATION_COLUMNS),
        ]
        for table, columns in migrations:
            existing = {row["name"] for row in self._conn.execute(f"PRAGMA table_info({table})")}
            for name, sqltype in columns:
                if name not in existing:
                    self._conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {sqltype}")
        self._conn.commit()

    # ------------------------------------------------------------ products

    def create_product(self, name: str, part_number: str = "", description: str = "",
                        customer: str = "", notes: str = "") -> int:
        cursor = self._conn.execute(
            "INSERT INTO products (name, part_number, description, customer, notes, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (name, part_number, description, customer, notes, _now()),
        )
        self._conn.commit()
        return cursor.lastrowid

    def update_product(self, product_id: int, **fields) -> None:
        allowed = {"name", "part_number", "description", "customer", "notes"}
        fields = {k: v for k, v in fields.items() if k in allowed}
        if not fields:
            return
        assignments = ", ".join(f"{k} = ?" for k in fields)
        self._conn.execute(f"UPDATE products SET {assignments} WHERE id = ?", (*fields.values(), product_id))
        self._conn.commit()

    def delete_product(self, product_id: int) -> None:
        self._conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
        self._conn.commit()

    def get_product(self, product_id: int) -> dict | None:
        row = self._conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        return dict(row) if row else None

    def get_product_by_name(self, name: str) -> dict | None:
        row = self._conn.execute("SELECT * FROM products WHERE name = ?", (name,)).fetchone()
        return dict(row) if row else None

    def list_products(self) -> list[dict]:
        rows = self._conn.execute("SELECT * FROM products ORDER BY name").fetchall()
        return [dict(r) for r in rows]

    # -------------------------------------------------------------- angles

    def create_angle(self, product_id: int, angle_name: str, notes: str = "") -> int:
        cursor = self._conn.execute(
            "INSERT INTO angles (product_id, angle_name, notes) VALUES (?, ?, ?)",
            (product_id, angle_name, notes),
        )
        self._conn.commit()
        return cursor.lastrowid

    def delete_angle(self, angle_id: int) -> None:
        self._conn.execute("DELETE FROM angles WHERE id = ?", (angle_id,))
        self._conn.commit()

    def get_angle(self, angle_id: int) -> dict | None:
        row = self._conn.execute("SELECT * FROM angles WHERE id = ?", (angle_id,)).fetchone()
        return dict(row) if row else None

    def get_angle_by_name(self, product_id: int, angle_name: str) -> dict | None:
        row = self._conn.execute(
            "SELECT * FROM angles WHERE product_id = ? AND angle_name = ?", (product_id, angle_name),
        ).fetchone()
        return dict(row) if row else None

    def list_angles(self, product_id: int) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM angles WHERE product_id = ? ORDER BY angle_name", (product_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    # ---------------------------------------------------- reference images

    def add_reference_image(self, product_id: int, angle_id: int, image_path: str,
                             notes: str = "", make_primary: bool | None = None,
                             feature_path: str | None = None) -> int:
        is_first = len(self.list_reference_images(angle_id)) == 0
        is_primary = 1 if (make_primary or is_first) else 0
        cursor = self._conn.execute(
            "INSERT INTO reference_images "
            "(product_id, angle_id, image_path, is_primary, created_at, notes, feature_path) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (product_id, angle_id, str(image_path), is_primary, _now(), notes, feature_path),
        )
        self._conn.commit()
        new_id = cursor.lastrowid
        if is_primary:
            self.set_primary_reference(angle_id, new_id)
        return new_id

    def set_reference_feature_path(self, reference_image_id: int, feature_path: str | None) -> None:
        self._conn.execute(
            "UPDATE reference_images SET feature_path = ? WHERE id = ?",
            (feature_path, reference_image_id),
        )
        self._conn.commit()

    def set_primary_reference(self, angle_id: int, reference_image_id: int) -> None:
        self._conn.execute("UPDATE reference_images SET is_primary = 0 WHERE angle_id = ?", (angle_id,))
        self._conn.execute("UPDATE reference_images SET is_primary = 1 WHERE id = ?", (reference_image_id,))
        self._conn.commit()

    def delete_reference_image(self, reference_image_id: int) -> None:
        row = self._conn.execute(
            "SELECT angle_id, is_primary FROM reference_images WHERE id = ?", (reference_image_id,),
        ).fetchone()
        self._conn.execute("DELETE FROM reference_images WHERE id = ?", (reference_image_id,))
        self._conn.commit()
        if row and row["is_primary"]:
            remaining = self.list_reference_images(row["angle_id"])
            if remaining:
                self.set_primary_reference(row["angle_id"], remaining[0]["id"])

    def list_reference_images(self, angle_id: int) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM reference_images WHERE angle_id = ? ORDER BY created_at", (angle_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_primary_reference(self, angle_id: int) -> dict | None:
        row = self._conn.execute(
            "SELECT * FROM reference_images WHERE angle_id = ? AND is_primary = 1", (angle_id,),
        ).fetchone()
        return dict(row) if row else None

    def list_reference_images_for_product(self, product_id: int) -> list[dict]:
        rows = self._conn.execute(
            "SELECT r.*, a.angle_name AS angle_name FROM reference_images r "
            "JOIN angles a ON a.id = r.angle_id "
            "WHERE r.product_id = ? ORDER BY a.angle_name, r.created_at",
            (product_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    # ----------------------------------------------------------- inspections

    def record_inspection(self, **fields) -> int:
        fields.setdefault("created_at", _now())
        fields.setdefault("notes", "")
        values = [fields.get(column) for column in INSPECTION_COLUMNS]
        placeholders = ", ".join(["?"] * len(INSPECTION_COLUMNS))
        cursor = self._conn.execute(
            f"INSERT INTO inspections ({', '.join(INSPECTION_COLUMNS)}) VALUES ({placeholders})", values,
        )
        self._conn.commit()
        return cursor.lastrowid

    def list_inspections(self, product_name: str | None = None, result: str | None = None,
                          date_from: str | None = None, date_to: str | None = None,
                          limit: int = 200) -> list[dict]:
        query = (
            "SELECT i.*, p.name AS product_name, a.angle_name AS angle_name, "
            "r.image_path AS reference_image_path "
            "FROM inspections i "
            "JOIN products p ON p.id = i.product_id "
            "JOIN angles a ON a.id = i.angle_id "
            "LEFT JOIN reference_images r ON r.id = i.reference_image_id "
            "WHERE 1 = 1"
        )
        params: list = []
        if product_name:
            query += " AND p.name = ?"
            params.append(product_name)
        if result:
            query += " AND i.result = ?"
            params.append(result)
        if date_from:
            query += " AND i.created_at >= ?"
            params.append(date_from)
        if date_to:
            query += " AND i.created_at <= ?"
            params.append(date_to)
        query += " ORDER BY i.id DESC LIMIT ?"
        params.append(limit)
        rows = self._conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def count_inspections(self, product_name: str | None = None) -> dict:
        """Counters for the Inspection screen: one key per `result` value
        plus "TOTAL". Rows that were skipped without logging (see
        core/app.py's no_product_action == "skip") were never written, so
        they're naturally absent here - exactly matching the "do not count"
        requirement."""
        query = "SELECT i.result AS result, COUNT(*) AS n FROM inspections i"
        params: list = []
        if product_name:
            query += " JOIN products p ON p.id = i.product_id WHERE p.name = ?"
            params.append(product_name)
        query += " GROUP BY i.result"
        rows = self._conn.execute(query, params).fetchall()
        counts = {r["result"]: r["n"] for r in rows}
        counts["TOTAL"] = sum(counts.values())
        return counts

    # -------------------------------------------------------------- settings

    def get_setting(self, key: str, default: str | None = None) -> str | None:
        row = self._conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default

    def get_setting_bool(self, key: str, default: bool) -> bool:
        value = self.get_setting(key)
        if value is None:
            return default
        return str(value).strip().lower() in ("1", "true", "yes", "on")

    def get_setting_float(self, key: str, default: float) -> float:
        value = self.get_setting(key)
        try:
            return float(value) if value is not None else default
        except (TypeError, ValueError):
            return default

    def get_setting_int(self, key: str, default: int) -> int:
        value = self.get_setting(key)
        try:
            return int(value) if value is not None else default
        except (TypeError, ValueError):
            return default

    def set_setting(self, key: str, value) -> None:
        self._conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, str(value)),
        )
        self._conn.commit()

    def get_all_settings(self) -> dict:
        rows = self._conn.execute("SELECT key, value FROM settings").fetchall()
        return {r["key"]: r["value"] for r in rows}

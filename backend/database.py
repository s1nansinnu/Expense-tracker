"""SQLite database helpers: connection, schema, and CRUD operations."""

import sqlite3
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent / "expenses.db"

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS expenses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL CHECK(length(trim(title)) > 0),
    amount      REAL    NOT NULL CHECK(amount > 0),
    category    TEXT    NOT NULL CHECK(category IN ('food','transport','shopping','bills','entertainment','other')),
    date        TEXT    NOT NULL,
    note        TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
"""


def get_connection() -> sqlite3.Connection:
    """Return a new connection with row-factory enabled."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    """Create the expenses table if it doesn't exist."""
    with get_connection() as conn:
        conn.execute(CREATE_TABLE_SQL)


# ---------------------------------------------------------------------------
# CRUD helpers
# ---------------------------------------------------------------------------

def insert_expense(title: str, amount: float, category: str,
                   date_str: str, note: str) -> dict:
    """Insert a new expense and return it as a dict."""
    sql = """
        INSERT INTO expenses (title, amount, category, date, note)
        VALUES (?, ?, ?, ?, ?)
    """
    with get_connection() as conn:
        cursor = conn.execute(sql, (title, amount, category, date_str, note))
        expense_id = cursor.lastrowid
        row = conn.execute(
            "SELECT * FROM expenses WHERE id = ?", (expense_id,)
        ).fetchone()
    return dict(row)


def get_all_expenses(category: Optional[str] = None,
                     date_from: Optional[str] = None,
                     date_to: Optional[str] = None,
                     search: Optional[str] = None) -> list[dict]:
    """Return expenses sorted by date DESC, with optional filters."""
    sql = "SELECT * FROM expenses WHERE 1=1"
    params: list = []

    if category:
        sql += " AND category = ?"
        params.append(category)
    if date_from:
        sql += " AND date >= ?"
        params.append(date_from)
    if date_to:
        sql += " AND date <= ?"
        params.append(date_to)
    if search:
        sql += " AND title LIKE ?"
        params.append(f"%{search}%")

    sql += " ORDER BY date DESC, created_at DESC"

    with get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def get_expense_by_id(expense_id: int) -> Optional[dict]:
    """Return a single expense or None."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM expenses WHERE id = ?", (expense_id,)
        ).fetchone()
    return dict(row) if row else None


def update_expense(expense_id: int, **fields) -> Optional[dict]:
    """Update specific fields of an expense. Returns updated row or None."""
    if not fields:
        return get_expense_by_id(expense_id)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [expense_id]

    with get_connection() as conn:
        conn.execute(
            f"UPDATE expenses SET {set_clause} WHERE id = ?", values
        )
        row = conn.execute(
            "SELECT * FROM expenses WHERE id = ?", (expense_id,)
        ).fetchone()
    return dict(row) if row else None


def delete_expense(expense_id: int) -> bool:
    """Delete an expense. Returns True if a row was deleted."""
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM expenses WHERE id = ?", (expense_id,)
        )
    return cursor.rowcount > 0


def get_monthly_summary(year: int, month: int) -> dict:
    """Return total, count, and per-category breakdown for a given month."""
    month_prefix = f"{year:04d}-{month:02d}"

    with get_connection() as conn:
        # Overall totals
        row = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count "
            "FROM expenses WHERE date LIKE ?",
            (f"{month_prefix}%",)
        ).fetchone()

        total = row["total"]
        count = row["count"]

        # Per-category breakdown
        cats = conn.execute(
            "SELECT category, SUM(amount) AS total, COUNT(*) AS count "
            "FROM expenses WHERE date LIKE ? GROUP BY category ORDER BY total DESC",
            (f"{month_prefix}%",)
        ).fetchall()

    return {
        "year": year,
        "month": month,
        "total": round(total, 2),
        "count": count,
        "categories": [
            {"category": c["category"], "total": round(c["total"], 2), "count": c["count"]}
            for c in cats
        ],
    }

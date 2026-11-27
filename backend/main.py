"""FastAPI application — Expense Tracker."""

from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

import database as db
from models import Category, ExpenseCreate, ExpenseResponse, ExpenseUpdate


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise the database on startup."""
    db.init_db()
    yield


app = FastAPI(title="Expense Tracker", lifespan=lifespan)

# Serve static files (HTML / CSS / JS)
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    """Redirect bare URL to the frontend."""
    return RedirectResponse(url="/static/index.html")


# ---- Create ---------------------------------------------------------------

@app.post("/api/expenses", response_model=ExpenseResponse, status_code=201)
def create_expense(expense: ExpenseCreate):
    """Add a new expense."""
    row = db.insert_expense(
        title=expense.title,
        amount=expense.amount,
        category=expense.category.value,
        date_str=expense.expense_date.isoformat(),
        note=expense.note or "",
    )
    return row


# ---- Read -----------------------------------------------------------------

@app.get("/api/expenses", response_model=list[ExpenseResponse])
def list_expenses(
    category: Optional[Category] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
):
    """List all expenses, sorted by date (most recent first), with optional filters."""
    # Validate date range
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=422,
            detail="Start date must be before or equal to end date",
        )

    rows = db.get_all_expenses(
        category=category.value if category else None,
        date_from=date_from.isoformat() if date_from else None,
        date_to=date_to.isoformat() if date_to else None,
        search=search.strip() if search else None,
    )
    return rows


@app.get("/api/expenses/{expense_id}", response_model=ExpenseResponse)
def get_expense(expense_id: int):
    """Get a single expense by ID."""
    row = db.get_expense_by_id(expense_id)
    if not row:
        raise HTTPException(status_code=404, detail="Expense not found")
    return row


# ---- Update ---------------------------------------------------------------

@app.put("/api/expenses/{expense_id}", response_model=ExpenseResponse)
def update_expense(expense_id: int, updates: ExpenseUpdate):
    """Update an existing expense (partial update)."""
    existing = db.get_expense_by_id(expense_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")

    fields = {}
    if updates.title is not None:
        fields["title"] = updates.title
    if updates.amount is not None:
        fields["amount"] = updates.amount
    if updates.category is not None:
        fields["category"] = updates.category.value
    if updates.expense_date is not None:
        fields["date"] = updates.expense_date.isoformat()
    if updates.note is not None:
        fields["note"] = updates.note

    row = db.update_expense(expense_id, **fields)
    return row


# ---- Delete ---------------------------------------------------------------

@app.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: int):
    """Delete an expense by ID."""
    if not db.delete_expense(expense_id):
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"detail": "Expense deleted"}


# ---- Summary --------------------------------------------------------------

@app.get("/api/summary")
def monthly_summary(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
):
    """Return monthly spending summary with per-category breakdown."""
    today = date.today()
    y = year if year is not None else today.year
    m = month if month is not None else today.month
    return db.get_monthly_summary(y, m)

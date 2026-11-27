from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

import database as db
from models import ExpenseCreate, ExpenseResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Expense Tracker", lifespan=lifespan)

static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.post("/api/expenses", response_model=ExpenseResponse, status_code=201)
def create_expense(expense: ExpenseCreate):
    return db.insert_expense(
        title=expense.title,
        amount=expense.amount,
        category=expense.category.value,
        date_str=expense.expense_date.isoformat(),
        note=expense.note or "",
    )
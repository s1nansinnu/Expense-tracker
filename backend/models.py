"""Pydantic models for request/response validation."""

import datetime as _dt
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class Category(str, Enum):
    FOOD = "food"
    TRANSPORT = "transport"
    SHOPPING = "shopping"
    BILLS = "bills"
    ENTERTAINMENT = "entertainment"
    OTHER = "other"


class ExpenseCreate(BaseModel):
    """Schema for creating a new expense."""

    title: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    category: Category
    expense_date: _dt.date = Field(default_factory=_dt.date.today, alias="date")
    note: Optional[str] = Field(default="", max_length=500)

    model_config = {"populate_by_name": True}

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty or whitespace only")
        return v

    @field_validator("expense_date")
    @classmethod
    def date_not_in_future(cls, v: _dt.date) -> _dt.date:
        if v > _dt.date.today():
            raise ValueError("Date cannot be in the future")
        return v

    @field_validator("note")
    @classmethod
    def strip_note(cls, v: Optional[str]) -> str:
        if v is None:
            return ""
        return v.strip()


class ExpenseUpdate(BaseModel):
    """Schema for updating an existing expense (all fields optional)."""

    title: Optional[str] = Field(None, min_length=1, max_length=100)
    amount: Optional[float] = Field(None, gt=0)
    category: Optional[Category] = None
    expense_date: Optional[_dt.date] = Field(None, alias="date")
    note: Optional[str] = Field(None, max_length=500)

    model_config = {"populate_by_name": True}

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty or whitespace only")
        return v

    @field_validator("expense_date")
    @classmethod
    def date_not_in_future(cls, v: Optional[_dt.date]) -> Optional[_dt.date]:
        if v is not None and v > _dt.date.today():
            raise ValueError("Date cannot be in the future")
        return v

    @field_validator("note")
    @classmethod
    def strip_note(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return v.strip()


class ExpenseResponse(BaseModel):
    """Schema for returning an expense to the client."""

    id: int
    title: str
    amount: float
    category: str
    date: str
    note: str
    created_at: str

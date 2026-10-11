import math
import re
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_NULLISH = {"", "null", "none", "n/a", "na", "unknown", "-"}

_CURRENCY_SYMBOLS = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "₦": "NGN",
    "₹": "INR",
    "¥": "JPY",
    "R$": "BRL",
}


def to_number(value: Any) -> float | None:
    """Best-effort conversion of LLM output ("$1,234.50", "1.234,50", "(45.00)", 12) to a float."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) else None

    raw = str(value).strip()
    if not raw:
        return None
    negative = raw.startswith("-") or (raw.startswith("(") and raw.endswith(")"))
    s = re.sub(r"[^\d.,]", "", raw)
    if not s:
        return None

    if "," in s and "." in s:
        # The separator that appears last is the decimal one.
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        head, _, tail = s.rpartition(",")
        if s.count(",") == 1 and len(tail) <= 2:
            s = f"{head}.{tail}"  # 12,50 -> 12.50
        else:
            s = s.replace(",", "")  # 1,234 / 1,234,567
    elif s.count(".") > 1:
        s = s.replace(".", "")  # 1.234.567

    try:
        number = float(s)
    except ValueError:
        return None
    if not math.isfinite(number):
        return None
    return round(-number if negative else number, 4)


def _clean_text(value: Any, max_len: int = 200) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    if text.lower() in _NULLISH:
        return None
    return text[:max_len]


class LineItem(BaseModel):
    description: str = ""
    quantity: float | None = None
    unit_price: float | None = None
    total: float | None = None

    @field_validator("description", mode="before")
    @classmethod
    def _description(cls, v: Any) -> str:
        return _clean_text(v, 500) or ""

    @field_validator("quantity", "unit_price", "total", mode="before")
    @classmethod
    def _numbers(cls, v: Any) -> float | None:
        return to_number(v)

    @model_validator(mode="after")
    def _fill_gaps(self) -> "LineItem":
        # The UI expects plain numbers for every line-item column.
        if self.quantity is None:
            self.quantity = 1.0
        if self.unit_price is None and self.total is not None and self.quantity:
            self.unit_price = round(self.total / self.quantity, 4)
        if self.total is None and self.unit_price is not None:
            self.total = round(self.quantity * self.unit_price, 2)
        if self.unit_price is None:
            self.unit_price = 0.0
        if self.total is None:
            self.total = 0.0
        return self


class ExtractedInvoice(BaseModel):
    vendor_name: str | None = None
    date: str | None = None
    invoice_number: str | None = None
    line_items: list[LineItem] = Field(default_factory=list)
    subtotal: float | None = None
    tax: float | None = None
    total: float | None = None
    currency: str | None = None

    @field_validator("vendor_name", "date", "invoice_number", mode="before")
    @classmethod
    def _text(cls, v: Any) -> str | None:
        return _clean_text(v)

    @field_validator("subtotal", "tax", "total", mode="before")
    @classmethod
    def _numbers(cls, v: Any) -> float | None:
        return to_number(v)

    @field_validator("currency", mode="before")
    @classmethod
    def _currency(cls, v: Any) -> str | None:
        text = _clean_text(v, 8)
        if text is None:
            return None
        if text in _CURRENCY_SYMBOLS:
            return _CURRENCY_SYMBOLS[text]
        text = text.upper()
        return text if re.fullmatch(r"[A-Z]{3}", text) else None

    @field_validator("line_items", mode="before")
    @classmethod
    def _items(cls, v: Any) -> list[Any]:
        if not isinstance(v, list):
            return []
        return [item for item in v if isinstance(item, dict)]

    def is_empty(self) -> bool:
        return not (
            self.vendor_name
            or self.invoice_number
            or self.date
            or self.total is not None
            or self.line_items
        )


class ExtractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    status: Literal["pending", "processing", "complete", "failed"]
    extracted_data: ExtractedInvoice | None = None
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def _assume_utc(cls, v: datetime) -> datetime:
        # SQLite hands back naive datetimes; browsers would read those as local time.
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
"""Unified order schemas (incoming, parsed, review)."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class IncomingItem(BaseModel):
    """A single line item as it arrived from a delivery platform."""

    model_config = ConfigDict(strict=False)

    raw_name: str
    quantity: int = Field(ge=1)
    raw_modifiers: list[str] = Field(default_factory=list)
    raw_special_instructions: str | None = None
    unit_price: float | None = None


class IncomingOrder(BaseModel):
    """Normalized order across all platforms (output of webhook intake)."""

    model_config = ConfigDict(strict=False)

    platform: Literal["doordash", "ubereats", "grubhub"]
    external_order_id: str
    customer_name: str
    placed_at: datetime
    pickup_time: datetime | None = None
    items: list[IncomingItem]
    raw_special_instructions: str | None = None
    raw_payload: dict[str, Any]


class MappedModifier(BaseModel):
    modifier_id: int | None = None
    modifier_name: str
    confidence: float = Field(ge=0.0, le=1.0)
    note: str | None = None


class MappedItem(BaseModel):
    raw_name: str
    menu_item_id: int | None = None
    menu_item_name: str
    quantity: int
    modifiers: list[MappedModifier] = Field(default_factory=list)
    special_instructions: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    needs_review: bool = False


class ParsedOrderOut(BaseModel):
    """Result of running an IncomingOrder through the AI parser."""

    model_config = ConfigDict(strict=True)

    mapped_items: list[MappedItem]
    detected_allergies: list[str] = Field(default_factory=list)
    detected_dietary: list[str] = Field(default_factory=list)
    unmappable_notes: list[str] = Field(default_factory=list)
    kitchen_note: str | None = None
    overall_confidence: float = Field(ge=0.0, le=1.0)
    flagged_for_review: bool = False


class OrderListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    platform: str
    external_order_id: str
    customer_display_name: str
    placed_at: datetime
    overall_confidence: float
    flagged: bool
    status: str  # pending_review, sent, flagged, rejected
    item_count: int
    has_allergies: bool


class OrderDetail(BaseModel):
    raw: dict[str, Any]
    parsed: ParsedOrderOut
    raw_id: int
    parsed_id: int
    platform: str
    external_order_id: str
    placed_at: datetime
    pickup_time: datetime | None = None
    customer_display_name: str
    status: str


class ReviewRequest(BaseModel):
    model_config = ConfigDict(strict=False)
    parsed_id: int
    action: Literal["send", "flag", "reject"]
    edits: ParsedOrderOut | None = None
    notes: str | None = None

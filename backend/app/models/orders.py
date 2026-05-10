"""Order intake, parsing, review, and sync log models."""

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IncomingOrderRaw(Base):
    __tablename__ = "incoming_orders_raw"
    __table_args__ = (UniqueConstraint("platform", "external_order_id", name="uq_platform_extid"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    platform: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    external_order_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    payload_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    signature_valid: Mapped[bool] = mapped_column(Boolean, default=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    parsed: Mapped["ParsedOrder | None"] = relationship(
        back_populates="raw", cascade="all, delete-orphan", uselist=False
    )


class ParsedOrder(Base):
    __tablename__ = "parsed_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    raw_id: Mapped[int] = mapped_column(
        ForeignKey("incoming_orders_raw.id"), unique=True, index=True
    )
    parsed_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    overall_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    parse_duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    raw: Mapped[IncomingOrderRaw] = relationship(back_populates="parsed")
    review: Mapped["OrderReview | None"] = relationship(
        back_populates="parsed", cascade="all, delete-orphan", uselist=False
    )


class OrderReview(Base):
    __tablename__ = "order_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    parsed_id: Mapped[int] = mapped_column(
        ForeignKey("parsed_orders.id"), unique=True, index=True
    )
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # sent, flagged, rejected
    edits_json: Mapped[dict] = mapped_column(JSON, default=dict)
    sent_to_toast_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    toast_order_id: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    parsed: Mapped[ParsedOrder] = relationship(back_populates="review")


class SyncLog(Base):
    __tablename__ = "sync_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    item_id: Mapped[int] = mapped_column(Integer, index=True)
    platform: Mapped[str] = mapped_column(String(50), index=True)
    action: Mapped[str] = mapped_column(String(50))  # 86, restore, sync_check
    status: Mapped[str] = mapped_column(String(50))  # success, failure, retry
    attempt_count: Mapped[int] = mapped_column(Integer, default=1)
    error_message: Mapped[str | None] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class ToastOrder(Base):
    """Mock Toast POS order — kitchen display reads from this table."""

    __tablename__ = "toast_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    toast_order_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    fired_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    status: Mapped[str] = mapped_column(String(50), default="fired")  # fired, in_kitchen, ready

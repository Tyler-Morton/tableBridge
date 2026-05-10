"""Menu and restaurant models (mocks Toast POS schema)."""

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
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="America/New_York")
    settings_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    categories: Mapped[list["MenuCategory"]] = relationship(
        back_populates="restaurant", cascade="all, delete-orphan"
    )


class ApiCredential(Base):
    __tablename__ = "api_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), index=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    encrypted_payload: Mapped[str] = mapped_column(Text, nullable=False)
    configured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    restaurant: Mapped[Restaurant] = relationship(back_populates="categories")
    items: Mapped[list["MenuItem"]] = relationship(
        back_populates="category", cascade="all, delete-orphan"
    )


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("menu_categories.id"), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    prep_time: Mapped[int] = mapped_column(Integer, default=10)  # minutes
    allergen_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    available: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped[MenuCategory] = relationship(back_populates="items")
    modifier_groups: Mapped[list["ModifierGroup"]] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )


class ModifierGroup(Base):
    __tablename__ = "modifier_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"), index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    min_select: Mapped[int] = mapped_column(Integer, default=0)
    max_select: Mapped[int] = mapped_column(Integer, default=1)

    item: Mapped[MenuItem] = relationship(back_populates="modifier_groups")
    modifiers: Mapped[list["Modifier"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class Modifier(Base):
    __tablename__ = "modifiers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("modifier_groups.id"), index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_adjustment: Mapped[float] = mapped_column(Float, default=0.0)
    available: Mapped[bool] = mapped_column(Boolean, default=True)

    group: Mapped[ModifierGroup] = relationship(back_populates="modifiers")

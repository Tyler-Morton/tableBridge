"""Authentication schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(strict=True)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class PinLoginRequest(BaseModel):
    model_config = ConfigDict(strict=True)
    email: EmailStr
    pin: str = Field(pattern=r"^\d{4}$")


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    name: str
    role: str
    active: bool
    last_login: datetime | None = None

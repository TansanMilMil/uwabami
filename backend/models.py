from datetime import date
from typing import Optional

from pydantic import BaseModel


class User(BaseModel):
    id: int | None = None
    username: str
    password_hash: str


class UserCreate(BaseModel):
    username: str
    password: str


class TasteType(BaseModel):
    id: int | None = None
    name: str


class TasteTypeCreate(BaseModel):
    name: str


class DrinkLog(BaseModel):
    id: int | None = None
    drink_id: int
    user_id: int
    drunk_date: str # YYYY-MM-DD
    star_rating: float
    memo: str | None = None


class DrinkLogCreate(BaseModel):
    drunk_date: str | None = None  # YYYY-MM-DD
    star_rating: float
    memo: str | None = None


class Drink(BaseModel):
    id: int | None = None
    name: str
    category: str
    status: str
    origin: str | None = None
    price: int | None = None
    memo: str | None = None
    image_path: str | None = None
    created_by: int
    taste_types: list[TasteType] = []


class DrinkCreate(BaseModel):
    name: str
    category: str
    status: str
    origin: str | None = None
    price: int | None = None
    memo: str | None = None
    taste_types: list[int] = []
    new_taste_types: list[str] = []


class DrinkUpdate(DrinkCreate):
    pass


class DrinkDetail(Drink):
    logs: list[DrinkLog] = []

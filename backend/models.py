from datetime import date
from typing import Optional

from pydantic import BaseModel


class User(BaseModel):
    id: int | None = None
    username: str
    password_hash: str


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
    username: str | None = None


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


class DrinkSuggestResponse(BaseModel):
    name: str | None = None
    category: str | None = None
    origin: str | None = None
    taste_type_ids: list[int] = []
    memo: str | None = None
    price: int | None = None


class DrinkDetail(Drink):
    logs: list[DrinkLog] = []


class StepCreate(BaseModel):
    step_number: int
    description: str


class Step(StepCreate):
    id: int | None = None
    recipe_id: int | None = None


class IngredientCreate(BaseModel):
    group_name: str | None = None
    sort_order: int | None = None
    name: str | None = None
    quantity: str | None = None
    unit: str | None = None
    note: str | None = None


class Ingredient(IngredientCreate):
    id: int | None = None
    recipe_id: int | None = None


class RecipeCreate(BaseModel):
    name: str
    source_url: str | None = None
    servings: str | None = None
    ingredients: list[IngredientCreate] = []
    steps: list[StepCreate] = []


class RecipeUpdate(RecipeCreate):
    pass


class Recipe(BaseModel):
    id: int | None = None
    name: str
    source_url: str | None = None
    servings: str | None = None
    scraped_at: str | None = None
    username: str | None = None
    ingredient_names: list[str] = []
    image_path: str | None = None


class RecipeDetail(Recipe):
    ingredients: list[Ingredient] = []
    steps: list[Step] = []


class CookedLogCreate(BaseModel):
    memo: str | None = None


class CookedLogEntry(BaseModel):
    recipe_id: int
    recipe_name: str | None = None
    image_path: str | None = None
    count: int
    last_cooked_at: str | None = None
    latest_memo: str | None = None


class CookedLogRawEntry(BaseModel):
    id: int
    cooked_at: str | None = None
    memo: str | None = None

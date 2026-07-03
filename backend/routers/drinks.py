from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

from db import repo
from models import DrinkCreate, DrinkUpdate, Drink, DrinkDetail
from routers.auth import get_current_user, get_optional_user

router = APIRouter()

@router.get("/api/drinks")
def get_drinks(q: Optional[str] = Query(None), status: Optional[str] = Query(None), category: Optional[str] = Query(None)):
    drinks = repo.get_drinks(status=status, q=q, category=category)
    return drinks

@router.post("/api/drinks")
def create_drink(drink: DrinkCreate, user: dict = Depends(get_current_user)):
    taste_type_ids = list(drink.taste_types)
    for new_taste in drink.new_taste_types:
        tid = repo.create_taste_type(new_taste)
        taste_type_ids.append(tid)

    drink_id = repo.create_drink(
        name=drink.name,
        category=drink.category,
        status=drink.status,
        origin=drink.origin,
        price=drink.price,
        memo=drink.memo,
        created_by=user["id"],
        taste_type_ids=taste_type_ids
    )
    return {"id": drink_id}

@router.get("/api/drinks/categories")
def get_drink_categories():
    return repo.get_drink_categories()

@router.get("/api/drinks/origins")
def get_drink_origins():
    return repo.get_drink_origins()

@router.get("/api/drinks/{drink_id}")
def get_drink(drink_id: int):
    drink = repo.get_drink_by_id(drink_id)
    if not drink:
        raise HTTPException(status_code=404, detail="Drink not found")
    
    logs = repo.get_drink_logs(drink_id)
    drink["logs"] = logs
    return drink

@router.put("/api/drinks/{drink_id}")
def update_drink(drink_id: int, drink: DrinkUpdate, user: dict = Depends(get_current_user)):
    existing = repo.get_drink_by_id(drink_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Drink not found")
    if existing["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    taste_type_ids = list(drink.taste_types)
    for new_taste in drink.new_taste_types:
        tid = repo.create_taste_type(new_taste)
        taste_type_ids.append(tid)

    repo.update_drink(
        drink_id=drink_id,
        name=drink.name,
        category=drink.category,
        status=drink.status,
        origin=drink.origin,
        price=drink.price,
        memo=drink.memo,
        taste_type_ids=taste_type_ids
    )
    return {"ok": True}

@router.delete("/api/drinks/{drink_id}")
def delete_drink(drink_id: int, user: dict = Depends(get_current_user)):
    existing = repo.get_drink_by_id(drink_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Drink not found")
    if existing["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    repo.delete_drink(drink_id)
    return {"ok": True}

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from db import repo
import drink_ai
from models import DrinkCreate, DrinkUpdate, Drink, DrinkDetail, DrinkSuggestRequest, DrinkSuggestResponse
from routers.auth import get_current_user, get_optional_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

@router.get("/api/drinks")
def get_drinks(q: Optional[str] = Query(None), status: Optional[str] = Query(None), category: Optional[str] = Query(None), sort: Optional[str] = Query(None)):
    drinks = repo.get_drinks(status=status, q=q, category=category, sort=sort)
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

def _match_taste_type_ids(selected_names, taste_types):
    name_to_id = {t["name"].strip(): t["id"] for t in taste_types}
    ids = []
    for n in selected_names or []:
        if isinstance(n, str) and n.strip() in name_to_id:
            ids.append(name_to_id[n.strip()])
    return ids


@router.post("/api/drinks/suggest", response_model=DrinkSuggestResponse)
@limiter.limit("10/minute")
def suggest_drink(request: Request, body: DrinkSuggestRequest, user: dict = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="お酒の名前を入力してください")

    categories = repo.get_drink_categories()
    origins = repo.get_drink_origins()
    taste_types = repo.get_taste_types()

    raw = drink_ai.suggest_drink_info(
        name=name,
        category_candidates=categories,
        origin_candidates=origins,
        taste_type_candidates=[t["name"] for t in taste_types],
    )

    price = raw.get("price")
    if not isinstance(price, int):
        price = None

    return DrinkSuggestResponse(
        category=(raw.get("category") or None),
        origin=(raw.get("origin") or None),
        taste_type_ids=_match_taste_type_ids(raw.get("taste_types"), taste_types),
        memo=(raw.get("memo") or None),
        price=price,
    )


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
    return repo.get_drink_by_id(drink_id)

@router.delete("/api/drinks/{drink_id}")
def delete_drink(drink_id: int, user: dict = Depends(get_current_user)):
    existing = repo.get_drink_by_id(drink_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Drink not found")
    if existing["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    repo.delete_drink(drink_id)
    return {"ok": True}

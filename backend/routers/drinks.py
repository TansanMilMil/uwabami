from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from typing import List, Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from db import repo
import drink_ai
from image_utils import normalize_to_jpeg_bytes
from models import DrinkCreate, DrinkUpdate, Drink, DrinkDetail, DrinkSuggestResponse
from routers.auth import get_current_user, get_optional_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

SUGGEST_IMAGE_ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
SUGGEST_IMAGE_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB
SUGGEST_IMAGE_MAX_LONG_SIDE = 1024

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
def suggest_drink(
    request: Request,
    name: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user),
):
    name = (name or "").strip()
    if not name and image is None:
        raise HTTPException(status_code=400, detail="お酒の名前または画像を入力してください")

    categories = repo.get_drink_categories()
    origins = repo.get_drink_origins()
    taste_types = repo.get_taste_types()

    if image is not None:
        if image.content_type not in SUGGEST_IMAGE_ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=415, detail="サポートされていない画像形式です")

        try:
            raw_image = image.file.read()
        except Exception:
            raise HTTPException(status_code=422, detail="画像の読み込みに失敗しました")

        if len(raw_image) > SUGGEST_IMAGE_MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="ファイルサイズが20MBを超えています")

        try:
            image_bytes = normalize_to_jpeg_bytes(raw_image, SUGGEST_IMAGE_MAX_LONG_SIDE)
        except Exception:
            raise HTTPException(status_code=422, detail="画像の読み込みに失敗しました")

        raw = drink_ai.suggest_drink_info_from_image(
            image_bytes=image_bytes,
            name_hint=(name or None),
            category_candidates=categories,
            origin_candidates=origins,
            taste_type_candidates=[t["name"] for t in taste_types],
        )
    else:
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
        name=(raw.get("name") or None) if image is not None else None,
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

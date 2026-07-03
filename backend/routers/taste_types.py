from fastapi import APIRouter, Depends

from db import repo
from models import TasteTypeCreate
from routers.auth import get_current_user

router = APIRouter()

@router.get("/api/taste-types")
def get_taste_types():
    return repo.get_taste_types()

@router.post("/api/taste-types")
def create_taste_type(taste: TasteTypeCreate, user: dict = Depends(get_current_user)):
    tid = repo.create_taste_type(taste.name)
    return {"id": tid}

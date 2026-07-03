from datetime import date
from fastapi import APIRouter, Depends, HTTPException

from db import repo
from models import DrinkLogCreate
from routers.auth import get_current_user

router = APIRouter()

@router.get("/api/drinks/{drink_id}/logs")
def get_drink_logs(drink_id: int):
    return repo.get_drink_logs(drink_id)

@router.post("/api/drinks/{drink_id}/logs")
def create_drink_log(drink_id: int, log: DrinkLogCreate, user: dict = Depends(get_current_user)):
    existing_drink = repo.get_drink_by_id(drink_id)
    if not existing_drink:
        raise HTTPException(status_code=404, detail="Drink not found")
    if existing_drink["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    drunk_date = log.drunk_date if log.drunk_date else date.today().isoformat()

    log_id = repo.create_drink_log(
        drink_id=drink_id,
        user_id=user["id"],
        drunk_date=drunk_date,
        star_rating=log.star_rating,
        memo=log.memo
    )
    
    # 呑みたいステータスなら呑んだステータスに更新
    if existing_drink["status"] == "want_to_drink":
        repo.update_drink(
            drink_id=drink_id,
            name=existing_drink["name"],
            category=existing_drink["category"],
            status="drunk",
            origin=existing_drink.get("origin"),
            price=existing_drink.get("price"),
            memo=existing_drink.get("memo"),
            taste_type_ids=[t["id"] for t in existing_drink["taste_types"]]
        )

    return {"id": log_id}

@router.put("/api/logs/{log_id}")
def update_drink_log(log_id: int, log: DrinkLogCreate, user: dict = Depends(get_current_user)):
    existing_log = repo.get_log_by_id(log_id)
    if not existing_log:
        raise HTTPException(status_code=404, detail="Log not found")
    if existing_log["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    drunk_date = log.drunk_date if log.drunk_date else existing_log["drunk_date"]

    repo.update_drink_log(
        log_id=log_id,
        drunk_date=drunk_date,
        star_rating=log.star_rating,
        memo=log.memo
    )
    return {"ok": True}

@router.delete("/api/logs/{log_id}")
def delete_drink_log(log_id: int, user: dict = Depends(get_current_user)):
    existing_log = repo.get_log_by_id(log_id)
    if not existing_log:
        raise HTTPException(status_code=404, detail="Log not found")
    if existing_log["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    repo.delete_drink_log(log_id)
    return {"ok": True}

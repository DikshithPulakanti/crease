from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.player import Player

router = APIRouter(prefix="/players", tags=["players"])

@router.get("/")
async def get_players(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Player))
    players = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "position": p.position,
            "club": p.club,
            "photo_url": p.photo_url,
        }
        for p in players
    ]
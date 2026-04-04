from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List
from app.database import get_db
from app.models.squad import SquadPlayer
from app.models.player import Player
from app.models.gameweek import GameweekSelection, Gameweek

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("/{team_id}/squad")
async def get_squad(team_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SquadPlayer).where(SquadPlayer.team_id == team_id)
    )
    squad_players = result.scalars().all()

    players = []
    for sp in squad_players:
        player_result = await db.execute(
            select(Player).where(Player.id == sp.player_id)
        )
        player = player_result.scalar_one_or_none()
        if player:
            players.append({
                "player_id": str(sp.player_id),
                "player": {
                    "id": str(player.id),
                    "name": player.name,
                    "position": player.position,
                    "club": player.club,
                    "photo_url": player.photo_url,
                }
            })

    return players


class SelectionRequest(BaseModel):
    starting_11: List[str]
    captain_id: str
    vice_captain_id: str


@router.post("/{team_id}/selection")
async def save_selection(
    team_id: str,
    body: SelectionRequest,
    db: AsyncSession = Depends(get_db)
):
    if len(body.starting_11) != 11:
        raise HTTPException(status_code=400, detail="Must select exactly 11 players")

    if body.captain_id not in body.starting_11:
        raise HTTPException(status_code=400, detail="Captain must be in starting 11")

    if body.vice_captain_id not in body.starting_11:
        raise HTTPException(status_code=400, detail="Vice captain must be in starting 11")

    if body.captain_id == body.vice_captain_id:
        raise HTTPException(status_code=400, detail="Captain and vice captain must be different players")

    return {"message": "Selection saved successfully"}
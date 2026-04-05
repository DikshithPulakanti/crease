from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.player import Player
from app.models.gameweek import Gameweek
from app.models.matchup import PlayerMatchScore

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


@router.get("/{player_id}/gamelog")
async def get_player_gamelog(
    player_id: str,
    league_id: str = Query(..., description="League to scope gameweeks"),
    db: AsyncSession = Depends(get_db),
):
    """Per-gameweek scores for a player within a league."""
    p_result = await db.execute(select(Player).where(Player.id == player_id))
    player = p_result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    gw_result = await db.execute(
        select(Gameweek)
        .where(Gameweek.league_id == league_id)
        .order_by(Gameweek.number)
    )
    gameweeks = gw_result.scalars().all()

    rows = []
    for gw in gameweeks:
        score_result = await db.execute(
            select(PlayerMatchScore).where(
                PlayerMatchScore.player_id == player_id,
                PlayerMatchScore.gameweek_id == gw.id,
            )
        )
        score = score_result.scalar_one_or_none()
        rows.append(
            {
                "gameweek_id": str(gw.id),
                "number": gw.number,
                "label": gw.label,
                "total_points": float(score.total_points) if score else 0.0,
                "stats": score.stats if score else {},
                "breakdown": score.stats if score else {},
            }
        )

    return {
        "player": {
            "id": str(player.id),
            "name": player.name,
            "position": player.position,
            "club": player.club,
            "photo_url": player.photo_url,
        },
        "rows": rows,
    }
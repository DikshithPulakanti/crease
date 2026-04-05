from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models.squad import SquadPlayer
from app.models.player import Player
from app.models.trade import Trade
from app.models.team import Team
from app.models.activity import ActivityFeed
from app.models.gameweek import Gameweek, GameweekSelection
from app.models.matchup import PlayerMatchScore

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("/{team_id}/roster")
async def get_roster(
    team_id: str,
    gameweek: Optional[int] = Query(
        None, description="Gameweek number within the team's league"
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Squad with optional per-gameweek selection flags and fantasy points.
    """
    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    league_id = str(team.league_id)

    gw_id: Optional[str] = None
    if gameweek is not None:
        gw_result = await db.execute(
            select(Gameweek).where(
                Gameweek.league_id == league_id,
                Gameweek.number == gameweek,
            )
        )
        gw = gw_result.scalar_one_or_none()
        if gw:
            gw_id = str(gw.id)

    result = await db.execute(
        select(SquadPlayer).where(SquadPlayer.team_id == team_id)
    )
    squad_players = result.scalars().all()

    selections: dict[str, GameweekSelection] = {}
    if gw_id:
        sel_result = await db.execute(
            select(GameweekSelection).where(
                GameweekSelection.team_id == team_id,
                GameweekSelection.gameweek_id == gw_id,
            )
        )
        for s in sel_result.scalars().all():
            selections[str(s.player_id)] = s

    out = []
    for sp in squad_players:
        player_result = await db.execute(
            select(Player).where(Player.id == sp.player_id)
        )
        player = player_result.scalar_one_or_none()
        if not player:
            continue

        sel = selections.get(str(sp.player_id))
        pts = 0.0
        breakdown: dict | None = None
        if gw_id:
            score_result = await db.execute(
                select(PlayerMatchScore).where(
                    PlayerMatchScore.player_id == sp.player_id,
                    PlayerMatchScore.gameweek_id == gw_id,
                )
            )
            score = score_result.scalar_one_or_none()
            if score:
                pts = float(score.total_points)
                breakdown = score.stats

        base_pts = pts
        mult = 1.0
        if sel:
            if sel.is_captain:
                mult = 2.0
            elif sel.is_vice_captain:
                mult = 1.5
        final_pts = round(base_pts * mult, 1)

        out.append(
            {
                "player_id": str(sp.player_id),
                "player": {
                    "id": str(player.id),
                    "name": player.name,
                    "position": player.position,
                    "club": player.club,
                    "photo_url": player.photo_url,
                },
                "is_starting": bool(sel),
                "is_captain": bool(sel and sel.is_captain),
                "is_vice_captain": bool(sel and sel.is_vice_captain),
                "base_points": base_pts,
                "multiplier": mult,
                "fantasy_points": final_pts,
                "stats_breakdown": breakdown,
            }
        )

    return {
        "team_id": team_id,
        "league_id": league_id,
        "gameweek": gameweek,
        "players": out,
    }


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
        raise HTTPException(status_code=400, detail="Captain and vice captain must be different")

    # Validate positions in starting 11
    players_result = await db.execute(
        select(Player).where(Player.id.in_(body.starting_11))
    )
    starting_players = players_result.scalars().all()

    position_counts = {"GK": 0, "DEF": 0, "MID": 0, "ATT": 0}
    for p in starting_players:
        position_counts[p.position] = position_counts.get(p.position, 0) + 1

    # Must have exactly 1 GK
    if position_counts.get("GK", 0) != 1:
        raise HTTPException(status_code=400, detail="Starting 11 must have exactly 1 goalkeeper")

    # Must have at least 3 DEF
    if position_counts.get("DEF", 0) < 3:
        raise HTTPException(status_code=400, detail="Starting 11 must have at least 3 defenders")

    # Must have at least 2 MID
    if position_counts.get("MID", 0) < 2:
        raise HTTPException(status_code=400, detail="Starting 11 must have at least 2 midfielders")

    # Must have at least 1 ATT
    if position_counts.get("ATT", 0) < 1:
        raise HTTPException(status_code=400, detail="Starting 11 must have at least 1 attacker")

    return {"message": "Selection saved successfully", "position_counts": position_counts}


class TradeRequest(BaseModel):
    league_id: str
    receiver_team_id: str
    proposer_player_id: str
    receiver_player_id: str


@router.post("/{team_id}/trades")
async def propose_trade(
    team_id: str,
    body: TradeRequest,
    db: AsyncSession = Depends(get_db)
):
    trade = Trade(
        league_id=body.league_id,
        proposer_team_id=team_id,
        receiver_team_id=body.receiver_team_id,
        proposer_player_id=body.proposer_player_id,
        receiver_player_id=body.receiver_player_id,
        status="pending",
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db.add(trade)

    activity = ActivityFeed(
        league_id=body.league_id,
        type="trade_proposed",
        actor_team_id=team_id,
        payload={
            "trade_id": str(trade.id),
            "proposer_team_id": team_id,
            "receiver_team_id": body.receiver_team_id,
            "proposer_player_id": body.proposer_player_id,
            "receiver_player_id": body.receiver_player_id,
        }
    )
    db.add(activity)
    await db.commit()

    return {"trade_id": str(trade.id), "status": "pending"}


@router.get("/{team_id}/trades")
async def get_trades(team_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Trade).where(
            (Trade.proposer_team_id == team_id) |
            (Trade.receiver_team_id == team_id)
        )
    )
    trades = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "league_id": str(t.league_id),
            "proposer_team_id": str(t.proposer_team_id),
            "receiver_team_id": str(t.receiver_team_id),
            "proposer_player_id": str(t.proposer_player_id),
            "receiver_player_id": str(t.receiver_player_id),
            "status": t.status,
            "expires_at": t.expires_at.isoformat(),
            "created_at": t.created_at.isoformat(),
        }
        for t in trades
    ]


class TradeActionRequest(BaseModel):
    action: str
    counter_proposer_player_id: str | None = None
    counter_receiver_player_id: str | None = None


@router.post("/{team_id}/trades/{trade_id}/action")
async def trade_action(
    team_id: str,
    trade_id: str,
    body: TradeActionRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Trade).where(Trade.id == trade_id)
    )
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    if body.action == "accept":
        prop_squad = await db.execute(
            select(SquadPlayer).where(
                SquadPlayer.team_id == trade.proposer_team_id,
                SquadPlayer.player_id == trade.proposer_player_id
            )
        )
        prop_player = prop_squad.scalar_one_or_none()

        recv_squad = await db.execute(
            select(SquadPlayer).where(
                SquadPlayer.team_id == trade.receiver_team_id,
                SquadPlayer.player_id == trade.receiver_player_id
            )
        )
        recv_player = recv_squad.scalar_one_or_none()

        if prop_player and recv_player:
            prop_player.team_id = trade.receiver_team_id
            recv_player.team_id = trade.proposer_team_id

        trade.status = "accepted"
        activity_type = "trade_accepted"

    elif body.action == "reject":
        trade.status = "rejected"
        activity_type = "trade_rejected"

    elif body.action == "counter":
        trade.status = "countered"
        counter = Trade(
            league_id=trade.league_id,
            proposer_team_id=team_id,
            receiver_team_id=trade.proposer_team_id,
            proposer_player_id=body.counter_proposer_player_id,
            receiver_player_id=body.counter_receiver_player_id,
            status="pending",
            parent_trade_id=trade.id,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        db.add(counter)
        activity_type = "trade_countered"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    activity = ActivityFeed(
        league_id=trade.league_id,
        type=activity_type,
        actor_team_id=team_id,
        payload={"trade_id": str(trade.id)}
    )
    db.add(activity)
    await db.commit()

    return {"status": trade.status}


class FreeAgentRequest(BaseModel):
    league_id: str
    player_in_id: str
    player_out_id: str


@router.post("/{team_id}/free-agent")
async def claim_free_agent(
    team_id: str,
    body: FreeAgentRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SquadPlayer).where(SquadPlayer.team_id == team_id)
    )
    squad = result.scalars().all()

    if len(squad) >= 15:
        drop = next((s for s in squad if str(s.player_id) == body.player_out_id), None)
        if not drop:
            raise HTTPException(status_code=400, detail="Player to drop not found in squad")
        await db.delete(drop)

    new_player = SquadPlayer(
        team_id=team_id,
        player_id=body.player_in_id,
        acquired_via="free_agent"
    )
    db.add(new_player)

    activity = ActivityFeed(
        league_id=body.league_id,
        type="free_agent_claim",
        actor_team_id=team_id,
        payload={
            "player_in_id": body.player_in_id,
            "player_out_id": body.player_out_id,
        }
    )
    db.add(activity)
    await db.commit()

    return {"message": "Free agent claimed successfully"}
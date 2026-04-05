import random
import string
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models.league import League
from app.models.team import Team
from app.models.user import User
from app.models.activity import ActivityFeed
from app.draft import initialize_draft, get_draft_state

router = APIRouter(prefix="/leagues", tags=["leagues"])


def generate_invite_code(length: int = 8) -> str:
    chars = string.ascii_uppercase + string.digits
    return "CL-" + "".join(random.choices(chars, k=length))


class CreateLeagueRequest(BaseModel):
    name: str
    max_teams: int
    commissioner_user_id: str
    team_name: str


class JoinLeagueRequest(BaseModel):
    invite_code: str
    user_id: str
    team_name: str


@router.post("/")
async def create_league(body: CreateLeagueRequest, db: AsyncSession = Depends(get_db)):
    if body.max_teams % 2 != 0:
        raise HTTPException(status_code=400, detail="max_teams must be even")

    result = await db.execute(
        select(User).where(User.id == body.commissioner_user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            id=body.commissioner_user_id,
            clerk_id=body.commissioner_user_id,
            username=body.commissioner_user_id,
            email=f"{body.commissioner_user_id}@placeholder.com",
        )
        db.add(user)
        await db.flush()

    league = League(
        name=body.name,
        invite_code=generate_invite_code(),
        commissioner_id=body.commissioner_user_id,
        max_teams=body.max_teams,
        status="setup"
    )
    db.add(league)
    await db.flush()

    team = Team(
        league_id=league.id,
        user_id=body.commissioner_user_id,
        name=body.team_name
    )
    db.add(team)
    await db.commit()

    return {
        "league_id": str(league.id),
        "invite_code": league.invite_code,
        "team_id": str(team.id)
    }


@router.post("/{league_id}/join")
async def join_league(
    league_id: str,
    body: JoinLeagueRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(League).where(League.id == league_id)
    )
    league = result.scalar_one_or_none()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    if league.invite_code != body.invite_code:
        raise HTTPException(status_code=400, detail="Invalid invite code")

    teams_result = await db.execute(
        select(Team).where(Team.league_id == league_id)
    )
    teams = teams_result.scalars().all()

    if len(teams) >= league.max_teams:
        raise HTTPException(status_code=400, detail="League is full")

    for t in teams:
        if t.name == body.team_name:
            raise HTTPException(
                status_code=400,
                detail="Team name already taken in this league"
            )

    for t in teams:
        if t.user_id == body.user_id:
            raise HTTPException(
                status_code=400,
                detail="You are already in this league"
            )

    result2 = await db.execute(
        select(User).where(User.id == body.user_id)
    )
    user = result2.scalar_one_or_none()
    if not user:
        user = User(
            id=body.user_id,
            clerk_id=body.user_id,
            username=body.user_id,
            email=f"{body.user_id}@placeholder.com",
        )
        db.add(user)
        await db.flush()

    team = Team(
        league_id=league_id,
        user_id=body.user_id,
        name=body.team_name
    )
    db.add(team)
    await db.commit()

    return {"team_id": str(team.id)}


@router.post("/{league_id}/start-draft")
async def start_draft(league_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Team).where(Team.league_id == league_id)
    )
    teams = result.scalars().all()

    if len(teams) < 2:
        raise HTTPException(
            status_code=400,
            detail="Need at least 2 teams to start draft"
        )

    team_ids = [str(t.id) for t in teams]

    shuffled_order = await initialize_draft(
        league_id=league_id,
        team_ids=team_ids
    )

    for i, team_id in enumerate(shuffled_order):
        for team in teams:
            if str(team.id) == team_id:
                team.draft_position = i + 1

    result2 = await db.execute(
        select(League).where(League.id == league_id)
    )
    league = result2.scalar_one_or_none()
    league.status = "drafting"

    await db.commit()

    return {
        "message": "Draft started",
        "draft_order": shuffled_order
    }


@router.get("/{league_id}/draft-state")
async def get_draft(league_id: str):
    state = await get_draft_state(league_id)
    return state


@router.get("/{league_id}/hub")
async def get_league_hub(league_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(League).where(League.id == league_id)
    )
    league = result.scalar_one_or_none()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    teams_result = await db.execute(
        select(Team).where(Team.league_id == league_id)
    )
    teams = teams_result.scalars().all()

    return {
        "league_id": str(league.id),
        "name": league.name,
        "status": league.status,
        "invite_code": league.invite_code,
        "max_teams": league.max_teams,
        "teams": [
            {
                "id": str(t.id),
                "name": t.name,
                "user_id": t.user_id,
                "draft_position": t.draft_position,
                "standings_points": float(t.standings_points or 0),
            }
            for t in teams
        ]
    }


@router.get("/{league_id}/free-agents")
async def get_free_agents(league_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.squad import SquadPlayer
    from app.models.player import Player

    teams_result = await db.execute(
        select(Team).where(Team.league_id == league_id)
    )
    teams = teams_result.scalars().all()
    team_ids = [t.id for t in teams]

    drafted_result = await db.execute(
        select(SquadPlayer.player_id).where(
            SquadPlayer.team_id.in_(team_ids)
        )
    )
    drafted_ids = {row[0] for row in drafted_result.fetchall()}

    all_players_result = await db.execute(select(Player))
    free_agents = [
        p for p in all_players_result.scalars().all()
        if p.id not in drafted_ids
    ]

    return [
        {
            "id": str(p.id),
            "name": p.name,
            "position": p.position,
            "club": p.club,
            "photo_url": p.photo_url,
        }
        for p in free_agents
    ]


@router.get("/{league_id}/activity")
async def get_activity(league_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ActivityFeed)
        .where(ActivityFeed.league_id == league_id)
        .order_by(ActivityFeed.created_at.desc())
        .limit(50)
    )
    activities = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "type": a.type,
            "actor_team_id": str(a.actor_team_id) if a.actor_team_id else None,
            "payload": a.payload,
            "created_at": a.created_at.isoformat(),
        }
        for a in activities
    ]


@router.post("/{league_id}/gameweeks")
async def create_gameweek(
    league_id: str,
    db: AsyncSession = Depends(get_db)
):
    from app.models.gameweek import Gameweek
    from app.models.matchup import Matchup

    result = await db.execute(
        select(Gameweek).where(Gameweek.league_id == league_id)
    )
    existing = result.scalars().all()
    number = len(existing) + 1

    labels = {
        1: "QF Leg 1",
        2: "QF Leg 2",
        3: "SF Leg 1",
        4: "SF Leg 2",
        5: "Final"
    }
    label = labels.get(number, f"Gameweek {number}")

    now = datetime.utcnow()
    starts_at = now + timedelta(days=1)
    locks_at = starts_at - timedelta(minutes=90)
    ends_at = starts_at + timedelta(hours=3)

    gw = Gameweek(
        league_id=league_id,
        number=number,
        label=label,
        status="upcoming",
        starts_at=starts_at,
        locks_at=locks_at,
        ends_at=ends_at,
    )
    db.add(gw)
    await db.flush()

    teams_result = await db.execute(
        select(Team).where(Team.league_id == league_id)
    )
    teams = teams_result.scalars().all()
    team_ids = [t.id for t in teams]
    n = len(team_ids)

    round_idx = (number - 1) % (n - 1)
    fixed = team_ids[0]
    rotating = team_ids[1:]
    rotated = rotating[round_idx:] + rotating[:round_idx]
    pairs = [(fixed, rotated[0])] + [
        (rotated[i], rotated[n - 2 - i])
        for i in range(1, n // 2)
    ]

    for home_id, away_id in pairs:
        matchup = Matchup(
            league_id=league_id,
            gameweek_id=gw.id,
            home_team_id=home_id,
            away_team_id=away_id,
        )
        db.add(matchup)

    await db.commit()

    return {
        "gameweek_id": str(gw.id),
        "number": number,
        "label": label,
        "starts_at": starts_at.isoformat(),
        "locks_at": locks_at.isoformat(),
    }


@router.get("/{league_id}/gameweeks")
async def get_gameweeks(league_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.gameweek import Gameweek
    result = await db.execute(
        select(Gameweek)
        .where(Gameweek.league_id == league_id)
        .order_by(Gameweek.number)
    )
    gameweeks = result.scalars().all()
    return [
        {
            "id": str(g.id),
            "number": g.number,
            "label": g.label,
            "status": g.status,
            "starts_at": g.starts_at.isoformat() if g.starts_at else None,
            "locks_at": g.locks_at.isoformat() if g.locks_at else None,
            "ends_at": g.ends_at.isoformat() if g.ends_at else None,
        }
        for g in gameweeks
    ]


@router.get("/{league_id}/matchup/{gameweek_id}/{team_id}")
async def get_team_matchup(
    league_id: str,
    gameweek_id: str,
    team_id: str,
    db: AsyncSession = Depends(get_db)
):
    from app.models.matchup import Matchup
    from app.routers.scoring import get_team_gameweek_breakdown

    result = await db.execute(
        select(Matchup).where(
            Matchup.gameweek_id == gameweek_id,
            (Matchup.home_team_id == team_id) |
            (Matchup.away_team_id == team_id)
        )
    )
    matchup = result.scalar_one_or_none()
    if not matchup:
        raise HTTPException(status_code=404, detail="Matchup not found")

    home_players = await get_team_gameweek_breakdown(
        str(matchup.home_team_id), gameweek_id, db
    )
    away_players = await get_team_gameweek_breakdown(
        str(matchup.away_team_id), gameweek_id, db
    )

    return {
        "id": str(matchup.id),
        "home_team_id": str(matchup.home_team_id),
        "away_team_id": str(matchup.away_team_id),
        "home_score": float(matchup.home_score),
        "away_score": float(matchup.away_score),
        "result": matchup.result,
        "home_players": home_players,
        "away_players": away_players,
    }


@router.get("/{league_id}")
async def get_league(league_id: str, db: AsyncSession = Depends(get_db)):
    """Alias for hub — matches `GET /leagues/{id}` in the public API spec."""
    return await get_league_hub(league_id, db)


@router.get("/{league_id}/teams")
async def list_league_teams(league_id: str, db: AsyncSession = Depends(get_db)):
    hub = await get_league_hub(league_id, db)
    return hub["teams"]


@router.get("/{league_id}/standings")
async def get_standings(league_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.matchup import Matchup

    teams_result = await db.execute(
        select(Team).where(Team.league_id == league_id)
    )
    teams = {str(t.id): t for t in teams_result.scalars().all()}
    if not teams:
        return []

    wins: dict[str, int] = defaultdict(int)
    losses: dict[str, int] = defaultdict(int)
    fantasy_points: dict[str, float] = defaultdict(float)

    mu_result = await db.execute(
        select(Matchup).where(Matchup.league_id == league_id)
    )
    for m in mu_result.scalars().all():
        hid, aid = str(m.home_team_id), str(m.away_team_id)
        fantasy_points[hid] += float(m.home_score or 0)
        fantasy_points[aid] += float(m.away_score or 0)
        if not m.result:
            continue
        if m.result == "home":
            wins[hid] += 1
            losses[aid] += 1
        elif m.result == "away":
            wins[aid] += 1
            losses[hid] += 1

    user_ids = list({t.user_id for t in teams.values()})
    username_by_id: dict[str, str] = {}
    if user_ids:
        u_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        for u in u_result.scalars().all():
            username_by_id[u.id] = u.username

    rows = []
    for tid, team in teams.items():
        owner_username = username_by_id.get(team.user_id) or team.user_id
        rows.append(
            {
                "team_id": tid,
                "name": team.name,
                "user_id": team.user_id,
                "owner_username": owner_username,
                "wins": wins.get(tid, 0),
                "losses": losses.get(tid, 0),
                "fantasy_points_season": round(fantasy_points.get(tid, 0.0), 1),
                "standings_points": float(team.standings_points or 0),
            }
        )

    rows.sort(
        key=lambda r: (-r["wins"], -r["fantasy_points_season"], r["name"])
    )
    for i, row in enumerate(rows, start=1):
        row["rank"] = i
    return rows


@router.get("/{league_id}/matchups")
async def get_matchups_by_number(
    league_id: str,
    gameweek: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    from app.models.gameweek import Gameweek
    from app.models.matchup import Matchup

    gw_result = await db.execute(
        select(Gameweek).where(
            Gameweek.league_id == league_id,
            Gameweek.number == gameweek,
        )
    )
    gw = gw_result.scalar_one_or_none()
    if not gw:
        return {"gameweek": None, "matchups": []}

    mu_result = await db.execute(
        select(Matchup).where(Matchup.gameweek_id == gw.id)
    )
    matchups = mu_result.scalars().all()
    out = []
    for m in matchups:
        out.append(
            {
                "id": str(m.id),
                "home_team_id": str(m.home_team_id),
                "away_team_id": str(m.away_team_id),
                "home_score": float(m.home_score),
                "away_score": float(m.away_score),
                "result": m.result,
            }
        )
    return {
        "gameweek": {
            "id": str(gw.id),
            "number": gw.number,
            "label": gw.label,
            "starts_at": gw.starts_at.isoformat() if gw.starts_at else None,
            "locks_at": gw.locks_at.isoformat() if gw.locks_at else None,
        },
        "matchups": out,
    }


@router.get("/{league_id}/players")
async def get_league_players_pool(league_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.player import Player
    from app.models.squad import SquadPlayer

    teams_result = await db.execute(
        select(Team).where(Team.league_id == league_id)
    )
    teams = list(teams_result.scalars().all())
    team_ids = [t.id for t in teams]
    team_by_id = {str(t.id): t for t in teams}

    owner: dict[str, str] = {}
    if team_ids:
        sq_result = await db.execute(
            select(SquadPlayer).where(SquadPlayer.team_id.in_(team_ids))
        )
        for sp in sq_result.scalars().all():
            owner[str(sp.player_id)] = str(sp.team_id)

    players_result = await db.execute(select(Player))
    players = players_result.scalars().all()

    out = []
    for rank, p in enumerate(
        sorted(players, key=lambda x: x.name), start=1
    ):
        tid = owner.get(str(p.id))
        out.append(
            {
                "rank": rank,
                "id": str(p.id),
                "name": p.name,
                "position": p.position,
                "club": p.club,
                "photo_url": p.photo_url,
                "owner_team_id": tid,
                "owner_team_name": team_by_id[tid].name if tid else None,
                "points_season": 0.0,
                "stats": {
                    "goals": 0,
                    "assists": 0,
                    "clean_sheets": 0,
                    "saves": 0,
                    "yellows": 0,
                    "reds": 0,
                },
            }
        )
    return out


class LeagueTradePropose(BaseModel):
    proposer_team_id: str
    receiver_team_id: str
    proposer_player_ids: List[str]
    receiver_player_ids: List[str]


@router.post("/{league_id}/trades")
async def propose_league_trades(
    league_id: str,
    body: LeagueTradePropose,
    db: AsyncSession = Depends(get_db),
):
    from app.models.trade import Trade

    if len(body.proposer_player_ids) != len(body.receiver_player_ids):
        raise HTTPException(
            status_code=400,
            detail="proposer_player_ids and receiver_player_ids must match in length",
        )
    if not body.proposer_player_ids:
        raise HTTPException(status_code=400, detail="At least one player pair is required")

    created = []
    for prop_pid, recv_pid in zip(
        body.proposer_player_ids, body.receiver_player_ids
    ):
        trade = Trade(
            league_id=league_id,
            proposer_team_id=body.proposer_team_id,
            receiver_team_id=body.receiver_team_id,
            proposer_player_id=prop_pid,
            receiver_player_id=recv_pid,
            status="pending",
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        db.add(trade)
        db.flush()
        activity = ActivityFeed(
            league_id=league_id,
            type="trade_proposed",
            actor_team_id=body.proposer_team_id,
            payload={
                "trade_id": str(trade.id),
                "proposer_team_id": body.proposer_team_id,
                "receiver_team_id": body.receiver_team_id,
                "proposer_player_id": prop_pid,
                "receiver_player_id": recv_pid,
            },
        )
        db.add(activity)
        created.append(str(trade.id))
    await db.commit()
    return {"trade_ids": created, "status": "pending"}


@router.get("/{league_id}/trades")
async def list_league_trades(league_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.trade import Trade
    from app.models.player import Player

    result = await db.execute(
        select(Trade).where(Trade.league_id == league_id).order_by(Trade.created_at.desc())
    )
    trades = result.scalars().all()
    player_ids = set()
    for t in trades:
        player_ids.add(str(t.proposer_player_id))
        player_ids.add(str(t.receiver_player_id))

    names: dict[str, str] = {}
    if player_ids:
        pr = await db.execute(select(Player).where(Player.id.in_(player_ids)))
        for p in pr.scalars().all():
            names[str(p.id)] = p.name

    return [
        {
            "id": str(t.id),
            "league_id": str(t.league_id),
            "proposer_team_id": str(t.proposer_team_id),
            "receiver_team_id": str(t.receiver_team_id),
            "proposer_player_id": str(t.proposer_player_id),
            "receiver_player_id": str(t.receiver_player_id),
            "proposer_player_name": names.get(str(t.proposer_player_id), "?"),
            "receiver_player_name": names.get(str(t.receiver_player_id), "?"),
            "status": t.status,
            "expires_at": t.expires_at.isoformat(),
            "created_at": t.created_at.isoformat(),
        }
        for t in trades
    ]


@router.get("/{league_id}/draft")
async def get_draft_board(league_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.squad import DraftPick
    from app.models.player import Player

    picks_result = await db.execute(
        select(DraftPick)
        .where(DraftPick.league_id == league_id)
        .order_by(DraftPick.pick_number)
    )
    picks = picks_result.scalars().all()

    teams_result = await db.execute(
        select(Team).where(Team.league_id == league_id).order_by(Team.draft_position)
    )
    teams = teams_result.scalars().all()
    team_list = [
        {
            "id": str(t.id),
            "name": t.name,
            "draft_position": t.draft_position,
            "accent_index": (t.draft_position or 1) - 1,
        }
        for t in teams
    ]

    player_ids = [p.player_id for p in picks]
    players_map: dict[str, Player] = {}
    if player_ids:
        pr = await db.execute(select(Player).where(Player.id.in_(player_ids)))
        for pl in pr.scalars().all():
            players_map[str(pl.id)] = pl

    pick_rows = []
    for dp in picks:
        pl = players_map.get(str(dp.player_id))
        pick_rows.append(
            {
                "round": dp.round,
                "pick_number": dp.pick_number,
                "team_id": str(dp.team_id),
                "player_id": str(dp.player_id),
                "player": (
                    {
                        "id": str(pl.id),
                        "name": pl.name,
                        "position": pl.position,
                        "club": pl.club,
                        "photo_url": pl.photo_url,
                    }
                    if pl
                    else None
                ),
            }
        )

    return {
        "teams": team_list,
        "picks": pick_rows,
        "total_picks": len(pick_rows),
    }
"""
League & Draft HTTP Endpoints
------------------------------
POST /leagues              → create a league
POST /leagues/{id}/join    → join a league with invite code
POST /leagues/{id}/start-draft → commissioner starts the draft
GET  /leagues/{id}/draft-state → get current draft state
"""
import random
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models.league import League
from app.models.team import Team
from app.draft import initialize_draft, get_draft_state

router = APIRouter(prefix="/leagues", tags=["leagues"])


def generate_invite_code(length: int = 8) -> str:
    """Generates a random invite code like CL-X7K2AB"""
    chars = string.ascii_uppercase + string.digits
    return "CL-" + "".join(random.choices(chars, k=length))


# --- Request body schemas ---
class CreateLeagueRequest(BaseModel):
    name: str
    max_teams: int
    commissioner_user_id: str  # will come from Clerk auth in Week 3
    team_name: str


class JoinLeagueRequest(BaseModel):
    invite_code: str
    user_id: str
    team_name: str


# --- Endpoints ---
@router.post("/")
async def create_league(body: CreateLeagueRequest, db: AsyncSession = Depends(get_db)):
    # max_teams must be even
    if body.max_teams % 2 != 0:
        raise HTTPException(status_code=400, detail="max_teams must be even")

    # Create the league
    league = League(
        name=body.name,
        invite_code=generate_invite_code(),
        commissioner_id=body.commissioner_user_id,
        max_teams=body.max_teams,
        status="setup"
    )
    db.add(league)
    await db.flush()  # gets the league.id without full commit

    # Create the commissioner's team
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
    # Find the league
    result = await db.execute(
        select(League).where(League.id == league_id)
    )
    league = result.scalar_one_or_none()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Check invite code
    if league.invite_code != body.invite_code:
        raise HTTPException(status_code=400, detail="Invalid invite code")

    # Check league isn't full
    teams_result = await db.execute(
        select(Team).where(Team.league_id == league_id)
    )
    teams = teams_result.scalars().all()
    if len(teams) >= league.max_teams:
        raise HTTPException(status_code=400, detail="League is full")

    # Check team name is unique in this league
    for t in teams:
        if t.name == body.team_name:
            raise HTTPException(
                status_code=400,
                detail="Team name already taken in this league"
            )

    # Create the team
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
    # Get all teams in the league
    result = await db.execute(
        select(Team).where(Team.league_id == league_id)
    )
    teams = result.scalars().all()

    if len(teams) < 2:
        raise HTTPException(
            status_code=400,
            detail="Need at least 2 teams to start draft"
        )

    # Get team IDs as strings for Redis
    team_ids = [str(t.id) for t in teams]

    # Initialize draft state in Redis + get shuffled order
    shuffled_order = await initialize_draft(
        league_id=league_id,
        team_ids=team_ids
    )

    # Save draft positions back to PostgreSQL
    for i, team_id in enumerate(shuffled_order):
        for team in teams:
            if str(team.id) == team_id:
                team.draft_position = i + 1  # 1-indexed

    # Update league status
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
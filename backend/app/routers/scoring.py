"""
Scoring Router
--------------
Endpoints for calculating and retrieving fantasy points.

POST /scoring/calculate-gameweek  → fetches stats from API-Football
                                    and calculates points for all players
GET  /scoring/gameweek/{id}       → returns calculated points for a gameweek
GET  /scoring/matchup/{id}        → returns H2H matchup scores
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.config import settings
from app.scoring import calculate_player_points
from app.models.player import Player
from app.models.gameweek import Gameweek, GameweekSelection
from app.models.matchup import Matchup, PlayerMatchScore
from app.models.squad import SquadPlayer
from app.models.team import Team
from app.models.league import League

router = APIRouter(prefix="/scoring", tags=["scoring"])


def map_api_stats(api_stats: dict, position: str) -> dict:
    """
    Maps API-Football player stats response to our scoring engine format.
    API-Football returns nested stats — we flatten them here.
    """
    games = api_stats.get("games", {})
    goals = api_stats.get("goals", {})
    passes = api_stats.get("passes", {})
    tackles = api_stats.get("tackles", {})
    duels = api_stats.get("duels", {})
    dribbles = api_stats.get("dribbles", {})
    shots = api_stats.get("shots", {})
    cards = api_stats.get("cards", {})
    penalty = api_stats.get("penalty", {})
    fouls = api_stats.get("fouls", {})

    return {
        "minutes": games.get("minutes", 0) or 0,
        "goals": goals.get("total", 0) or 0,
        "assists": goals.get("assists", 0) or 0,
        "saves": goals.get("saves", 0) or 0,
        "goals_conceded": goals.get("conceded", 0) or 0,
        "shots_on_target": shots.get("on", 0) or 0,
        "shots_off_target": (shots.get("total", 0) or 0) - (shots.get("on", 0) or 0),
        "key_passes": passes.get("key", 0) or 0,
        "passes_accuracy": passes.get("accuracy", 0) or 0,
        "pass_accuracy": passes.get("accuracy", 0) or 0,
        "progressive_passes": passes.get("total", 0) or 0,
        "tackles_won": tackles.get("total", 0) or 0,
        "interceptions": tackles.get("interceptions", 0) or 0,
        "clearances": tackles.get("blocks", 0) or 0,
        "blocked_shots": tackles.get("blocks", 0) or 0,
        "aerial_duels_won": duels.get("won", 0) or 0,
        "dribbles_completed": dribbles.get("success", 0) or 0,
        "ball_recoveries": fouls.get("won", 0) or 0,
        "yellow_card": (cards.get("yellow", 0) or 0) > 0,
        "red_card": (cards.get("red", 0) or 0) > 0,
        "penalty_saves": penalty.get("saved", 0) or 0,
        "penalties_missed": penalty.get("missed", 0) or 0,
        "own_goals": goals.get("own_goals", 0) or 0,
        "big_chance_missed": 0,  # not available in basic API
        "offsides": 0,           # not available in basic API
        "chances_created": passes.get("key", 0) or 0,
        "motm": False,           # set separately if available
        # Rarity stats — most not available in basic API, default 0
        "high_claims": 0,
        "sweeper_actions": 0,
        "final_third_dribbles": 0,
        "outside_box_goals": 0,
        "own_box_aerial_duels_won": 0,
        "defensive_aerial_duels_won": 0,
        "own_half_tackles_won": 0,
        "own_box_clearances": 0,
        "defensive_third_interceptions": 0,
        "progressive_carries": dribbles.get("success", 0) or 0,
        "accurate_long_balls": 0,
        "possession_lost": dribbles.get("past", 0) or 0,
        "dribbled_past": dribbles.get("past", 0) or 0,
        "errors_leading_to_goal": fouls.get("committed", 0) or 0,
    }


async def fetch_match_player_stats(fixture_id: int) -> list[dict]:
    """
    Fetches player statistics for a specific match from API-Football.
    Returns list of player stats dicts.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            "https://v3.football.api-sports.io/fixtures/players",
            params={"fixture": fixture_id},
            headers={
                "x-apisports-key": settings.API_FOOTBALL_KEY,
            }
        )
        data = response.json()

    if not data.get("response"):
        return []

    all_players = []
    for team_data in data["response"]:
        team_info = team_data.get("team", {})
        team_won = False  # will be set after checking scores

        for player_stats in team_data.get("players", []):
            all_players.append({
                "api_player_id": player_stats["player"]["id"],
                "name": player_stats["player"]["name"],
                "stats": player_stats["statistics"][0] if player_stats.get("statistics") else {},
                "team_id": team_info.get("id"),
                "team_name": team_info.get("name"),
            })

    return all_players


async def fetch_fixture_result(fixture_id: int) -> dict:
    """
    Fetches the final score and winner for a fixture.
    Returns {home_goals, away_goals, home_team_id, away_team_id, winner_team_id}
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            "https://v3.football.api-sports.io/fixtures",
            params={"id": fixture_id},
            headers={"x-apisports-key": settings.API_FOOTBALL_KEY}
        )
        data = response.json()

    if not data.get("response"):
        return {}

    fixture = data["response"][0]
    goals = fixture.get("goals", {})
    teams = fixture.get("teams", {})

    home_goals = goals.get("home", 0) or 0
    away_goals = goals.get("away", 0) or 0
    home_team_id = teams.get("home", {}).get("id")
    away_team_id = teams.get("away", {}).get("id")

    winner_team_id = None
    if home_goals > away_goals:
        winner_team_id = home_team_id
    elif away_goals > home_goals:
        winner_team_id = away_team_id

    return {
        "home_goals": home_goals,
        "away_goals": away_goals,
        "home_team_id": home_team_id,
        "away_team_id": away_team_id,
        "winner_team_id": winner_team_id,
    }


class CalculateGameweekRequest(BaseModel):
    gameweek_id: str
    fixture_ids: list[int]  # API-Football fixture IDs for this gameweek


@router.post("/calculate-gameweek")
async def calculate_gameweek(
    body: CalculateGameweekRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Main scoring endpoint. Called after a CL matchday completes.
    1. Fetches stats from API-Football for each fixture
    2. Calculates fantasy points for every player
    3. Saves to player_match_scores table
    4. Updates H2H matchup scores
    5. Updates standings
    """
    gameweek_id = body.gameweek_id

    # Get the gameweek
    gw_result = await db.execute(
        select(Gameweek).where(Gameweek.id == gameweek_id)
    )
    gameweek = gw_result.scalar_one_or_none()
    if not gameweek:
        raise HTTPException(status_code=404, detail="Gameweek not found")

    # Map API player ID → our player
    all_players_result = await db.execute(select(Player))
    players_by_api_id = {
        p.api_football_id: p
        for p in all_players_result.scalars().all()
    }

    # Fetch and calculate for each fixture
    total_calculated = 0
    for fixture_id in body.fixture_ids:
        # Get fixture result (who won)
        fixture_result = await fetch_fixture_result(fixture_id)
        winner_team_id = fixture_result.get("winner_team_id")
        home_goals = fixture_result.get("home_goals", 0) or 0
        away_goals = fixture_result.get("away_goals", 0) or 0
        match_draw = home_goals == away_goals

        # Get player stats
        match_players = await fetch_match_player_stats(fixture_id)

        for mp in match_players:
            api_player_id = mp["api_player_id"]
            player = players_by_api_id.get(api_player_id)
            if not player:
                continue

            # Map stats
            stats = map_api_stats(mp["stats"], player.position)

            # Check if player's team won
            team_won = winner_team_id is not None and (mp["team_id"] == winner_team_id)

            # Calculate points
            result = calculate_player_points(
                position=player.position,
                stats=stats,
                team_won=team_won,
                match_draw=match_draw,
            )

            # Check if score already exists
            existing = await db.execute(
                select(PlayerMatchScore).where(
                    PlayerMatchScore.player_id == player.id,
                    PlayerMatchScore.gameweek_id == gameweek_id
                )
            )
            score_record = existing.scalar_one_or_none()

            if score_record:
                score_record.base_points = result["base_points"]
                score_record.bonus_points = result["bonus_points"]
                score_record.total_points = result["total_points"]
                score_record.stats = result["breakdown"]
                score_record.calculated_at = datetime.utcnow()
            else:
                score_record = PlayerMatchScore(
                    player_id=player.id,
                    gameweek_id=gameweek_id,
                    base_points=result["base_points"],
                    bonus_points=result["bonus_points"],
                    total_points=result["total_points"],
                    stats=result["breakdown"],
                    calculated_at=datetime.utcnow()
                )
                db.add(score_record)

            total_calculated += 1

    await db.commit()

    # Update matchup scores with captain/VC multipliers
    await update_matchup_scores(gameweek_id, db)

    return {
        "message": "Gameweek calculated",
        "players_calculated": total_calculated,
        "gameweek_id": gameweek_id
    }


async def update_matchup_scores(gameweek_id: str, db: AsyncSession):
    """
    Calculates each team's total score for a gameweek matchup.
    Applies captain 2x and vice captain 1.5x multipliers.
    Updates matchup scores and standings.
    """
    # Get all matchups for this gameweek
    matchups_result = await db.execute(
        select(Matchup).where(Matchup.gameweek_id == gameweek_id)
    )
    matchups = matchups_result.scalars().all()

    for matchup in matchups:
        home_score = await calculate_team_score(matchup.home_team_id, gameweek_id, db)
        away_score = await calculate_team_score(matchup.away_team_id, gameweek_id, db)

        matchup.home_score = home_score
        matchup.away_score = away_score

        # Determine result
        if home_score > away_score:
            matchup.result = "home"
            await update_standings(matchup.home_team_id, "win", db)
            await update_standings(matchup.away_team_id, "loss", db)
        elif away_score > home_score:
            matchup.result = "away"
            await update_standings(matchup.away_team_id, "win", db)
            await update_standings(matchup.home_team_id, "loss", db)
        else:
            matchup.result = "draw"
            await update_standings(matchup.home_team_id, "draw", db)
            await update_standings(matchup.away_team_id, "draw", db)

    await db.commit()


async def calculate_team_score(team_id: str, gameweek_id: str, db: AsyncSession) -> float:
    """
    Calculates a team's total fantasy score for a gameweek.
    Uses their starting 11 selection with captain/VC multipliers.
    """
    # Get starting 11 selections for this gameweek
    selections_result = await db.execute(
        select(GameweekSelection).where(
            GameweekSelection.team_id == team_id,
            GameweekSelection.gameweek_id == gameweek_id
        )
    )
    selections = selections_result.scalars().all()

    if not selections:
        return 0.0

    total = 0.0
    for sel in selections:
        # Get player score for this gameweek
        score_result = await db.execute(
            select(PlayerMatchScore).where(
                PlayerMatchScore.player_id == sel.player_id,
                PlayerMatchScore.gameweek_id == gameweek_id
            )
        )
        score = score_result.scalar_one_or_none()
        if not score:
            continue

        player_points = float(score.total_points)

        # Apply captain/VC multiplier
        if sel.is_captain:
            player_points *= 2
        elif sel.is_vice_captain:
            player_points *= 1.5

        total += player_points

    return round(total, 1)


async def update_standings(team_id: str, result: str, db: AsyncSession):
    """
    Updates team standings points.
    Win = +3, Draw = +1, Loss = +0
    """
    team_result = await db.execute(
        select(Team).where(Team.id == team_id)
    )
    team = team_result.scalar_one_or_none()
    if not team:
        return

    if result == "win":
        team.standings_points = float(team.standings_points or 0) + 3
    elif result == "draw":
        team.standings_points = float(team.standings_points or 0) + 1


@router.get("/gameweek/{gameweek_id}/scores")
async def get_gameweek_scores(gameweek_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns all player scores for a gameweek.
    """
    result = await db.execute(
        select(PlayerMatchScore).where(
            PlayerMatchScore.gameweek_id == gameweek_id
        )
    )
    scores = result.scalars().all()

    return [
        {
            "player_id": str(s.player_id),
            "base_points": float(s.base_points),
            "bonus_points": float(s.bonus_points),
            "total_points": float(s.total_points),
            "stats": s.stats,
            "calculated_at": s.calculated_at.isoformat() if s.calculated_at else None,
        }
        for s in scores
    ]


@router.get("/matchup/{matchup_id}")
async def get_matchup(matchup_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns H2H matchup with player-by-player breakdown.
    """
    result = await db.execute(
        select(Matchup).where(Matchup.id == matchup_id)
    )
    matchup = result.scalar_one_or_none()
    if not matchup:
        raise HTTPException(status_code=404, detail="Matchup not found")

    home_players = await get_team_gameweek_breakdown(
        matchup.home_team_id, str(matchup.gameweek_id), db
    )
    away_players = await get_team_gameweek_breakdown(
        matchup.away_team_id, str(matchup.gameweek_id), db
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


async def get_team_gameweek_breakdown(
    team_id: str, gameweek_id: str, db: AsyncSession
) -> list[dict]:
    """
    Returns player-by-player score breakdown for a team in a gameweek.
    """
    selections_result = await db.execute(
        select(GameweekSelection).where(
            GameweekSelection.team_id == team_id,
            GameweekSelection.gameweek_id == gameweek_id
        )
    )
    selections = selections_result.scalars().all()

    breakdown = []
    for sel in selections:
        player_result = await db.execute(
            select(Player).where(Player.id == sel.player_id)
        )
        player = player_result.scalar_one_or_none()

        score_result = await db.execute(
            select(PlayerMatchScore).where(
                PlayerMatchScore.player_id == sel.player_id,
                PlayerMatchScore.gameweek_id == gameweek_id
            )
        )
        score = score_result.scalar_one_or_none()

        base_pts = float(score.total_points) if score else 0.0
        multiplier = 2.0 if sel.is_captain else 1.5 if sel.is_vice_captain else 1.0
        final_pts = round(base_pts * multiplier, 1)

        breakdown.append({
            "player_id": str(sel.player_id),
            "player_name": player.name if player else "Unknown",
            "position": player.position if player else "?",
            "club": player.club if player else "?",
            "is_captain": sel.is_captain,
            "is_vice_captain": sel.is_vice_captain,
            "base_points": base_pts,
            "multiplier": multiplier,
            "final_points": final_pts,
            "stats_breakdown": score.stats if score else {},
        })

    return breakdown
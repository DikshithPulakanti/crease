"""
Draft State Machine
-------------------
All draft state lives in Redis so every connected user
sees the same state in real time.

Redis keys used:
  draft:{league_id}:state      → overall draft status
  draft:{league_id}:order      → list of team IDs in draft order
  draft:{league_id}:current    → index of current pick
  draft:{league_id}:picked     → set of player IDs already picked
  draft:{league_id}:timer      → unix timestamp when current turn expires
"""
import json
import time
import random
from sqlalchemy import select
from app.redis import redis_client

TURN_DURATION = 90
SQUAD_SIZE = 15

MIN_REQUIRED = {"GK": 1, "DEF": 4, "MID": 3, "ATT": 3}
MAX_PER_POSITION = {"GK": 6, "DEF": 8, "MID": 8, "ATT": 8}


def get_snake_order(team_ids: list[str], round_num: int) -> list[str]:
    if round_num % 2 == 1:
        return team_ids
    else:
        return list(reversed(team_ids))


async def initialize_draft(league_id: str, team_ids: list[str]):
    shuffled = team_ids.copy()
    random.shuffle(shuffled)

    await redis_client.set(
        f"draft:{league_id}:order",
        json.dumps(shuffled)
    )
    await redis_client.set(f"draft:{league_id}:current", 0)
    await redis_client.set(f"draft:{league_id}:status", "active")
    await redis_client.set(
        f"draft:{league_id}:timer",
        time.time() + TURN_DURATION
    )

    return shuffled


async def get_draft_state(league_id: str) -> dict:
    order_raw = await redis_client.get(f"draft:{league_id}:order")
    current_raw = await redis_client.get(f"draft:{league_id}:current")
    status = await redis_client.get(f"draft:{league_id}:status")
    timer_raw = await redis_client.get(f"draft:{league_id}:timer")
    picked_raw = await redis_client.smembers(f"draft:{league_id}:picked")

    if not order_raw:
        return {"status": "not_started"}

    order = json.loads(order_raw)
    current_pick_index = int(current_raw or 0)
    total_picks = SQUAD_SIZE * len(order)

    round_num = (current_pick_index // len(order)) + 1
    position_in_round = current_pick_index % len(order)

    snake_order = get_snake_order(order, round_num)
    current_team_id = snake_order[position_in_round]

    timer_expires = float(timer_raw or 0)
    seconds_left = max(0, timer_expires - time.time())

    return {
        "status": status,
        "order": order,
        "current_pick_index": current_pick_index,
        "total_picks": total_picks,
        "round_num": round_num,
        "current_team_id": current_team_id,
        "seconds_left": round(seconds_left, 1),
        "picked_player_ids": list(picked_raw),
        "is_complete": current_pick_index >= total_picks,
    }


async def make_pick(
    league_id: str,
    team_id: str,
    player_id: str,
    db
) -> dict:
    from app.models.squad import SquadPlayer, DraftPick
    from app.models.player import Player

    state = await get_draft_state(league_id)

    # Validate it's this team's turn
    if state["current_team_id"] != team_id:
        raise ValueError("It's not your turn")

    # Validate player hasn't been picked already
    already_picked = await redis_client.sismember(
        f"draft:{league_id}:picked", player_id
    )
    if already_picked:
        raise ValueError("Player already picked")

    # Validate player exists in DB
    result = await db.execute(
        select(Player).where(Player.id == player_id)
    )
    player = result.scalar_one_or_none()
    if not player:
        raise ValueError("Player not found")

    # --- Position Validation ---
    # Get current squad for this team
    squad_result = await db.execute(
        select(SquadPlayer).where(SquadPlayer.team_id == team_id)
    )
    current_squad = squad_result.scalars().all()
    squad_size = len(current_squad)
    picks_remaining = SQUAD_SIZE - squad_size - 1  # after this pick

    # Count current positions
    position_counts = {"GK": 0, "DEF": 0, "MID": 0, "ATT": 0}
    if current_squad:
        player_ids = [sp.player_id for sp in current_squad]
        players_result = await db.execute(
            select(Player).where(Player.id.in_(player_ids))
        )
        for p in players_result.scalars().all():
            position_counts[p.position] = position_counts.get(p.position, 0) + 1

    # Check max per position
    current_pos_count = position_counts.get(player.position, 0)
    if current_pos_count >= MAX_PER_POSITION[player.position]:
        raise ValueError(
            "Too many " + player.position + " players. Max is " +
            str(MAX_PER_POSITION[player.position])
        )

    # Check we can still meet minimum requirements
    # Simulate adding this player
    simulated_counts = dict(position_counts)
    simulated_counts[player.position] = simulated_counts.get(player.position, 0) + 1

    total_still_needed = sum(
        max(0, MIN_REQUIRED[pos] - simulated_counts.get(pos, 0))
        for pos in MIN_REQUIRED
    )
    if total_still_needed > picks_remaining:
        raise ValueError(
            "Cannot pick " + player.position + " — you still need " +
            ", ".join(
                str(max(0, MIN_REQUIRED[pos] - simulated_counts.get(pos, 0))) + " " + pos
                for pos in MIN_REQUIRED
                if simulated_counts.get(pos, 0) < MIN_REQUIRED[pos]
            ) + " to meet minimum squad requirements"
        )

    # Mark player as picked in Redis
    await redis_client.sadd(f"draft:{league_id}:picked", player_id)

    # Save pick to PostgreSQL
    pick_number = state["current_pick_index"] + 1
    draft_pick = DraftPick(
        league_id=league_id,
        team_id=team_id,
        player_id=player_id,
        round=state["round_num"],
        pick_number=pick_number,
    )
    db.add(draft_pick)

    # Add player to team's squad
    squad_player = SquadPlayer(
        team_id=team_id,
        player_id=player_id,
        acquired_via="draft"
    )
    db.add(squad_player)
    await db.commit()

    # Advance the draft
    new_index = state["current_pick_index"] + 1
    await redis_client.set(f"draft:{league_id}:current", new_index)

    # Check if draft is complete
    total_picks = state["total_picks"]
    if new_index >= total_picks:
        await redis_client.set(f"draft:{league_id}:status", "complete")
        return {"status": "complete", "player_id": player_id}

    # Reset timer for next pick
    await redis_client.set(
        f"draft:{league_id}:timer",
        time.time() + TURN_DURATION
    )

    return {
        "status": "pick_made",
        "player_id": player_id,
        "team_id": team_id,
        "pick_number": pick_number,
        "round": state["round_num"],
    }


async def auto_pick(league_id: str, db) -> dict:
    from app.models.player import Player
    from app.models.squad import SquadPlayer

    state = await get_draft_state(league_id)
    team_id = state["current_team_id"]

    picked_ids = await redis_client.smembers(f"draft:{league_id}:picked")

    # Get current squad positions for this team
    squad_result = await db.execute(
        select(SquadPlayer).where(SquadPlayer.team_id == team_id)
    )
    current_squad = squad_result.scalars().all()
    squad_size = len(current_squad)
    picks_remaining = SQUAD_SIZE - squad_size - 1

    position_counts = {"GK": 0, "DEF": 0, "MID": 0, "ATT": 0}
    if current_squad:
        player_ids = [sp.player_id for sp in current_squad]
        players_result = await db.execute(
            select(Player).where(Player.id.in_(player_ids))
        )
        for p in players_result.scalars().all():
            position_counts[p.position] = position_counts.get(p.position, 0) + 1

    # Determine if we need a specific position
    total_still_needed = sum(
        max(0, MIN_REQUIRED[pos] - position_counts.get(pos, 0))
        for pos in MIN_REQUIRED
    )

    # If we must fill a specific position, prioritize it
    priority_position = None
    if total_still_needed >= picks_remaining + 1:
        for pos in MIN_REQUIRED:
            if position_counts.get(pos, 0) < MIN_REQUIRED[pos]:
                priority_position = pos
                break

    # Find best available player
    query = select(Player).where(
        Player.id.notin_(picked_ids) if picked_ids else True
    )
    if priority_position:
        query = query.where(Player.position == priority_position)

    result = await db.execute(query.limit(1))
    player = result.scalar_one_or_none()

    if not player:
        raise ValueError("No players available for auto-pick")

    return await make_pick(
        league_id=league_id,
        team_id=team_id,
        player_id=str(player.id),
        db=db
    )
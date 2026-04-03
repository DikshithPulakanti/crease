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
  draft:{league_id}:squads     → hash of team_id → list of player IDs
  draft:{league_id}:timer      → unix timestamp when current turn expires
"""
import json
import time
import random
from app.redis import redis_client

TURN_DURATION = 90
SQUAD_SIZE = 15

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
    from sqlalchemy import select

    state = await get_draft_state(league_id)

    if state["current_team_id"] != team_id:
        raise ValueError("It's not your turn")

    already_picked = await redis_client.sismember(
        f"draft:{league_id}:picked", player_id
    )
    if already_picked:
        raise ValueError("Player already picked")

    result = await db.execute(
        select(Player).where(Player.id == player_id)
    )
    player = result.scalar_one_or_none()
    if not player:
        raise ValueError("Player not found")

    await redis_client.sadd(f"draft:{league_id}:picked", player_id)

    pick_number = state["current_pick_index"] + 1
    draft_pick = DraftPick(
        league_id=league_id,
        team_id=team_id,
        player_id=player_id,
        round=state["round_num"],
        pick_number=pick_number,
    )
    db.add(draft_pick)

    squad_player = SquadPlayer(
        team_id=team_id,
        player_id=player_id,
        acquired_via="draft"
    )
    db.add(squad_player)
    await db.commit()

    new_index = state["current_pick_index"] + 1
    await redis_client.set(f"draft:{league_id}:current", new_index)

    total_picks = state["total_picks"]
    if new_index >= total_picks:
        await redis_client.set(f"draft:{league_id}:status", "complete")
        return {"status": "complete", "player_id": player_id}

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
    from sqlalchemy import select

    state = await get_draft_state(league_id)
    team_id = state["current_team_id"]

    picked_ids = await redis_client.smembers(f"draft:{league_id}:picked")

    result = await db.execute(
        select(Player).where(
            Player.id.notin_(picked_ids) if picked_ids else True
        ).limit(1)
    )
    player = result.scalar_one_or_none()

    if not player:
        raise ValueError("No players available for auto-pick")

    return await make_pick(
        league_id=league_id,
        team_id=team_id,
        player_id=str(player.id),
        db=db
    )
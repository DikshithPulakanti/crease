import asyncio
import httpx
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app.models.player import Player
from app.config import settings

CL_QF_TEAMS = {
    42:  "Arsenal",
    40:  "Liverpool",
    529: "Barcelona",
    541: "Real Madrid",
    157: "Bayern München",
    530: "Atletico Madrid",
    85:  "Paris Saint-Germain",
    228: "Sporting CP",
}

POSITION_MAP = {
    "Goalkeeper": "GK",
    "Defender": "DEF",
    "Midfielder": "MID",
    "Attacker": "ATT",
    "Forward": "ATT",
}

async def fetch_squad(client: httpx.AsyncClient, team_id: int) -> list[dict]:
    print(f"  Fetching squad for team ID {team_id}...")

    response = await client.get(
        "https://v3.football.api-sports.io/players/squads",
        params={"team": team_id},
        headers={
            "x-rapidapi-key": settings.API_FOOTBALL_KEY,
            "x-rapidapi-host": settings.API_FOOTBALL_HOST,
        },
    )

    data = response.json()

    if not data.get("response"):
        print(f"  ⚠️  No data returned for team {team_id}")
        return []

    return data["response"][0]["players"]

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with httpx.AsyncClient(timeout=30.0) as client:
        async with AsyncSessionLocal() as db:
            total_inserted = 0
            total_skipped = 0

            for team_id, club_name in CL_QF_TEAMS.items():
                print(f"\n📋 {club_name}")
                players_data = await fetch_squad(client, team_id)

                for p in players_data:
                    api_id = p["id"]
                    name = p["name"]
                    photo = p.get("photo")

                    api_position = p.get("position", "")
                    position = POSITION_MAP.get(api_position)

                    if not position:
                        print(f"    ⚠️  Skipping {name} — unknown position: {api_position}")
                        continue

                    existing = await db.execute(
                        select(Player).where(Player.api_football_id == api_id)
                    )
                    if existing.scalar_one_or_none():
                        total_skipped += 1
                        continue

                    player = Player(
                        api_football_id=api_id,
                        name=name,
                        position=position,
                        club=club_name,
                        photo_url=photo,
                    )
                    db.add(player)
                    total_inserted += 1
                    print(f"    ✅  {name} ({position})")

                await db.commit()
                await asyncio.sleep(7)

    print(f"\n🎉 Done! Inserted: {total_inserted} | Skipped: {total_skipped}")

if __name__ == "__main__":
    asyncio.run(seed())
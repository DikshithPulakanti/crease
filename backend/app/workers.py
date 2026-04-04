"""
Background Workers
------------------
Runs periodic tasks:
1. Gameweek lock — locks squads 1.5 hours before kickoff
2. Trade expiry — expires pending trades after 24 hours
3. Gameweek status updates

These run as async tasks started when the FastAPI app starts.
"""
import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select, update
from app.database import AsyncSessionLocal
from app.models.gameweek import Gameweek
from app.models.trade import Trade


async def gameweek_lock_worker():
    """
    Checks every minute if any gameweek should be locked.
    A gameweek locks 1.5 hours (90 minutes) before kickoff.
    """
    print("🔒 Gameweek lock worker started")
    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.utcnow()

                # Find gameweeks that should be locked
                result = await db.execute(
                    select(Gameweek).where(
                        Gameweek.status == "upcoming",
                        Gameweek.locks_at <= now
                    )
                )
                gameweeks_to_lock = result.scalars().all()

                for gw in gameweeks_to_lock:
                    gw.status = "locked"
                    print(f"🔒 Locked gameweek: {gw.label} (league {gw.league_id})")

                if gameweeks_to_lock:
                    await db.commit()

        except Exception as e:
            print(f"❌ Gameweek lock worker error: {e}")

        # Check every 60 seconds
        await asyncio.sleep(60)


async def trade_expiry_worker():
    """
    Checks every 5 minutes if any pending trades have expired.
    Trades expire 24 hours after being proposed.
    """
    print("⏰ Trade expiry worker started")
    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.utcnow()

                # Find expired pending trades
                result = await db.execute(
                    select(Trade).where(
                        Trade.status == "pending",
                        Trade.expires_at <= now
                    )
                )
                expired_trades = result.scalars().all()

                for trade in expired_trades:
                    trade.status = "expired"
                    print(f"⏰ Expired trade: {trade.id}")

                if expired_trades:
                    await db.commit()

        except Exception as e:
            print(f"❌ Trade expiry worker error: {e}")

        # Check every 5 minutes
        await asyncio.sleep(300)


async def gameweek_status_worker():
    """
    Checks every minute if any gameweek status should change.
    - locked → scoring: when match finishes (ends_at passed)
    - scoring → complete: manual trigger via API
    """
    print("📅 Gameweek status worker started")
    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.utcnow()

                # Find locked gameweeks where match has ended
                result = await db.execute(
                    select(Gameweek).where(
                        Gameweek.status == "locked",
                        Gameweek.ends_at <= now
                    )
                )
                gameweeks_to_score = result.scalars().all()

                for gw in gameweeks_to_score:
                    gw.status = "scoring"
                    print(f"📊 Gameweek ready for scoring: {gw.label}")

                if gameweeks_to_score:
                    await db.commit()

        except Exception as e:
            print(f"❌ Gameweek status worker error: {e}")

        await asyncio.sleep(60)


async def start_workers():
    """
    Starts all background workers concurrently.
    Called from app startup.
    """
    asyncio.create_task(gameweek_lock_worker())
    asyncio.create_task(trade_expiry_worker())
    asyncio.create_task(gameweek_status_worker())
    print("✅ All background workers started")
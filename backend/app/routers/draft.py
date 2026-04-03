"""
Draft WebSocket Router
----------------------
Handles real-time communication during the live draft.

WebSocket events the server SENDS to clients:
  - draft_state    → full current state (sent on connect + after every pick)
  - pick_made      → someone just picked a player
  - timer_update   → seconds remaining on current turn
  - draft_complete → draft is over

WebSocket events the server RECEIVES from clients:
  - make_pick      → a team wants to pick a player
"""
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.draft import get_draft_state, make_pick, initialize_draft, auto_pick, TURN_DURATION
import time

router = APIRouter(prefix="/ws", tags=["draft"])

# Connection manager — tracks all active WebSocket connections per league
class DraftConnectionManager:
    def __init__(self):
        # league_id → list of connected WebSockets
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, league_id: str, websocket: WebSocket):
        await websocket.accept()
        if league_id not in self.connections:
            self.connections[league_id] = []
        self.connections[league_id].append(websocket)

    def disconnect(self, league_id: str, websocket: WebSocket):
        if league_id in self.connections:
            self.connections[league_id].remove(websocket)

    async def broadcast(self, league_id: str, message: dict):
        """Send a message to every user in the draft room."""
        if league_id not in self.connections:
            return
        dead = []
        for ws in self.connections[league_id]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        # Clean up dead connections
        for ws in dead:
            self.connections[league_id].remove(ws)


manager = DraftConnectionManager()


@router.websocket("/draft/{league_id}/{team_id}")
async def draft_websocket(
    league_id: str,
    team_id: str,
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db)
):
    """
    Main WebSocket endpoint for the draft room.
    Each user connects with their league_id and team_id.
    """
    await manager.connect(league_id, websocket)

    try:
        # Send current draft state immediately on connect
        state = await get_draft_state(league_id)
        await websocket.send_json({
            "event": "draft_state",
            "data": state
        })

        # Listen for messages from this client
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            event = message.get("event")

            if event == "make_pick":
                player_id = message.get("player_id")

                try:
                    result = await make_pick(
                        league_id=league_id,
                        team_id=team_id,
                        player_id=player_id,
                        db=db
                    )

                    # Get updated state after pick
                    new_state = await get_draft_state(league_id)

                    # Broadcast the pick to everyone in the room
                    await manager.broadcast(league_id, {
                        "event": "pick_made",
                        "data": {
                            **result,
                            "draft_state": new_state
                        }
                    })

                    # If draft is complete, broadcast that too
                    if result.get("status") == "complete":
                        await manager.broadcast(league_id, {
                            "event": "draft_complete",
                            "data": {"message": "Draft is complete!"}
                        })

                except ValueError as e:
                    # Send error only to the user who made the invalid pick
                    await websocket.send_json({
                        "event": "error",
                        "data": {"message": str(e)}
                    })

    except WebSocketDisconnect:
        manager.disconnect(league_id, websocket)


@router.websocket("/draft/{league_id}/{team_id}/timer")
async def timer_websocket(
    league_id: str,
    team_id: str,
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db)
):
    """
    Separate WebSocket just for the timer.
    Broadcasts seconds remaining every second.
    Also triggers auto-pick when timer hits 0.
    """
    await websocket.accept()

    try:
        while True:
            state = await get_draft_state(league_id)

            if state.get("status") == "complete":
                await websocket.send_json({
                    "event": "draft_complete",
                    "data": {}
                })
                break

            seconds_left = state.get("seconds_left", 0)

            # Broadcast timer to everyone
            await manager.broadcast(league_id, {
                "event": "timer_update",
                "data": {
                    "seconds_left": seconds_left,
                    "current_team_id": state.get("current_team_id")
                }
            })

            # Timer ran out — trigger auto-pick
            if seconds_left <= 0:
                try:
                    result = await auto_pick(league_id=league_id, db=db)
                    new_state = await get_draft_state(league_id)
                    await manager.broadcast(league_id, {
                        "event": "pick_made",
                        "data": {
                            **result,
                            "auto_picked": True,
                            "draft_state": new_state
                        }
                    })
                except Exception as e:
                    print(f"Auto-pick error: {e}")

            await asyncio.sleep(1)

    except WebSocketDisconnect:
        pass
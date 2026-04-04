from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.routers import draft, leagues
from app.routers import draft, leagues, players

app = FastAPI(
    title="Crease API",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
)

# CORS allows your Next.js frontend (running on localhost:3000)
# to talk to this FastAPI backend (running on localhost:8000).
# Without this, browsers will block the requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://yourdomain.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(leagues.router)
app.include_router(draft.router)
app.include_router(players.router)

# Runs once when the server starts.
# Creates any tables that don't exist yet.
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Simple endpoint to confirm the server is running.
@app.get("/healthz")
async def health():
    return {"status": "ok"}
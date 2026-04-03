from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# --- Async engine ---
# This is the connection to your PostgreSQL database.
# "async" means FastAPI can handle other requests while waiting for DB queries.
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",  # prints SQL queries in dev
    pool_size=10,        # max 10 open connections at once
    max_overflow=20,     # allow 20 extra connections in bursts
)

# --- Session factory ---
# A "session" is one conversation with the database.
# async_sessionmaker creates new sessions on demand.
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # keeps objects usable after committing
)

# --- Base class ---
# All your SQLAlchemy models will inherit from this.
# It's what tells SQLAlchemy "this class = a database table".
class Base(DeclarativeBase):
    pass

# --- Dependency ---
# FastAPI routes use this to get a database session.
# The "yield" means: open a session, give it to the route,
# then close it automatically when the route finishes.
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # --- Database ---
    # DATABASE_URL uses asyncpg — for async FastAPI route handlers
    # SYNC_DATABASE_URL uses psycopg2 — for Alembic migrations (which are sync)
    DATABASE_URL: str
    SYNC_DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"

    # --- Clerk (Auth) ---
    CLERK_SECRET_KEY: str
    CLERK_PUBLISHABLE_KEY: str

    # --- API-Football ---
    API_FOOTBALL_KEY: str
    API_FOOTBALL_HOST: str

    # --- App ---
    SECRET_KEY: str
    ENVIRONMENT: str = "development"

    class Config:
        # Tells pydantic to read from .env file automatically
        env_file = ".env"

# Create one global instance — import this everywhere you need config
settings = Settings()
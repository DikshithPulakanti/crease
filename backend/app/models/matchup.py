import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Matchup(Base):
    __tablename__ = "matchups"
    __table_args__ = (
        UniqueConstraint("gameweek_id", "home_team_id", name="uq_home_matchup"),
        UniqueConstraint("gameweek_id", "away_team_id", name="uq_away_matchup"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    league_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leagues.id"), nullable=False)
    gameweek_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gameweeks.id"), nullable=False)
    home_team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    away_team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    home_score: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    away_score: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    result: Mapped[str | None] = mapped_column(String, nullable=True)


class PlayerMatchScore(Base):
    __tablename__ = "player_match_scores"
    __table_args__ = (
        UniqueConstraint("player_id", "gameweek_id", name="uq_player_gameweek_score"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    player_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("players.id"), nullable=False)
    gameweek_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gameweeks.id"), nullable=False)
    base_points: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    bonus_points: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    total_points: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    stats: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sub_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    calculated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
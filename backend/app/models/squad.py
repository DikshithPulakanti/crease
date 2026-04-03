import uuid
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class SquadPlayer(Base):
    __tablename__ = "squad_players"
    __table_args__ = (
        UniqueConstraint("team_id", "player_id", name="uq_player_per_team"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    player_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("players.id"), nullable=False)
    acquired_via: Mapped[str] = mapped_column(String, default="draft")
    acquired_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DraftPick(Base):
    __tablename__ = "draft_picks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    league_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leagues.id"), nullable=False)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    player_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("players.id"), nullable=False)
    round: Mapped[int] = mapped_column(Integer, nullable=False)
    pick_number: Mapped[int] = mapped_column(Integer, nullable=False)
    picked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FreeAgentClaim(Base):
    __tablename__ = "free_agent_claims"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    league_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leagues.id"), nullable=False)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    player_in_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("players.id"), nullable=False)
    player_out_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("players.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    league_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leagues.id"), nullable=False)
    proposer_team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    receiver_team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), nullable=False)
    proposer_player_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("players.id"), nullable=False)
    receiver_player_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("players.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending")
    parent_trade_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("trades.id"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
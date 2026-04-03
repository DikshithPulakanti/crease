import uuid
from sqlalchemy import String, Integer, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("league_id", "name", name="uq_team_name_per_league"),
        UniqueConstraint("league_id", "user_id", name="uq_one_team_per_user_per_league"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    league_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leagues.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    draft_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    standings_points: Mapped[float] = mapped_column(Numeric(5, 1), default=0)
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class League(Base):
    __tablename__ = "leagues"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    invite_code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    commissioner_id: Mapped[str] = mapped_column(String, nullable=False)
    max_teams: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="setup")
    draft_scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
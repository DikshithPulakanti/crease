import uuid
from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    clerk_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
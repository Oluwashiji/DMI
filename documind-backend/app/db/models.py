import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    # Stored as a 36-char string (not the Postgres-only UUID type) so the
    # same model works against both Neon Postgres and the local SQLite
    # fallback used for dev/tests.
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    extractions: Mapped[list["Extraction"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Extraction(Base):
    __tablename__ = "extractions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    # pending -> processing -> complete | failed
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    extracted_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="extractions")

    # The original upload lives in its own table so listing history never drags file bytes along.
    file: Mapped["ExtractionFile | None"] = relationship(
        back_populates="extraction", uselist=False, cascade="all, delete-orphan", lazy="joined"
    )

    @property
    def has_file(self) -> bool:
        return self.file is not None

    @property
    def file_size(self) -> int | None:
        return self.file.size_bytes if self.file is not None else None

    @property
    def content_type(self) -> str | None:
        return self.file.content_type if self.file is not None else None


class ExtractionFile(Base):
    """The original uploaded PDF/image, stored in Postgres (Render's disk is wiped on every deploy)."""

    __tablename__ = "extraction_files"

    extraction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("extractions.id", ondelete="CASCADE"), primary_key=True
    )
    # Denormalised from the extraction so per-user storage can be summed without a join.
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    # deferred=True: the bytes are only fetched when explicitly accessed.
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, deferred=True)

    extraction: Mapped["Extraction"] = relationship(back_populates="file")
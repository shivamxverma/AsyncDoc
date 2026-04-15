import uuid
import enum
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer,
    ForeignKey, Enum, BigInteger, func, text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


# ---------------- ENUMS ---------------- #

class UploadStatus(str, enum.Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    FAILED = "failed"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


# ---------------- USER ---------------- #

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    username = Column(String, unique=True, nullable=False)
    display_name = Column(String)
    email = Column(String, unique=True, nullable=False)

    is_email_verified = Column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False
    )

    verification_token = Column(String)
    password = Column(String, nullable=False)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    tasks = relationship("Task", back_populates="user")


# ---------------- TASK ---------------- #

class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    total_files = Column(Integer, default=0)
    processed_files = Column(Integer, default=0)
    failed_files = Column(Integer, default=0)

    status = Column(
        Enum(TaskStatus, name="task_status"),
        default=TaskStatus.PENDING,
        nullable=False
    )

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    completed_at = Column(DateTime, nullable=True)  # only set when done

    # Relationships
    user = relationship("User", back_populates="tasks")
    pdfs = relationship("PDF", back_populates="task")


# ---------------- PDF ---------------- #

class PDF(Base):
    __tablename__ = "pdfs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id"),
        nullable=False
    )

    file_name = Column(String, nullable=False)
    file_size = Column(BigInteger)

    s3_key = Column(String, nullable=False)
    s3_url = Column(String)

    status = Column(
        Enum(UploadStatus, name="upload_status"),
        default=UploadStatus.PENDING,
        nullable=False
    )

    retry_count = Column(Integer, default=0)
    error_message = Column(String)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    completed_at = Column(DateTime, nullable=True)

    # Relationships
    task = relationship("Task", back_populates="pdfs")
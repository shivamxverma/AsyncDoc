from pydantic import BaseModel, Field  # pyright: ignore[reportMissingImports]
from typing import List
from uuid import UUID

class FileMeta(BaseModel):
    filename: str
    content_type: str

class CreateTask(BaseModel):
    user_id: str
    name: str
    files: List[FileMeta]

class UpdatePDFstatus(BaseModel):
    task_id: UUID
    document_ids : List[UUID] = Field(..., min_length=1)
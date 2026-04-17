from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID

class FileMeta(BaseModel):
    filename: str
    content_type: str

class CreateTask(BaseModel):
    name: str
    files: List[FileMeta]

class UpdatePDFstatus(BaseModel):
    task_id: UUID
    document_ids: List[UUID] = Field(..., min_length=1)

class DocumentResultUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    summary: Optional[str] = None
    extracted_keywords: Optional[List[str]] = None
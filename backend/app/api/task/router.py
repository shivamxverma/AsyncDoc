from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from app.db.session import get_db
from app.models import Task, PDF, DocumentStatus, TaskStatus
from app.api.task.schemas import CreateTask , FileMeta ,UpdatePDFstatus 
from typing import List
from app.db.base import Base
from app.config import s3_client
from app.core.config import settings
from botocore.exceptions import ClientError

router = APIRouter()

def generate_presigned_url(s3_key: str) -> str:
    try:
        url = s3_client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": settings.aws_bucket_name,
                "Key": s3_key,
                "ContentType": "application/pdf",
            },
            ExpiresIn=3600,
        )
        return url

    except Exception as e:
        raise Exception(f"Failed to generate signed URL: {str(e)}")

@router.post("/upload/initiate")
def initiate_upload(
    data: CreateTask,
    db: Session = Depends(get_db)
):
    if not data.files:
        raise HTTPException(status_code=400, detail="No files provided")

    for file in data.files:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"{file.filename} is not a PDF")

        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail=f"{file.filename} has invalid content type")

        
    task_id = uuid.uuid4()
    user_id = uuid.uuid4()

    task = Task(
        id=task_id,
        name=data.name,
        user_id=user_id,
        total_files=len(data.files),
        processed_files=0,
        failed_files=0,
        status=TaskStatus.PENDING
    )

    db.add(task)

    document_response = []
    pdf_objects = []

    for file in data.files:
        document_id = uuid.uuid4()

        safe_filename = file.filename.replace(" ","_")
        s3_key = f"{task_id}/{document_id}/{safe_filename}"

        upload_url = generate_presigned_url(s3_key)

        pdf = PDF(
            id=document_id,
            task_id=task_id,
            file_name=safe_filename,
            s3_key=s3_key,
            status=DocumentStatus.PENDING_UPLOAD
        )

        pdf_objects.append(pdf)

        document_response.append({
            "document_id": str(document_id),
            "upload_url": upload_url,
            "s3_key": s3_key
        })
        
    try:
        db.add_all(pdf_objects)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to initiate upload")
    
    return {
        "task_id": str(task_id),
        "documents": document_response
    }

@router.post("/upload/complete")
def complete_upload(
    data: UpdatePDFstatus,
    db: Session = Depends(get_db)
):
    task = db.get(Task, data.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    pdfs = db.query(PDF).filter(
        PDF.id.in_(data.document_ids),
        PDF.task_id == data.task_id
    ).all()

    if len(pdfs) != len(data.document_ids):
        raise HTTPException(
            status_code=400,
            detail="Some documents not found or do not belong to the task"
        )

    valid_pdfs = []

    for pdf in pdfs:
        if pdf.status != DocumentStatus.PENDING_UPLOAD:
            continue

        try:
            s3_client.head_object(
                Bucket=settings.aws_bucket_name,
                Key=pdf.s3_key
            )

            pdf.status = DocumentStatus.UPLOADED
            valid_pdfs.append(pdf)

        except ClientError:
            pdf.status = DocumentStatus.FAILED
            pdf.error_message = "File not found in S3"

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update PDF status")

    for pdf in valid_pdfs:
        process_pdf.delay(str(pdf.id)) 

    task.status = TaskStatus.PROCESSING
    db.commit()

    return {
        "task_id": str(task.id),
        "processed_documents": [str(pdf.id) for pdf in valid_pdfs],
        "failed_documents": [
            str(pdf.id) for pdf in pdfs if pdf.status == DocumentStatus.FAILED
        ]
    }
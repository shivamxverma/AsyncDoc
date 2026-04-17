from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from app.db.session import get_session
from app.models import Task, PDF, DocumentStatus, TaskStatus
from app.api.task.schemas import CreateTask , FileMeta ,UpdatePDFstatus, DocumentResultUpdate 
from typing import List
from app.db.base import Base
from app.config.aws import get_s3_client
from app.core.config import settings
from botocore.exceptions import ClientError
from app.worker.tasks import process_pdf
from app.api.auth.service import get_current_user
from app.models import User

router = APIRouter()

def generate_presigned_url(s3_key: str) -> str:
    try:
        url = get_s3_client().generate_presigned_url(
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
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if not data.files:
        raise HTTPException(status_code=400, detail="No files provided")

    if len(data.files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 files allowed per upload session")

    for file in data.files:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"{file.filename} is not a PDF")

        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail=f"{file.filename} has invalid content type")

        
    task_id = uuid.uuid4()
    user_id = current_user.id

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
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    task = db.get(Task, data.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this task")

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
            get_s3_client().head_object(
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


@router.get("/{task_id}")
def get_task(
    task_id: uuid.UUID, 
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this task")

    pdfs = db.query(PDF).filter(PDF.task_id == task_id).all()
    
    return {
        "id": str(task.id),
        "name": task.name,
        "status": task.status,
        "total_files": task.total_files,
        "processed_files": task.processed_files,
        "failed_files": task.failed_files,
        "created_at": task.created_at,
        "documents": [
            {
                "id": str(pdf.id),
                "file_name": pdf.file_name,
                "status": pdf.status,
                "result": pdf.result,
                "is_finalized": pdf.is_finalized,
                "created_at": pdf.created_at
            }
            for pdf in pdfs
        ]
    }

@router.get("")
def list_tasks(
    search: str | None = None,
    status: TaskStatus | None = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Task).filter(Task.user_id == current_user.id)
    
    if search:
        query = query.filter(Task.name.ilike(f"%{search}%"))
        
    if status:
        query = query.filter(Task.status == status)
        
    tasks = query.order_by(Task.created_at.desc()).all()
    
    return [
        {
            "id": str(task.id),
            "name": task.name,
            "status": task.status,
            "total_files": task.total_files,
            "processed_files": task.processed_files,
            "failed_files": task.failed_files,
            "created_at": task.created_at,
        }
        for task in tasks
    ]

@router.put("/document/{document_id}/result")
def update_document_result(
    document_id: uuid.UUID, 
    data: DocumentResultUpdate, 
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    pdf = db.get(PDF, document_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="Document not found")
        
    task = db.get(Task, pdf.task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if pdf.is_finalized:
        raise HTTPException(status_code=400, detail="Document is finalized and cannot be edited")

    # Update result JSON
    current_result = pdf.result or {}
    if data.title is not None: current_result["title"] = data.title
    if data.category is not None: current_result["category"] = data.category
    if data.summary is not None: current_result["summary"] = data.summary
    if data.extracted_keywords is not None: current_result["extracted_keywords"] = data.extracted_keywords
    
    pdf.result = current_result
    db.commit()
    
    return {"message": "Document result updated successfully", "result": pdf.result}

@router.post("/document/{document_id}/finalize")
def finalize_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    pdf = db.get(PDF, document_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="Document not found")
        
    task = db.get(Task, pdf.task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    pdf.is_finalized = True
    db.commit()
    return {"message": "Document finalized"}

@router.post("/document/{document_id}/retry")
def retry_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    pdf = db.get(PDF, document_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="Document not found")
        
    task = db.get(Task, pdf.task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    pdf.status = DocumentStatus.PROCESSING
    pdf.retry_count += 1
    db.commit()
    
    process_pdf.delay(str(pdf.id))
    return {"message": "Retry initiated"}

@router.post("/{task_id}/retry")
def retry_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    task = db.get(Task, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    failed_pdfs = db.query(PDF).filter(
        PDF.task_id == task_id,
        PDF.status == DocumentStatus.FAILED
    ).all()

    for pdf in failed_pdfs:
        pdf.status = DocumentStatus.PROCESSING
        pdf.retry_count += 1
        db.commit()
        process_pdf.delay(str(pdf.id))
        
    task.status = TaskStatus.PROCESSING
    db.commit()

    return {"message": f"Retry initiated for {len(failed_pdfs)} documents"}

@router.get("/{task_id}/export/json")
def export_json(
    task_id: uuid.UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    task = db.get(Task, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    pdfs = db.query(PDF).filter(PDF.task_id == task_id).all()
    
    export_data = [
        {
            "file_name": pdf.file_name,
            "status": pdf.status,
            "result": pdf.result,
            "is_finalized": pdf.is_finalized
        }
        for pdf in pdfs
    ]
    
    from fastapi.responses import JSONResponse
    return JSONResponse(content=export_data, headers={"Content-Disposition": f"attachment; filename=task_{task_id}.json"})

@router.get("/{task_id}/export/csv")
def export_csv(
    task_id: uuid.UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    task = db.get(Task, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    pdfs = db.query(PDF).filter(PDF.task_id == task_id).all()
    
    import csv
    import io
    from fastapi.responses import StreamingResponse
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["File Name", "Status", "Title", "Category", "Summary", "Keywords", "Finalized"])
    
    for pdf in pdfs:
        res = pdf.result or {}
        writer.writerow([
            pdf.file_name,
            pdf.status,
            res.get("title", ""),
            res.get("category", ""),
            res.get("summary", ""),
            ", ".join(res.get("extracted_keywords", [])),
            pdf.is_finalized
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=task_{task_id}.csv"}
    )

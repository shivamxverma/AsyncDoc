from app.worker.celery_app import celery
from sqlmodel import Session
from app.db.engine import engine
from app.models import PDF, Task, DocumentStatus, TaskStatus
from app.utils.publisher import publish_progress
from app.config.aws import get_s3_client
from app.core.config import settings
from app.utils.extractor import extract_pdf_data
import time


@celery.task
def process_pdf(document_id: str):
    db = Session(engine)
    pdf = None

    try:
        pdf = db.get(PDF, document_id)
        if not pdf:
            return

        channel = f"task:{pdf.task_id}"

        pdf.status = DocumentStatus.PROCESSING
        db.commit()

        publish_progress(channel, {
            "job_id": str(pdf.task_id),
            "event": "document_received",
            "status": "processing"
        })


        obj = get_s3_client().get_object(
            Bucket=settings.aws_bucket_name,
            Key=pdf.s3_key
        )

        file_content = obj["Body"].read()

        publish_progress(channel, {
            "job_id": str(pdf.task_id),
            "event": "parsing_started",
            "status": "processing"
        })
        time.sleep(1) # Simulate work
        publish_progress(channel, {
            "job_id": str(pdf.task_id),
            "event": "parsing_completed",
            "status": "processing"
        })

        publish_progress(channel, {
            "job_id": str(pdf.task_id),
            "event": "extraction_started",
            "status": "processing"
        })

        extracted_data = extract_pdf_data(file_content, pdf.file_name)
        
        publish_progress(channel, {
            "job_id": str(pdf.task_id),
            "event": "extraction_completed",
            "status": "processing"
        })

        pdf.result = extracted_data  
        pdf.status = DocumentStatus.COMPLETED
        db.commit()

        completed_pdfs = db.query(PDF).filter(PDF.task_id == pdf.task_id, PDF.status == DocumentStatus.COMPLETED).count()
        failed_pdfs = db.query(PDF).filter(PDF.task_id == pdf.task_id, PDF.status == DocumentStatus.FAILED).count()
        
        task = db.get(Task, pdf.task_id)
        if task:
            task.processed_files = completed_pdfs
            task.failed_files = failed_pdfs
            if (completed_pdfs + failed_pdfs) >= task.total_files:
                task.status = TaskStatus.COMPLETED if failed_pdfs == 0 else TaskStatus.PARTIAL
                db.commit()

        publish_progress(channel, {
            "job_id": str(pdf.task_id),
            "event": "final_result_stored",
            "status": "completed",
            "result": extracted_data
        })

    except Exception as e:
        db.rollback()

        if pdf:
            pdf.status = DocumentStatus.FAILED
            pdf.error_message = str(e)
            db.commit()

        publish_progress(channel, {
            "job_id": str(pdf.task_id),
            "event": "job_failed",
            "status": "failed",
            "error": str(e)
        })

    finally:
        db.close()
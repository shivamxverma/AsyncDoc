# Storix ---> Async Document Processing Workflow System

A full-stack asynchronous document processing application built with FastAPI, Next.js, Celery, Redis, and PostgreSQL.

## Features

- **Document Upload**: Multi-file PDF upload with pre-signed S3 URLs.
- **Async Processing**: Background PDF parsing and extraction using Celery workers.
- **Real-time Progress**: Live status updates via WebSocket (backed by Redis Pub/Sub).
- **Interactive Dashboard**: Search, filter, and monitor all document processing jobs.
- **Content Review**: Edit extracted metadata, keywords, and summaries.
- **Data Export**: Export processed results in JSON and CSV formats.
- **Authentication**: Secure Google OAuth and JWT-based auth.

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS, Zustand, Lucide React.
- **Backend**: Python, FastAPI, SQLModel (ORM), Alembic (Migrations).
- **Task Queue**: Celery with Redis as the Broker.
- **Real-time**: Redis Pub/Sub + WebSockets.
- **Storage**: AWS S3 for document persistence.
- **Database**: PostgreSQL (Neon.tech).

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- Redis (running locally or via Docker)
- PostgreSQL database
- AWS S3 Bucket

### Backend Setup
1. Navigate to the `backend` directory.
2. Create a virtual environment: `python -m venv venv`.
3. Activate the venv: `source venv/bin/activate`.
4. Install dependencies: `pip install -r requirements.txt`.
5. Configure `.env` (use the provided template or existing `.env`).
6. Run migrations: `alembic upgrade head`.
7. Start the server: `python -m uvicorn app.main:app --reload`.
8. Start the worker: `celery -A app.worker.celery_app worker --loglevel=info`.

### Frontend Setup
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`.
3. Start the dev server: `npm run dev`.
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture Overview

1. **Initiation**: The user selects files. Frontend calls `/upload/initiate`, which records the task in DB and returns S3 presigned URLs.
2. **Upload**: Frontend uploads files directly to S3.
3. **Trigger**: Frontend calls `/upload/complete`, which triggers a Celery background task.
4. **Worker**: The Celery worker downloads the file from S3, parses text using `pypdf`, extracts metadata, and updates the database.
5. **Updates**: Throughout the process, the worker publishes events to Redis. A dedicated WebSocket endpoint in FastAPI listens to these events and streams them to the client.
6. **Review**: Once complete, the user reviews data, can edit fields, and finally "Finalizes" the record (making it read-only).

## Assumptions & Tradeoffs
- **WebSocket Broadcasting**: For this version, WebSocket updates are broadcasted to all connected clients. In a multi-tenant production environment, we would implement per-user channel filtering.
- **Single PDF per Row**: While the backend supports multi-file Tasks, the current UI treats each file as a primary "Job" row for better individual tracking.

## AI Tools Used
This project was developed with the assistance of **Antigravity** (Google DeepMind's AI coding assistant) for architecture design, API implementation, and UI development.

## Sample Files
You can find sample PDF files used for testing in the `/samples` directory (if provided).

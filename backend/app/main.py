from fastapi import FastAPI
# from contextlib import asynccontextmanager

# from app.api.routes import api_router
from app.core.config import settings
from app.core.middleware import setup_cors

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     print("Application started")

#     yield

#     print("Application shutting down")

app = FastAPI(
    title="My Backend API",
    version="1.0.0",
    # lifespan=lifespan
)

setup_cors(app)

# app.include_router(api_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
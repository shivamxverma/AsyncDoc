from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    secret_key: str | None = None
    port: int
    aws_access_key_id: str
    aws_bucket_name: str
    aws_region: str
    aws_secret_access_key: str

    class Config:
        env_file = ".env"

settings = Settings()
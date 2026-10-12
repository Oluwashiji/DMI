from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    All values are read from environment variables (or a local .env file).
    See .env.example for the full list and sane local defaults.
    """

    # --- Database (Neon Postgres in production) ---
    # e.g. postgresql+psycopg2://user:password@ep-xxxx.neon.tech/documind?sslmode=require
    database_url: str = "sqlite:///./documind.db"

    # --- Auth / JWT ---
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # --- CORS ---
    # Comma-separated list of allowed origins, e.g. "http://localhost:5173,https://app.documind.io"
    cors_origins: str = "http://localhost:5173"

    # --- Groq / extraction ---
    groq_api_key: str = ""
    # Groq retires models regularly (llama-3.3-70b-versatile was shut down on 2026-08-16).
    # If extraction fails with "AI model unavailable", pick a current model from
    # https://console.groq.com/docs/models and set GROQ_MODEL - no code change needed.
    groq_model: str = "openai/gpt-oss-120b"
    # Reasoning models (gpt-oss) spend part of this budget "thinking" before they answer.
    groq_max_tokens: int = 4000
    # Cap on characters of document text sent to the LLM (keeps token usage and cost down).
    max_llm_chars: int = 10000

    # --- Upload limits / OCR ---
    max_upload_mb: int = 25
    max_pdf_pages: int = 10
    ocr_dpi: int = 200
    # Full path to the tesseract binary. Only needed on Windows/macOS when it isn't on PATH,
    # e.g. C:\Program Files\Tesseract-OCR\tesseract.exe
    tesseract_cmd: str = ""

    # --- File storage ---
    upload_dir: str = "./uploads"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
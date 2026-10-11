from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth
from app.core.config import settings
from app.db.base import Base, engine

# Dev convenience: creates any missing tables on startup. Once this project
# has a live Neon database, prefer running the Alembic migrations in
# /alembic instead (see alembic/README in this folder) - `create_all` never
# alters existing tables, so it won't pick up future schema changes.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="DocuMind API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}

# DocuMind Backend

FastAPI backend for DocuMind. This phase covers auth (signup / login / me)
and the database schema (`users`, `extractions`). Extraction, exports, and
history come next.

## Local setup (no Docker)

```bash
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env           # defaults to a local SQLite file - no DB setup needed
uvicorn app.main:app --reload
```

API is now at http://localhost:8000, interactive docs at
http://localhost:8000/docs.

On startup, `app/main.py` calls `Base.metadata.create_all()`, which creates
any missing tables automatically - fine for local dev. In production, use
Alembic instead (see below), since `create_all` never modifies existing
tables when the schema changes later.

## Endpoints in this phase

| Method | Path          | Auth | Description                          |
|--------|---------------|------|---------------------------------------|
| POST   | /auth/signup  | no   | Create an account, returns JWT + user |
| POST   | /auth/login   | no   | Returns JWT + user                    |
| GET    | /auth/me      | yes  | Returns the current user              |
| GET    | /health       | no   | Liveness check                        |

Send the JWT as `Authorization: Bearer <token>`.

## Switching to Neon Postgres

Set `DATABASE_URL` in `.env` to your Neon connection string:

```
DATABASE_URL=postgresql+psycopg2://user:password@ep-xxxx-pooler.region.aws.neon.tech/documind?sslmode=require
```

Then run the migration instead of relying on `create_all`:

```bash
alembic upgrade head
```

Future schema changes: `alembic revision --autogenerate -m "message"` then
`alembic upgrade head`.

## Docker

```bash
docker compose up --build
```

Uses the same `.env` file; mounts `./uploads` for the file-storage phase.

## Tech notes

- Passwords hashed with bcrypt directly (not passlib, to avoid its bcrypt
  version-compatibility issues).
- JWTs signed with HS256 via PyJWT, 7-day expiry by default
  (`JWT_EXPIRE_MINUTES`).
- User/Extraction IDs are UUID4 strings stored as `String(36)`, not the
  Postgres-only UUID column type, so the same models work against both
  Neon and the local SQLite fallback.
- CORS origins come from `CORS_ORIGINS` (comma-separated) - update this to
  include your deployed frontend URL.

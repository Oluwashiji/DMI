import json
import logging
import os
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.base import SessionLocal, get_db
from app.db.models import Extraction, User
from app.schemas.extraction import ExtractedInvoice, ExtractionOut
from app.services import exporters, llm, ocr

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["extraction"])

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
CHUNK_SIZE = 1024 * 1024


# ---------- helpers ----------


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _clean_filename(name: str | None) -> str:
    base = os.path.basename((name or "document").replace("\\", "/")).strip()
    return (base or "document")[:200]


async def _read_limited(upload: UploadFile, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    size = 0
    while True:
        chunk = await upload.read(CHUNK_SIZE)
        if not chunk:
            break
        size += len(chunk)
        if size > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File is too large. The limit is {settings.max_upload_mb} MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _get_owned(db: Session, extraction_id: str, user_id: str) -> Extraction:
    row = db.get(Extraction, extraction_id)
    # Same 404 for "doesn't exist" and "belongs to someone else".
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extraction not found")
    return row


def _get_exportable(db: Session, extraction_id: str, user_id: str) -> ExtractedInvoice:
    row = _get_owned(db, extraction_id, user_id)
    if row.status != "complete" or not row.extracted_data:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This extraction has no data to export")
    return ExtractedInvoice.model_validate(row.extracted_data)


# The streaming generator runs after the request's dependencies are torn down,
# so it opens its own short-lived DB sessions instead of reusing get_db's.


def _create_record(user_id: str, filename: str) -> str:
    with SessionLocal() as db:
        row = Extraction(user_id=user_id, filename=filename, status="processing")
        db.add(row)
        db.commit()
        return row.id


def _complete_record(record_id: str, invoice: ExtractedInvoice) -> dict:
    with SessionLocal() as db:
        row = db.get(Extraction, record_id)
        row.status = "complete"
        row.extracted_data = invoice.model_dump(mode="json")
        db.commit()
        db.refresh(row)
        return ExtractionOut.model_validate(row).model_dump(mode="json")


def _fail_record(record_id: str | None) -> None:
    if record_id is None:
        return
    try:
        with SessionLocal() as db:
            row = db.get(Extraction, record_id)
            if row is not None and row.status != "complete":
                row.status = "failed"
                db.commit()
    except Exception:
        logger.exception("Could not mark extraction %s as failed", record_id)


async def _event_stream(user_id: str, filename: str, data: bytes, kind: str) -> AsyncIterator[str]:
    record_id: str | None = None
    finished = False
    try:
        yield _sse({"stage": "uploading", "progress": 10, "message": f"Received {filename}"})
        record_id = await run_in_threadpool(_create_record, user_id, filename)

        yield _sse({"stage": "extracting", "progress": 30, "message": "Reading document…"})
        document = await run_in_threadpool(ocr.extract_text, data, kind)

        note = f" (first {document.pages} pages)" if document.truncated else ""
        yield _sse({"stage": "extracting", "progress": 65, "message": f"Extracting fields with AI{note}…"})
        invoice = await run_in_threadpool(llm.extract_invoice, document.text)

        result = await run_in_threadpool(_complete_record, record_id, invoice)
        finished = True
        yield _sse({"stage": "complete", "progress": 100, "message": "Done", "result": result})
    except (ocr.DocumentError, llm.ExtractionError) as exc:
        await run_in_threadpool(_fail_record, record_id)
        finished = True
        yield _sse({"stage": "error", "progress": 100, "message": str(exc)})
    except Exception:
        logger.exception("Extraction failed unexpectedly")
        await run_in_threadpool(_fail_record, record_id)
        finished = True
        yield _sse({"stage": "error", "progress": 100, "message": "Something went wrong while processing this document."})
    finally:
        # Client disconnected mid-stream: don't leave the record stuck on "processing".
        if not finished:
            _fail_record(record_id)


# ---------- endpoints ----------


@router.post("/extract")
async def extract(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    user_id = current_user.id
    filename = _clean_filename(file.filename)

    if os.path.splitext(filename)[1].lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a PDF, PNG or JPG file.")

    data = await _read_limited(file, settings.max_upload_mb * 1024 * 1024)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty.")

    kind = ocr.sniff_kind(data)
    if kind is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="This doesn't look like a valid PDF, PNG or JPG file.",
        )

    return StreamingResponse(
        _event_stream(user_id, filename, data, kind),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/history", response_model=list[ExtractionOut])
def history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Extraction]:
    return (
        db.query(Extraction)
        .filter(Extraction.user_id == current_user.id)
        .order_by(Extraction.created_at.desc())
        .limit(100)
        .all()
    )


@router.patch("/extractions/{extraction_id}", response_model=ExtractionOut)
def update_extraction(
    extraction_id: str,
    payload: ExtractedInvoice,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Extraction:
    """Save the user's edits so exports match what they see on screen."""
    row = _get_owned(db, extraction_id, current_user.id)
    if row.status != "complete":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only completed extractions can be edited")
    row.extracted_data = payload.model_dump(mode="json")  # assign a new dict so SQLAlchemy sees the change
    db.commit()
    db.refresh(row)
    return row


@router.get("/exports/csv")
def export_csv(
    extraction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    invoice = _get_exportable(db, extraction_id, current_user.id)
    return Response(
        content=exporters.to_csv(invoice),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="documind-export.csv"'},
    )


@router.get("/exports/excel")
def export_excel(
    extraction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    invoice = _get_exportable(db, extraction_id, current_user.id)
    return Response(
        content=exporters.to_xlsx(invoice),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="documind-export.xlsx"'},
    )
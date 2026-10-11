"""Turn an uploaded PDF or image into plain text.

PDFs use their embedded text layer when it exists (fast, exact). Pages that have
little or no text (scans) are rendered to an image and run through Tesseract.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass

import fitz  # PyMuPDF
import pytesseract
from PIL import Image, ImageOps

from app.core.config import settings

logger = logging.getLogger(__name__)

if settings.tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

# A page with fewer characters than this is treated as a scan and OCR'd.
MIN_TEXT_CHARS_PER_PAGE = 40
OCR_TIMEOUT_SECONDS = 60
MIN_USABLE_CHARS = 10

# Refuse absurdly large images instead of exhausting server memory while decoding them.
# Pillow warns above this many pixels and raises an error above twice this.
Image.MAX_IMAGE_PIXELS = 40_000_000


class DocumentError(Exception):
    """A problem with the uploaded file. The message is safe to show to the user."""


@dataclass
class ExtractedText:
    text: str
    pages: int
    ocr_pages: int
    truncated: bool = False


def sniff_kind(data: bytes) -> str | None:
    """Identify the real file type from its bytes, not the filename."""
    if b"%PDF-" in data[:1024]:
        return "pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n") or data.startswith(b"\xff\xd8\xff"):
        return "image"
    return None


def _ocr(image: Image.Image) -> str:
    try:
        return pytesseract.image_to_string(image, timeout=OCR_TIMEOUT_SECONDS)
    except pytesseract.TesseractNotFoundError as exc:
        logger.error("Tesseract binary not found (set TESSERACT_CMD or install tesseract-ocr)")
        raise DocumentError("Text recognition is unavailable on the server right now.") from exc
    except pytesseract.TesseractError as exc:
        logger.warning("Tesseract failed: %s", exc)
        raise DocumentError("Could not read text from this document.") from exc
    except RuntimeError as exc:  # pytesseract raises RuntimeError on timeout
        logger.warning("Tesseract timed out: %s", exc)
        raise DocumentError("This document took too long to read. Try a smaller or clearer file.") from exc


def _prepare_image(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image).convert("L")
    width, height = image.size
    if max(width, height) > 4000:
        image.thumbnail((4000, 4000))
    elif width < 1000:
        image = image.resize((width * 2, height * 2), Image.Resampling.LANCZOS)
    return ImageOps.autocontrast(image)


def _from_image(data: bytes) -> ExtractedText:
    try:
        with Image.open(io.BytesIO(data)) as raw:
            if raw.format == "JPEG":
                raw.draft("L", (4000, 4000))  # let the JPEG decoder shrink big photos while decoding
            image = _prepare_image(raw)
    except Exception as exc:
        raise DocumentError("This image could not be read. It may be corrupted.") from exc
    return ExtractedText(text=_ocr(image).strip(), pages=1, ocr_pages=1)


def _from_pdf(data: bytes) -> ExtractedText:
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise DocumentError("This PDF could not be opened. It may be corrupted.") from exc

    try:
        if doc.needs_pass:
            raise DocumentError("This PDF is password-protected.")
        total_pages = doc.page_count
        if total_pages == 0:
            raise DocumentError("This PDF has no pages.")

        pages_to_read = min(total_pages, settings.max_pdf_pages)
        parts: list[str] = []
        ocr_pages = 0
        for index in range(pages_to_read):
            page = doc.load_page(index)
            text = page.get_text("text").strip()
            if len(text) < MIN_TEXT_CHARS_PER_PAGE:
                pixmap = page.get_pixmap(dpi=settings.ocr_dpi, colorspace=fitz.csGRAY, alpha=False)
                image = Image.frombytes("L", (pixmap.width, pixmap.height), pixmap.samples)
                ocr_text = _ocr(image).strip()
                ocr_pages += 1
                if len(ocr_text) > len(text):
                    text = ocr_text
            if text:
                parts.append(text)
        return ExtractedText(
            text="\n\n".join(parts),
            pages=pages_to_read,
            ocr_pages=ocr_pages,
            truncated=total_pages > pages_to_read,
        )
    finally:
        doc.close()


def extract_text(data: bytes, kind: str) -> ExtractedText:
    if kind == "pdf":
        result = _from_pdf(data)
    elif kind == "image":
        result = _from_image(data)
    else:
        raise DocumentError("Unsupported file type. Upload a PDF, PNG or JPG.")

    if len(result.text.strip()) < MIN_USABLE_CHARS:
        raise DocumentError("No readable text was found in this document.")
    return result
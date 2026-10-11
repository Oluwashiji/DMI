FROM python:3.12-slim

WORKDIR /app

# System deps needed by later phases (Tesseract OCR, PyMuPDF build deps)
# are added here now so the image doesn't need rebuilding when the
# extraction endpoint lands.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

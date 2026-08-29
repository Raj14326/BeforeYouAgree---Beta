FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.7.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt
COPY labels.py segmentation.py service.py ./

CMD ["sh", "-c", "uvicorn service:app --host 0.0.0.0 --port ${PORT}"]

FROM python:3.12-slim
WORKDIR /app
COPY ml_service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY ml_service ./ml_service
# Mount the complete eight-label trained checkpoint at this path.
ENV BERT_MODEL_DIR=/models/bert-multilabel-base-v1
ENV PORT=8000
CMD ["sh", "-c", "uvicorn ml_service.app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]

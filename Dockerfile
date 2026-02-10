FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY scripts/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy prediction server code + models
COPY scripts /app/scripts
WORKDIR /app/scripts

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uvicorn predict_server:app --host 0.0.0.0 --port ${PORT:-8000}"]

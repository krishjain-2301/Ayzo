#!/bin/bash

# Exit if any command fails
set -e

# Start Celery worker in the background
echo "Starting Celery worker..."
celery -A app.workers.celery_app worker --loglevel=info &

# Start Uvicorn in the foreground
# Render provides the PORT environment variable dynamically
PORT=${PORT:-8000}
echo "Starting Uvicorn API on port $PORT..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT

#!/bin/bash

# Exit if any command fails
set -e

# Start Uvicorn in the foreground
# Render provides the PORT environment variable dynamically
PORT=${PORT:-8000}
echo "Starting Uvicorn API on port $PORT..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT

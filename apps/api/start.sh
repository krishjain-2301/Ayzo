#!/bin/bash

# Exit if any command fails
set -e

# Start the AYZO API server
PORT=${PORT:-8000}
echo "Starting AYZO API on port $PORT..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT

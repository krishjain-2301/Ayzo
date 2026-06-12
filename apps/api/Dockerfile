FROM python:3.12-slim

WORKDIR /app

# Install uv package manager
RUN pip install uv

# Copy dependency files first for better Docker layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy application source
COPY . .

# Ensure the virtual environment is on PATH
ENV PATH="/app/.venv/bin:$PATH"

# Make scripts executable
RUN chmod +x start.sh

# Default: start the API server (Render web service)
# The Celery worker service overrides this with its own startCommand
CMD ["bash", "start.sh"]

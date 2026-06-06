FROM python:3.12-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

COPY . .

ENV PATH="/app/.venv/bin:$PATH"

CMD ["celery", "-A", "app.workers.celery_app", "worker", "--loglevel=info"]

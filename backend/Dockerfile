FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app.py ./
CMD ["sh", "-c", ".venv/bin/uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]

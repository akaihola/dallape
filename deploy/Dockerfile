# Serves the API and the frontend from one origin. Build from the repository root:
#   podman build -f deploy/Dockerfile -t dallape .
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/app.py ./
COPY frontend /app/frontend
ENV PORT=8080
CMD ["sh", "-c", ".venv/bin/uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]

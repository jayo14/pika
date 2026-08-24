# Build context: api/ (docker build -f api/Dockerfile api/)
# One image, four roles — the web API, the Celery worker, the Celery beat scheduler, and
# the Discord Gateway connector — selected at runtime via docker-entrypoint.sh so there is
# exactly one dependency set to build and keep in sync (see docs/deployment.md).

FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.11.32 /uv /uvx /usr/local/bin/

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

# Dependencies first so this layer is cache-friendly across code-only changes.
# --locked (not --frozen) so the build fails loudly if uv.lock drifts from pyproject.toml.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project --no-dev

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
RUN uv sync --locked --no-dev


FROM python:3.12-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system pika && useradd --system --gid pika --create-home pika

WORKDIR /app
COPY --from=builder --chown=pika:pika /app/.venv /app/.venv
COPY --chown=pika:pika app ./app
COPY --chown=pika:pika alembic ./alembic
COPY --chown=pika:pika alembic.ini docker-entrypoint.sh ./
RUN chmod +x /app/docker-entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

USER pika
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/healthz || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["serve"]

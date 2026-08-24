#!/bin/sh
set -eu

case "${1:-serve}" in
  serve)
    echo "Applying database migrations..."
    alembic upgrade head
    echo "Starting API server..."
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000
    ;;
  worker)
    exec celery -A app.workers.celery_app worker --loglevel=info
    ;;
  beat)
    exec celery -A app.workers.celery_app beat --loglevel=info
    ;;
  gateway)
    exec python -m app.workers.gateway
    ;;
  migrate)
    exec alembic upgrade head
    ;;
  *)
    exec "$@"
    ;;
esac

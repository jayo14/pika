from __future__ import annotations

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "pika",
    broker=settings.redis_url or "redis://localhost:6379/0",
    backend=settings.redis_url or "redis://localhost:6379/0",
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_default_queue="pika",
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    result_expires=3600,
    timezone="UTC",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    "purge-expired-events-hourly": {
        "task": "app.workers.tasks.purge_expired_events",
        "schedule": 3600.0,
    },
}

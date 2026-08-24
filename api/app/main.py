from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.billing import router as billing_router
from app.routers.discord import router as discord_router
from app.routers.monitors import router as monitors_router
from app.routers.notifications import router as notifications_router
from app.routers.saved_items import router as saved_items_router
from app.routers.search import router as search_router
from app.routers.signals import router as signals_router
from app.routers.system import router as system_router
from app.routers.workspaces import router as workspaces_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.product_name, version=settings.version, docs_url="/docs", redoc_url=None)
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    )
    app.include_router(system_router, prefix=settings.pika_api_prefix)
    app.include_router(auth_router, prefix=settings.pika_api_prefix)
    app.include_router(workspaces_router, prefix=settings.pika_api_prefix)
    app.include_router(discord_router, prefix=settings.pika_api_prefix)
    app.include_router(monitors_router, prefix=settings.pika_api_prefix)
    app.include_router(signals_router, prefix=settings.pika_api_prefix)
    app.include_router(saved_items_router, prefix=settings.pika_api_prefix)
    app.include_router(notifications_router, prefix=settings.pika_api_prefix)
    app.include_router(search_router, prefix=settings.pika_api_prefix)
    app.include_router(billing_router, prefix=settings.pika_api_prefix)
    app.include_router(admin_router, prefix=settings.pika_api_prefix)
    return app


app = create_app()


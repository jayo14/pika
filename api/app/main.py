from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers.auth import router as auth_router
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
    return app


app = create_app()


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from scalar_fastapi import get_scalar_api_reference

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

API_DESCRIPTION = """
Pika is a consent-based Discord community intelligence workspace: it surfaces a small
number of legitimately available, explainable signals from Discord servers an
administrator has explicitly authorized — never a scraper, never user-session
automation. See `docs/api.md` in the repository for the full endpoint reference this
schema is generated from, `docs/security.md` for the auth/tenant-isolation model, and
`docs/discord-capabilities.md` for what's officially supported vs. excluded.

Authentication is an HttpOnly session cookie (`pika_session`) set by `/auth/signup` or
`/auth/signin` — there is no bearer token. Workspace-scoped routes return **404** for a
non-member (not 403, so existence can't be inferred) and a handful of owner-only actions
return **403** for a member whose role is too low.
"""

OPENAPI_TAGS = [
    {"name": "system", "description": "Unauthenticated health and configuration-readiness checks."},
    {"name": "auth", "description": "Account signup/signin/signout and the current session."},
    {"name": "workspaces", "description": "Tenant boundary — every other resource is scoped to one of these."},
    {"name": "discord", "description": "Discord OAuth connection flow, connection lifecycle, and the per-connection channel allowlist."},
    {"name": "monitors", "description": "Keyword rules Pika evaluates against authorized events to produce signals."},
    {"name": "signals", "description": "Explainable matches produced by the rule engine from ingested events."},
    {"name": "saved-items", "description": "A saved signal, with a status and a private note, for human follow-up."},
    {"name": "notifications", "description": "Selective in-app alerts and per-member delivery preferences."},
    {"name": "search", "description": "Full-text search over ingested event content, plus search history."},
    {"name": "billing", "description": "Plan, usage against plan limits, and plan changes."},
    {"name": "admin", "description": "Staff-only, read-only, cross-tenant observability. Returns 404 to non-staff callers."},
]


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.product_name,
        description=API_DESCRIPTION,
        version=settings.version,
        openapi_tags=OPENAPI_TAGS,
        docs_url="/docs",
        redoc_url="/redoc",
    )
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

    @app.get("/scalar", include_in_schema=False)
    async def scalar_docs():
        return get_scalar_api_reference(openapi_url=app.openapi_url, title=app.title)

    return app


app = create_app()

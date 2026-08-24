from fastapi import APIRouter, Request

from app.core.config import Settings
from app.schemas import CapabilityResponse, HealthResponse
from app.services.discord_capabilities import discord_capability, email_capability, workspace_capability

router = APIRouter(tags=["system"])


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


@router.get("/healthz", response_model=HealthResponse)
async def healthz(request: Request) -> HealthResponse:
    settings = get_settings(request)
    return HealthResponse(service=settings.product_name, version=settings.version)


@router.get("/capabilities", response_model=CapabilityResponse)
async def capabilities(request: Request) -> CapabilityResponse:
    settings = get_settings(request)
    return CapabilityResponse(
        api=HealthResponse(service=settings.product_name, version=settings.version),
        discord=discord_capability(settings),
        workspace=workspace_capability(settings),
        email=email_capability(settings),
    )

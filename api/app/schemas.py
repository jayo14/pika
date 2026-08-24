from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str


class IntegrationCapability(BaseModel):
    status: Literal["configuration_required", "ready"]
    message: str
    missing_configuration: list[str] = Field(default_factory=list)
    safety_boundary: str


class CapabilityResponse(BaseModel):
    api: HealthResponse
    discord: IntegrationCapability
    workspace: IntegrationCapability

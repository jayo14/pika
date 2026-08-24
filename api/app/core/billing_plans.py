from __future__ import annotations

from app.schemas import PlanLimits

# Plan limits and pricing live here, not scattered through business logic, so a limit or
# price change is a one-line edit instead of a code change hunt (docs/product spec: "Do
# not hardcode pricing into business logic. Use configuration."). `None` means unlimited.
PLANS: dict[str, PlanLimits] = {
    "free": PlanLimits(
        plan="free", monitors=3, connections=1, saved_searches=10, retention_days=7, price_usd_per_month=0.0
    ),
    "pro": PlanLimits(
        plan="pro", monitors=25, connections=5, saved_searches=200, retention_days=30, price_usd_per_month=29.0
    ),
    "business": PlanLimits(
        plan="business",
        monitors=None,
        connections=None,
        saved_searches=None,
        retention_days=90,
        price_usd_per_month=99.0,
    ),
}

DEFAULT_PLAN = "free"


def get_plan_limits(plan: str) -> PlanLimits:
    return PLANS.get(plan, PLANS[DEFAULT_PLAN])


def within_limit(used: int, limit: int | None) -> bool:
    return limit is None or used < limit

from __future__ import annotations

from dataclasses import dataclass, field

from app.db.models import MonitorRule

# Deterministic, explainable rule matching. No model call happens here — an LLM is only
# ever worth invoking after a cheap rule has already narrowed the candidate set (see
# docs/architecture.md: "rule-first; optional AI only after a rule ... makes it worthwhile").

SUPPORTED_OPERATORS = {"contains", "equals", "not_contains"}
BASE_SCORE = 40.0
PER_MATCH_SCORE = 20.0
MAX_SCORE = 100.0


@dataclass(frozen=True)
class RuleMatch:
    field: str
    operator: str
    value: str
    matched_text: str


@dataclass(frozen=True)
class SignalEvaluation:
    matched: bool
    score: float
    explanation: dict = field(default_factory=dict)


def _extract_field(payload: dict, field_name: str) -> str:
    return str(payload.get(field_name, "")).lower()


def _rule_matches(rule: MonitorRule, payload: dict) -> RuleMatch | None:
    if rule.operator not in SUPPORTED_OPERATORS:
        return None

    haystack = _extract_field(payload, rule.field)
    needle = rule.value.lower()

    if rule.operator == "contains" and needle in haystack:
        return RuleMatch(field=rule.field, operator=rule.operator, value=rule.value, matched_text=needle)
    if rule.operator == "equals" and haystack == needle:
        return RuleMatch(field=rule.field, operator=rule.operator, value=rule.value, matched_text=needle)
    if rule.operator == "not_contains" and needle not in haystack:
        return RuleMatch(field=rule.field, operator=rule.operator, value=rule.value, matched_text=needle)
    return None


def evaluate_event(rules: list[MonitorRule], payload: dict) -> SignalEvaluation:
    if not rules:
        return SignalEvaluation(matched=False, score=0.0, explanation={"reasons": []})

    matches = [m for rule in rules if (m := _rule_matches(rule, payload)) is not None]
    if not matches:
        return SignalEvaluation(matched=False, score=0.0, explanation={"reasons": []})

    score = min(MAX_SCORE, BASE_SCORE + PER_MATCH_SCORE * len(matches))
    explanation = {
        "reasons": [
            {
                "field": m.field,
                "operator": m.operator,
                "value": m.value,
                "description": f"{m.field} {m.operator.replace('_', ' ')} '{m.value}'",
            }
            for m in matches
        ],
        "rule_count": len(rules),
        "matched_count": len(matches),
    }
    return SignalEvaluation(matched=True, score=score, explanation=explanation)

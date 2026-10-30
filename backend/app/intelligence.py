"""Deterministic repair timeline, memory matching, and safety rules."""
from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session, joinedload

from .models import RepairCase, RepairEvent


def outdated_test_ids(case: RepairCase) -> list[int]:
    """Return saved test IDs missing from the latest saved recommendation snapshot."""
    if not case.tests:
        return []
    if not case.recommendations:
        return [test.id for test in case.tests]
    latest = case.recommendations[-1]
    try:
        content = json.loads(latest.content_json)
        considered = {int(value) for value in content.get("evidence_test_ids", [])}
    except (TypeError, ValueError, json.JSONDecodeError):
        considered = set()
    return sorted(test.id for test in case.tests if test.id not in considered)


def build_timeline(case: RepairCase, events: list[RepairEvent] | None = None) -> list[dict[str, Any]]:
    """Assemble only events supported by saved rows; never infer missing history."""
    items: list[dict[str, Any]] = [
        {
            "id": f"case-{case.id}",
            "event_type": "case_created",
            "title": "Repair case created",
            "description": f"{case.device_category}: {case.brand} {case.model} · {case.issue_title}",
            "happened_at": case.created_at.isoformat(),
        },
        {
            "id": f"symptoms-{case.id}",
            "event_type": "symptoms_recorded",
            "title": "Reported symptoms recorded",
            "description": case.symptoms,
            "happened_at": case.created_at.isoformat(),
        },
    ]
    for test in case.tests:
        details = f"Result: {test.result.replace('_', ' ')}. Observation: {test.observed_result}"
        if test.details:
            details += f" Notes: {test.details}"
        items.append({
            "id": f"test-{test.id}",
            "event_type": "diagnostic_test",
            "title": f"Diagnostic test · {test.test_name}",
            "description": details,
            "happened_at": test.performed_at.isoformat(),
        })
    for recommendation in case.recommendations:
        try:
            content = json.loads(recommendation.content_json)
            evidence_ids = content.get("evidence_test_ids", [])
            summary = str(content.get("summary", "Recommendation saved."))
        except (TypeError, ValueError, json.JSONDecodeError):
            evidence_ids, summary = [], "Saved recommendation content is unavailable."
        items.append({
            "id": f"recommendation-{recommendation.id}",
            "event_type": "recommendation_generated",
            "title": "Recommendation generated",
            "description": f"Source: {recommendation.provider} · Evidence test IDs: {', '.join(map(str, evidence_ids)) or 'none'}. {summary}",
            "happened_at": recommendation.created_at.isoformat(),
        })
    for event in events or []:
        try:
            details = json.loads(event.details_json or "{}")
        except (TypeError, ValueError, json.JSONDecodeError):
            details = {}
        item: dict[str, Any] = {
            "id": f"event-{event.id}",
            "event_type": event.event_type,
            "title": event.description,
            "description": event.description,
            "happened_at": event.occurred_at.isoformat(),
        }
        if details:
            item["details"] = details
        items.append(item)
    return sorted(items, key=lambda item: (datetime.fromisoformat(item["happened_at"]), item["id"]))


def similar_repairs(db: Session, case: RepairCase, limit: int = 5) -> list[dict[str, Any]]:
    """Find completed, non-demo precedents using explainable overlap, not diagnosis."""
    candidates = (
        db.query(RepairCase)
        .options(joinedload(RepairCase.tests))
        .filter(
            RepairCase.id != case.id,
            RepairCase.status == "completed",
            RepairCase.confirmed_fault.is_not(None),
            RepairCase.outcome.is_not(None),
            RepairCase.data_origin != "demo",
        )
        .order_by(RepairCase.updated_at.desc())
        .limit(100)
        .all()
    )
    current_text = _normalize(" ".join([
        case.issue_title, case.symptoms,
        *(f"{test.test_name} {test.observed_result} {test.details}" for test in case.tests),
    ]))
    current_tokens = _tokens(current_text)
    matches: list[tuple[int, dict[str, Any]]] = []
    for candidate in candidates:
        precedent_text = _normalize(" ".join([
            candidate.issue_title, candidate.symptoms,
            *(f"{test.test_name} {test.observed_result} {test.details}" for test in candidate.tests),
        ]))
        overlap = current_tokens & _tokens(precedent_text)
        same_category = candidate.device_category.casefold() == case.device_category.casefold()
        same_brand = candidate.brand.casefold() == case.brand.casefold()
        reasons: list[str] = []
        if same_category:
            reasons.append(f"Same device type: {candidate.device_category}")
        if same_brand:
            reasons.append(f"Same brand: {candidate.brand}")
        shared_terms = sorted(overlap)
        if shared_terms:
            reasons.append(f"Shared symptom or test terms: {', '.join(shared_terms[:6])}")
        score = len(shared_terms) + (2 if same_category else 0) + (1 if same_brand else 0)
        if score < 2 or not shared_terms:
            continue
        matches.append((score, {
            "id": candidate.id,
            "device_category": candidate.device_category,
            "device": f"{candidate.brand} {candidate.model}",
            "issue_title": candidate.issue_title,
            "symptoms": candidate.symptoms,
            "status": candidate.status,
            "confirmed_fault": candidate.confirmed_fault,
            "repair_action": candidate.repair_action,
            "outcome": candidate.outcome,
            "tests": [{
                "test_name": test.test_name,
                "result": test.result,
                "observed_result": test.observed_result,
                "performed_at": test.performed_at.isoformat(),
            } for test in candidate.tests],
            "data_origin": candidate.data_origin,
            "match_reasons": reasons,
            "disclaimer": "This is a previous repair precedent, not a diagnosis or confirmed fault for the selected repair.",
        }))
    matches.sort(key=lambda result: result[0], reverse=True)
    return [item for _, item in matches[:max(1, min(limit, 10))]]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.casefold()).strip()


def _tokens(text: str) -> set[str]:
    ignored = {"with", "from", "that", "this", "have", "were", "when", "into", "device", "issue", "test", "case"}
    return {word for word in re.findall(r"[a-z0-9]+", text) if len(word) > 3 and word not in ignored}


SAFETY_RULES: tuple[tuple[str, tuple[str, ...], str], ...] = (
    ("Possible overheating", (r"unusual\s+(?:heat|warmth)", r"overheat(?:ing)?", r"hot\s+to\s+touch"), "Pause charging and powered testing. Let a qualified technician assess the device before further checks."),
    ("Possible battery swelling", (r"battery.{0,35}(?:swelling|swollen|puffed)", r"(?:swollen|swelling|puffed).{0,35}battery"), "Do not charge, press, puncture, or open the device. Isolate it if safe and refer it to a qualified technician."),
    ("Smoke reported", (r"smoke", r"smoking"), "Stop use and charging. Keep clear of smoke and refer the device for qualified safety assessment."),
    ("Burning or chemical odor reported", (r"(?:burning|electrical|chemical)\s+(?:smell|odor|odour)",), "Stop powered testing and charging. Refer the device for qualified assessment."),
    ("Liquid exposure reported", (r"liquid\s+(?:damage|exposure|inside)", r"water\s+damage", r"liquid\s+spill", r"device\s+(?:is\s+)?wet"), "Do not power on or charge the device. Have a qualified technician assess it before testing."),
    ("Sparking or exposed conductor reported", (r"sparking", r"sparks", r"exposed\s+(?:wire|conductor)"), "Do not touch exposed conductors or continue powered tests. Isolate the device if safe and escalate to a qualified technician."),
)


def safety_alerts(case: RepairCase) -> list[dict[str, str]]:
    """Return only alerts supported by non-negated case or test text."""
    sources = [("Reported symptoms", case.symptoms, case.created_at.isoformat())]
    sources.extend((f"Test: {test.test_name}", f"{test.observed_result} {test.details}", test.performed_at.isoformat()) for test in case.tests)
    alerts: list[dict[str, str]] = []
    seen: set[str] = set()
    for title, patterns, instruction in SAFETY_RULES:
        for source, text, timestamp in sources:
            match = next((re.search(pattern, text, re.IGNORECASE) for pattern in patterns if re.search(pattern, text, re.IGNORECASE)), None)
            if not match or _is_negated(text, match.start()):
                continue
            if title in seen:
                break
            start, end = max(0, match.start() - 60), min(len(text), match.end() + 100)
            alerts.append({
                "title": title,
                "severity": "caution",
                "instruction": instruction,
                "evidence": text[start:end].strip(),
                "source": source,
                "recorded_at": timestamp,
                "disclaimer": "Safety alert based on recorded text; it is not a confirmed component diagnosis.",
            })
            seen.add(title)
            break
    return alerts


def _is_negated(text: str, start: int) -> bool:
    prefix = text[max(0, start - 50):start]
    return bool(re.search(r"\b(?:no|not|without|denies|denied|negative for)\b(?:\s+\w+){0,4}\s*$", prefix, re.IGNORECASE))


def create_status_event(db: Session, case: RepairCase, old_status: str, new_status: str) -> None:
    if old_status == new_status:
        return
    db.add(RepairEvent(
        case_id=case.id,
        event_type="status_changed",
        description=f"Status changed from {old_status.replace('_', ' ')} to {new_status.replace('_', ' ')}.",
        details_json=json.dumps({"from": old_status, "to": new_status}),
    ))

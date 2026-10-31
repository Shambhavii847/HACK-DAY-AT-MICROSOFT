from contextlib import asynccontextmanager
from datetime import timedelta
import logging
import re
from typing import Any
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from .ai_service import generate_recommendation, generate_voice_briefing, serialize_recommendation, _similar_cases
from .config import settings
from .database import create_schema, get_db, SessionLocal
from .knowledge import KNOWLEDGE_SOURCES
from .models import Component, Recommendation, RepairCase, TestResult, utcnow
from .schemas import (
    CaseRead, DashboardSummary, HealthRead, RepairCaseCreate, RepairCaseUpdate,
    RepairOutcomeCreate, RecommendationContent, TestResultCreate, TestResultRead,
    ComponentCreate, ComponentUpdate, ComponentRead, ComponentReuseAction,
    ComponentResaleReview, ComponentSummary,
)
from .seed import seed_demo_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("revix")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_schema()
    with SessionLocal() as db:
        seed_demo_data(db)
    yield


app = FastAPI(
    title="Revix AI API",
    version="1.0.0",
    description="Evidence-grounded electronics repair workflow with Gemma 4 assistance.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ACTIVE_STATUSES = {"new", "diagnosing", "waiting_parts", "in_repair", "testing", "on_hold"}


def _case_read(case: RepairCase) -> dict[str, Any]:
    latest = case.recommendations[-1] if case.recommendations else None
    return {
        "id": case.id,
        "device_category": case.device_category,
        "brand": case.brand,
        "model": case.model,
        "issue_title": case.issue_title,
        "symptoms": case.symptoms,
        "priority": case.priority,
        "status": case.status,
        "customer_contact": getattr(case, "customer_contact", None),
        "confirmed_fault": case.confirmed_fault,
        "repair_action": case.repair_action,
        "outcome": case.outcome,
        "estimate_cost": case.estimate_cost,
        "estimated_minutes": case.estimated_minutes,
        "data_origin": case.data_origin,
        "created_at": case.created_at,
        "updated_at": case.updated_at,
        "test_count": len(case.tests),
        "tracked_components_count": len(case.components) if getattr(case, "components", None) else 0,
        "latest_recommendation_provider": latest.provider if latest else None,
    }


def _get_case_or_404(db: Session, case_id: str) -> RepairCase:
    case = (
        db.query(RepairCase)
        .options(
            joinedload(RepairCase.tests),
            joinedload(RepairCase.recommendations),
            joinedload(RepairCase.components),
        )
        .filter(RepairCase.id == case_id.upper())
        .first()
    )
    if case is None:
        raise HTTPException(status_code=404, detail=f"Repair case {case_id} was not found")
    return case


def _is_reuse_eligible(comp: Component) -> bool:
    """Technician rule: Working health status, recorded test evidence, and non-damaged condition are required."""
    has_working_health = (comp.health_status == "working")
    not_damaged = (comp.condition.lower() != "damaged")
    has_evidence = bool(comp.test_evidence and comp.test_evidence.strip())
    return has_working_health and not_damaged and has_evidence


def _component_read(comp: Component) -> dict[str, Any]:
    eligible = _is_reuse_eligible(comp)
    case_info = None
    if comp.case:
        case_info = {
            "id": comp.case.id,
            "brand": comp.case.brand,
            "model": comp.case.model,
            "status": comp.case.status,
            "issue_title": comp.case.issue_title,
        }
    return {
        "id": comp.id,
        "name": comp.name,
        "part_number": comp.part_number,
        "category": comp.category,
        "quantity": comp.quantity,
        "reserved_quantity": comp.reserved_quantity,
        "used_quantity": comp.used_quantity,
        "condition": comp.condition,
        "location": comp.location,
        "case_id": comp.case_id,
        "source_device": comp.source_device or (f"{comp.case.brand} {comp.case.model}" if comp.case else None),
        "health_status": comp.health_status,
        "test_evidence": comp.test_evidence,
        "tested_at": comp.tested_at,
        "reuse_status": comp.reuse_status,
        "reuse_notes": comp.reuse_notes,
        "is_reuse_eligible": eligible,
        "resale_status": comp.resale_status,
        "resale_decision": comp.resale_decision,
        "resale_reason": comp.resale_reason,
        "resale_condition": comp.resale_condition,
        "resale_price": comp.resale_price,
        "reviewed_at": comp.reviewed_at,
        "reviewed_by": comp.reviewed_by,
        "created_at": comp.created_at,
        "updated_at": comp.updated_at,
        "case_info": case_info,
    }


def _get_component_or_404(db: Session, comp_id: str) -> Component:
    comp = db.query(Component).options(joinedload(Component.case)).filter(Component.id == comp_id.upper()).first()
    if comp is None:
        raise HTTPException(status_code=404, detail=f"Component {comp_id} was not found")
    return comp


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {"name": "Revix AI API", "version": "1.0.0", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health", response_model=HealthRead, tags=["system"])
def health() -> dict[str, Any]:
    configured = settings.has_gemini_key
    return {
        "status": "ok",
        "app_name": "Revix AI",
        "model_name": settings.gemma_model,
        "model_configured": configured,
        "inference_mode": "gemini_api" if configured else "rule_based_fallback",
        "note": "Gemma 4 API ready; credentials are configured." if configured else "No API key found. The app works with visibly labelled local rule-based demo guidance.",
    }


@app.get("/api/dashboard", response_model=DashboardSummary, tags=["dashboard"])
def dashboard(db: Session = Depends(get_db)) -> dict[str, Any]:
    cases = db.query(RepairCase).options(joinedload(RepairCase.tests), joinedload(RepairCase.recommendations)).all()
    now = utcnow()
    week_start = now - timedelta(days=7)
    active = [c for c in cases if c.status in ACTIVE_STATUSES and c.status != "on_hold"]
    ready = [c for c in cases if c.status == "testing"]
    completed = [c for c in cases if c.status == "completed" and c.updated_at >= week_start]
    attention = [c for c in cases if c.priority in {"high", "urgent"} and c.status in ACTIVE_STATUSES]
    recent = sorted(cases, key=lambda c: c.updated_at, reverse=True)[:6]
    return {
        "active_repairs": len(active),
        "ready_for_testing": len(ready),
        "completed_this_week": len(completed),
        "saved_cases": sum(1 for c in cases if c.status == "completed" and c.confirmed_fault and c.outcome),
        "needs_attention": len(attention),
        "recent_cases": [_case_read(case) for case in recent],
    }


@app.get("/api/cases", response_model=list[CaseRead], tags=["cases"])
def list_cases(
    q: str | None = Query(default=None, max_length=180),
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    include_demo: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    query = db.query(RepairCase).options(joinedload(RepairCase.tests), joinedload(RepairCase.recommendations))
    if status and status != "all":
        query = query.filter(RepairCase.status == status)
    if priority and priority != "all":
        query = query.filter(RepairCase.priority == priority)
    if not include_demo:
        query = query.filter(RepairCase.data_origin != "demo")
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(
            RepairCase.id.ilike(term), RepairCase.brand.ilike(term), RepairCase.model.ilike(term),
            RepairCase.issue_title.ilike(term), RepairCase.symptoms.ilike(term),
            RepairCase.confirmed_fault.ilike(term), RepairCase.repair_action.ilike(term),
        ))
    cases = query.order_by(RepairCase.updated_at.desc()).all()
    return [_case_read(case) for case in cases]


@app.post("/api/cases", response_model=CaseRead, status_code=201, tags=["cases"])
def create_case(payload: RepairCaseCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    existing_ids = [row[0] for row in db.query(RepairCase.id).all()]
    numbers = [int(match.group(1)) for cid in existing_ids if (match := re.match(r"FX-(\d+)$", cid))]
    next_number = max(numbers, default=1000) + 1
    case_id = f"FX-{next_number}"
    case = RepairCase(
        id=case_id,
        device_category=payload.device_category.strip(),
        brand=payload.brand.strip(),
        model=payload.model.strip(),
        issue_title=payload.issue_title.strip(),
        symptoms=payload.symptoms.strip(),
        priority=payload.priority,
        status=payload.status,
        customer_contact=payload.customer_contact.strip() if payload.customer_contact else None,
        estimated_minutes=payload.estimated_minutes,
        estimate_cost=payload.estimate_cost,
        data_origin="user_entered",
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    # Phase 1: Initialize component health tracking if a suspected component was logged during intake
    if payload.suspected_component and payload.suspected_component.strip():
        existing_comp_ids = [row[0] for row in db.query(Component.id).all()]
        comp_numbers = [int(m.group(1)) for cid in existing_comp_ids if (m := re.match(r"CMP-(\d+)$", cid))]
        next_comp_number = max(comp_numbers, default=1000) + 1
        initial_component = Component(
            id=f"CMP-{next_comp_number}",
            name=payload.suspected_component.strip(),
            part_number="",
            category="Hardware",
            quantity=1,
            reserved_quantity=0,
            used_quantity=0,
            condition="Good",
            case_id=case.id,
            source_device=f"{case.brand} {case.model}",
            health_status="needs_testing",
            test_evidence=None,
            reuse_status="ineligible",
            resale_status="under_review",
        )
        db.add(initial_component)
        db.commit()
        db.refresh(case)

    return _case_read(case)


@app.delete("/api/cases/{case_id}", tags=["cases"])
def delete_case(case_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    db.delete(case)
    db.commit()
    return {"ok": True, "deleted": case_id.upper()}


@app.get("/api/cases/{case_id}", tags=["cases"])
def get_case(case_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    latest = case.recommendations[-1] if case.recommendations else None
    recommendation = serialize_recommendation(latest, KNOWLEDGE_SOURCES) if latest else None
    components = [_component_read(c) for c in (case.components or [])]
    return {
        **_case_read(case),
        "tests": [TestResultRead.model_validate(t).model_dump(mode="json") for t in case.tests],
        "components": components,
        "latest_recommendation": recommendation,
    }


@app.get("/api/cases/{case_id}/components", response_model=list[ComponentRead], tags=["diagnostics"])
def get_case_components(case_id: str, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    case = _get_case_or_404(db, case_id)
    return [_component_read(c) for c in (case.components or [])]


@app.post("/api/cases/{case_id}/components", response_model=ComponentRead, status_code=201, tags=["diagnostics"])
def add_case_component(case_id: str, payload: ComponentCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    payload_dict = payload.model_dump()
    payload_dict["case_id"] = case.id
    if not payload_dict.get("source_device"):
        payload_dict["source_device"] = f"{case.brand} {case.model}"
    return create_component(ComponentCreate(**payload_dict), db=db)


@app.patch("/api/cases/{case_id}", response_model=CaseRead, tags=["cases"])
def update_case(case_id: str, payload: RepairCaseUpdate, db: Session = Depends(get_db)) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("status") == "completed" and not (case.confirmed_fault and case.repair_action and case.outcome):
        raise HTTPException(status_code=409, detail="Document the technician-confirmed fault, repair action, and verification outcome in Diagnostics before completing this case.")
    for key, value in updates.items():
        if value is not None:
            setattr(case, key, value.strip() if isinstance(value, str) else value)
    case.updated_at = utcnow()
    db.commit()
    db.refresh(case)
    return _case_read(case)


@app.post("/api/cases/{case_id}/tests", response_model=TestResultRead, status_code=201, tags=["diagnostics"])
def add_test_result(case_id: str, payload: TestResultCreate, db: Session = Depends(get_db)) -> TestResult:
    case = _get_case_or_404(db, case_id)
    if case.status in {"completed", "on_hold"}:
        raise HTTPException(status_code=409, detail="This case is completed or on hold. Update its status before recording more tests.")
    row = TestResult(
        case_id=case.id,
        test_name=payload.test_name.strip(),
        result=payload.result,
        observed_result=payload.observed_result.strip(),
        details=payload.details.strip(),
    )
    case.status = "diagnosing"
    case.updated_at = utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.post("/api/cases/{case_id}/recommendation", tags=["diagnostics"])
def create_recommendation(
    case_id: str,
    engine: str | None = Query(None, description="Inference engine: gemma-4, gemini-flash, flash-turbo, fallback-rules"),
    language: str | None = Query("en", description="Output language: en, hi, hi-Latn"),
    allow_acceleration: bool = Query(True, description="Allow fallback to fast Gemini model if Gemma 4 times out"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    if case.status == "completed":
        raise HTTPException(status_code=409, detail="This case is completed. Reopen it before generating a new recommendation.")
    provider, model_name, content, similar = generate_recommendation(
        db, case, engine=engine, language=language, allow_acceleration=allow_acceleration
    )
    row = Recommendation(
        case_id=case.id,
        provider=provider,
        model_name=model_name,
        content_json=content.model_dump_json(),
    )
    if case.status == "new":
        case.status = "diagnosing"
    case.updated_at = utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    return {**serialize_recommendation(row, KNOWLEDGE_SOURCES), "similar_cases": similar}


@app.post("/api/cases/{case_id}/voice-briefing", tags=["diagnostics"])
def get_voice_briefing(
    case_id: str,
    language: str | None = Query(None, description="Voice language: en (English) or hi (Hindi)"),
    payload: dict[str, Any] | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    resolved_lang = language or (payload.get("language") if isinstance(payload, dict) else None) or "en"
    text = generate_voice_briefing(db, case, language=resolved_lang)
    return {
        "case_id": case.id,
        "language": resolved_lang,
        "briefing_text": text,
    }


@app.get("/api/cases/{case_id}/similar", tags=["memory"])
def similar_cases(case_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    return {"case_id": case.id, "matches": _similar_cases(db, case)}


@app.post("/api/cases/{case_id}/outcome", tags=["cases"])
def record_outcome(case_id: str, payload: RepairOutcomeCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    case.confirmed_fault = payload.confirmed_fault.strip()
    case.repair_action = payload.repair_action.strip()
    case.outcome = payload.outcome.strip()
    case.status = payload.status
    case.updated_at = utcnow()
    db.commit()
    db.refresh(case)
    return _case_read(case)


@app.get("/api/knowledge", tags=["knowledge"])
def get_knowledge() -> dict[str, Any]:
    return {"sources": KNOWLEDGE_SOURCES, "notice": "These are generic Revix prototype workflow and safety notes, not manufacturer-specific service manuals."}


@app.get("/api/statuses", tags=["system"])
def statuses() -> dict[str, Any]:
    return {
        "statuses": [
            {"value": "new", "label": "New"},
            {"value": "diagnosing", "label": "Diagnosing"},
            {"value": "waiting_parts", "label": "Waiting for parts"},
            {"value": "in_repair", "label": "In repair"},
            {"value": "testing", "label": "Testing"},
            {"value": "completed", "label": "Completed"},
            {"value": "on_hold", "label": "On hold"},
        ],
        "priorities": ["low", "normal", "high", "urgent"],
        "test_results": ["pass", "fail", "inconclusive", "not_tested", "not_applicable"],
        "component_health_statuses": [
            {"value": "working", "label": "Working"},
            {"value": "needs_testing", "label": "Needs Testing"},
            {"value": "faulty", "label": "Faulty"},
            {"value": "unknown", "label": "Unknown"},
        ],
        "component_resale_statuses": [
            {"value": "under_review", "label": "Under Review"},
            {"value": "approved", "label": "Approved for Resale"},
            {"value": "not_eligible", "label": "Not Eligible"},
        ],
        "component_reuse_statuses": [
            {"value": "eligible", "label": "Eligible for Reuse"},
            {"value": "reserved", "label": "Reserved"},
            {"value": "consumed", "label": "Consumed / In Use"},
            {"value": "ineligible", "label": "Ineligible"},
        ],
    }


# =========================================================================
# COMPONENT INVENTORY, REUSE & RESALE MANAGER ENDPOINTS (PHASE 2)
# =========================================================================

@app.get("/api/components/summary", response_model=ComponentSummary, tags=["components"])
def component_summary(db: Session = Depends(get_db)) -> dict[str, Any]:
    components = db.query(Component).all()
    return {
        "total_components": len(components),
        "total_quantity": sum(c.quantity for c in components),
        "working_count": sum(1 for c in components if c.health_status == "working"),
        "needs_testing_count": sum(1 for c in components if c.health_status == "needs_testing"),
        "faulty_count": sum(1 for c in components if c.health_status == "faulty"),
        "reuse_eligible_count": sum(1 for c in components if _is_reuse_eligible(c) and c.quantity > 0),
        "reserved_count": sum(c.reserved_quantity for c in components),
        "resale_approved_count": sum(1 for c in components if c.resale_status == "approved"),
        "resale_under_review_count": sum(1 for c in components if c.resale_status == "under_review"),
    }


@app.get("/api/components", response_model=list[ComponentRead], tags=["components"])
def list_components(
    q: str | None = Query(default=None, max_length=120),
    category: str | None = Query(default=None),
    health_status: str | None = Query(default=None),
    reuse_status: str | None = Query(default=None),
    resale_status: str | None = Query(default=None),
    reuse_eligible_only: bool | None = Query(default=None),
    case_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    query = db.query(Component).options(joinedload(Component.case))

    if category and category != "all":
        query = query.filter(Component.category == category)
    if health_status and health_status != "all":
        query = query.filter(Component.health_status == health_status)
    if reuse_status and reuse_status != "all":
        query = query.filter(Component.reuse_status == reuse_status)
    if resale_status and resale_status != "all":
        query = query.filter(Component.resale_status == resale_status)
    if case_id:
        query = query.filter(Component.case_id == case_id.upper())
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(
            Component.id.ilike(term),
            Component.name.ilike(term),
            Component.part_number.ilike(term),
            Component.category.ilike(term),
            Component.location.ilike(term),
            Component.source_device.ilike(term),
            Component.test_evidence.ilike(term),
        ))

    components = query.order_by(Component.updated_at.desc()).all()
    results = [_component_read(c) for c in components]

    if reuse_eligible_only:
        results = [r for r in results if r["is_reuse_eligible"] and r["quantity"] > 0]

    return results


@app.post("/api/components", response_model=ComponentRead, status_code=201, tags=["components"])
def create_component(payload: ComponentCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    existing_ids = [row[0] for row in db.query(Component.id).all()]
    numbers = [int(match.group(1)) for cid in existing_ids if (match := re.match(r"CMP-(\d+)$", cid))]
    next_number = max(numbers, default=1000) + 1
    comp_id = f"CMP-{next_number}"

    # Determine initial reuse eligibility
    has_evidence = bool(payload.test_evidence and payload.test_evidence.strip())
    # Phase 1: Status must be based on actual recorded evidence, not invented results.
    if payload.health_status in ("working", "faulty") and not has_evidence:
        raise HTTPException(
            status_code=400,
            detail="Status must be based on actual recorded evidence. Please provide multimeter observations or test evidence.",
        )
    is_eligible = (payload.health_status == "working") and (payload.condition.lower() != "damaged") and has_evidence
    reuse_status = "eligible" if is_eligible else "ineligible"

    # Verify associated case if provided
    case_fk = None
    source_device = payload.source_device.strip() if payload.source_device else None
    if payload.case_id:
        c = db.query(RepairCase).filter(RepairCase.id == payload.case_id.upper()).first()
        if c:
            case_fk = c.id
            if not source_device:
                source_device = f"{c.brand} {c.model}"

    comp = Component(
        id=comp_id,
        name=payload.name.strip(),
        part_number=payload.part_number.strip(),
        category=payload.category.strip() if payload.category else "General",
        quantity=max(0, payload.quantity),
        reserved_quantity=0,
        used_quantity=0,
        condition=payload.condition.strip() if payload.condition else "Good",
        location=payload.location.strip() if payload.location else None,
        case_id=case_fk,
        source_device=source_device,
        health_status=payload.health_status,
        test_evidence=payload.test_evidence.strip() if payload.test_evidence else None,
        tested_at=utcnow() if has_evidence else None,
        reuse_status=reuse_status,
        reuse_notes=None,
        resale_status="under_review",  # Untested/new components must never automatically become approved
        resale_decision=None,
        resale_reason=None,
        resale_condition=None,
        resale_price=None,
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return _component_read(comp)


@app.get("/api/components/{component_id}", response_model=ComponentRead, tags=["components"])
def get_component(component_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    comp = _get_component_or_404(db, component_id)
    return _component_read(comp)


@app.patch("/api/components/{component_id}", response_model=ComponentRead, tags=["components"])
def update_component(component_id: str, payload: ComponentUpdate, db: Session = Depends(get_db)) -> dict[str, Any]:
    comp = _get_component_or_404(db, component_id)
    updates = payload.model_dump(exclude_unset=True)

    if "quantity" in updates and updates["quantity"] is not None:
        if updates["quantity"] < 0:
            raise HTTPException(status_code=400, detail="Inventory quantity cannot be negative.")
        comp.quantity = updates["quantity"]

    if "name" in updates and updates["name"]:
        comp.name = updates["name"].strip()
    if "part_number" in updates and updates["part_number"] is not None:
        comp.part_number = updates["part_number"].strip()
    if "category" in updates and updates["category"]:
        comp.category = updates["category"].strip()
    if "condition" in updates and updates["condition"]:
        comp.condition = updates["condition"].strip()
    if "location" in updates:
        comp.location = updates["location"].strip() if updates["location"] else None
    if "source_device" in updates:
        comp.source_device = updates["source_device"].strip() if updates["source_device"] else None
    if "case_id" in updates:
        if updates["case_id"]:
            c = db.query(RepairCase).filter(RepairCase.id == updates["case_id"].upper()).first()
            comp.case_id = c.id if c else None
        else:
            comp.case_id = None

    if "health_status" in updates and updates["health_status"]:
        new_health = updates["health_status"]
        evidence_check = updates["test_evidence"] if "test_evidence" in updates else comp.test_evidence
        if new_health in ("working", "faulty") and not (evidence_check and evidence_check.strip()):
            raise HTTPException(
                status_code=400,
                detail="Status must be based on actual recorded evidence. Please provide multimeter observations or test evidence.",
            )
        comp.health_status = new_health

    if "test_evidence" in updates:
        evidence_text = updates["test_evidence"].strip() if updates["test_evidence"] else None
        comp.test_evidence = evidence_text
        if evidence_text:
            comp.tested_at = utcnow()

    # Re-evaluate reuse eligibility and resale safety invariants
    is_eligible = _is_reuse_eligible(comp)
    if not is_eligible:
        # If component is no longer working or became damaged, revoke resale approval automatically
        if comp.resale_status == "approved":
            comp.resale_status = "not_eligible"
            comp.resale_decision = "Revoked"
            comp.resale_reason = f"Component health/condition changed to '{comp.health_status}' / '{comp.condition}'."
            comp.reviewed_at = utcnow()
        if comp.reuse_status == "eligible":
            comp.reuse_status = "ineligible"
    else:
        if comp.reuse_status == "ineligible" and comp.quantity > 0:
            comp.reuse_status = "eligible"

    comp.updated_at = utcnow()
    db.commit()
    db.refresh(comp)
    return _component_read(comp)


@app.delete("/api/components/{component_id}", tags=["components"])
def delete_component(component_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    comp = _get_component_or_404(db, component_id)
    db.delete(comp)
    db.commit()
    return {"ok": True, "deleted": component_id.upper()}


@app.post("/api/components/{component_id}/reuse", response_model=ComponentRead, tags=["components"])
def handle_reuse_action(
    component_id: str,
    payload: ComponentReuseAction,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    comp = _get_component_or_404(db, component_id)
    req_qty = payload.quantity

    if payload.action == "reserve":
        # Rule: Require sufficient test evidence and appropriate condition checks before approving reuse
        if not _is_reuse_eligible(comp):
            raise HTTPException(
                status_code=400,
                detail="Component cannot be reserved for reuse: Must have verified 'working' health status, non-damaged condition, and recorded test evidence.",
            )
        if comp.quantity < req_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient available quantity ({comp.quantity} available, {req_qty} requested).",
            )
        comp.quantity -= req_qty
        comp.reserved_quantity += req_qty
        comp.reuse_status = "reserved"
        if payload.case_id:
            comp.case_id = payload.case_id.upper()
        notes = payload.notes.strip() if payload.notes else "Reserved for bench repair"
        comp.reuse_notes = (comp.reuse_notes or "") + f"\n[{utcnow().strftime('%Y-%m-%d %H:%M')}] Reserved {req_qty} unit(s): {notes}"

    elif payload.action == "use":
        # Consuming component in a repair
        if comp.reserved_quantity >= req_qty:
            # Consume from already reserved stock
            comp.reserved_quantity -= req_qty
            comp.used_quantity += req_qty
        else:
            # Direct consumption from available stock
            if not _is_reuse_eligible(comp):
                raise HTTPException(
                    status_code=400,
                    detail="Component cannot be used for repair: Must be verified working with recorded test evidence.",
                )
            if comp.quantity < req_qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient inventory quantity ({comp.quantity} available, {req_qty} requested).",
                )
            comp.quantity -= req_qty
            comp.used_quantity += req_qty

        if comp.quantity == 0 and comp.reserved_quantity == 0:
            comp.reuse_status = "consumed"
        if payload.case_id:
            comp.case_id = payload.case_id.upper()
        notes = payload.notes.strip() if payload.notes else f"Used in repair {payload.case_id or ''}"
        comp.reuse_notes = (comp.reuse_notes or "") + f"\n[{utcnow().strftime('%Y-%m-%d %H:%M')}] Installed/Used {req_qty} unit(s): {notes}"

    elif payload.action == "release":
        # Release reservation back to available inventory
        if comp.reserved_quantity < req_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot release {req_qty} unit(s): Only {comp.reserved_quantity} unit(s) currently reserved.",
            )
        comp.reserved_quantity -= req_qty
        comp.quantity += req_qty
        if _is_reuse_eligible(comp):
            comp.reuse_status = "eligible" if comp.quantity > 0 else "consumed"
        else:
            comp.reuse_status = "ineligible"
        notes = payload.notes.strip() if payload.notes else "Reservation cancelled"
        comp.reuse_notes = (comp.reuse_notes or "") + f"\n[{utcnow().strftime('%Y-%m-%d %H:%M')}] Released {req_qty} reserved unit(s): {notes}"

    comp.updated_at = utcnow()
    db.commit()
    db.refresh(comp)
    return _component_read(comp)


@app.post("/api/components/{component_id}/resale-review", response_model=ComponentRead, tags=["components"])
def handle_resale_review(
    component_id: str,
    payload: ComponentResaleReview,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    comp = _get_component_or_404(db, component_id)

    if payload.resale_status == "approved":
        # Strict Resale Rules:
        # Untested, faulty, damaged, or insufficiently verified components must not automatically become Approved for Resale.
        # Approval must require an explicit review and sufficient evidence.
        if comp.health_status != "working":
            raise HTTPException(
                status_code=400,
                detail=f"Resale approval rejected: Component health status is '{comp.health_status}'. Only verified 'working' components can be approved for resale.",
            )
        if not (comp.test_evidence and comp.test_evidence.strip()):
            raise HTTPException(
                status_code=400,
                detail="Resale approval rejected: Component must have recorded test evidence and verification notes before approval.",
            )
        if comp.condition.lower() == "damaged":
            raise HTTPException(
                status_code=400,
                detail="Resale approval rejected: Physically damaged components are ineligible for resale.",
            )

        comp.resale_status = "approved"
        comp.resale_decision = "Approved for Resale"
    elif payload.resale_status == "not_eligible":
        comp.resale_status = "not_eligible"
        comp.resale_decision = "Not Eligible"
    else:
        comp.resale_status = "under_review"
        comp.resale_decision = "Under Review"

    comp.resale_reason = payload.review_reason.strip()
    comp.resale_condition = payload.review_condition.strip() if payload.review_condition else comp.condition
    comp.resale_price = payload.resale_price
    comp.reviewed_at = utcnow()
    comp.reviewed_by = payload.reviewed_by.strip() if payload.reviewed_by else "Technician Bench Review"
    comp.updated_at = utcnow()
    db.commit()
    db.refresh(comp)
    return _component_read(comp)

from contextlib import asynccontextmanager
from datetime import timedelta
import logging
import re
from typing import Any
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from .ai_service import generate_recommendation, serialize_recommendation, _similar_cases
from .config import settings
from .database import create_schema, get_db, SessionLocal
from .knowledge import KNOWLEDGE_SOURCES
from .models import Recommendation, RepairCase, TestResult, utcnow
from .schemas import (
    CaseRead, DashboardSummary, HealthRead, RepairCaseCreate, RepairCaseUpdate,
    RepairOutcomeCreate, RecommendationContent, TestResultCreate, TestResultRead,
)
from .seed import seed_demo_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fixora")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_schema()
    with SessionLocal() as db:
        seed_demo_data(db)
    yield


app = FastAPI(
    title="Fixora AI API",
    version="1.0.0",
    description="Evidence-grounded electronics repair workflow with Gemma 4 assistance.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
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
        "latest_recommendation_provider": latest.provider if latest else None,
    }


def _get_case_or_404(db: Session, case_id: str) -> RepairCase:
    case = (
        db.query(RepairCase)
        .options(joinedload(RepairCase.tests), joinedload(RepairCase.recommendations))
        .filter(RepairCase.id == case_id.upper())
        .first()
    )
    if case is None:
        raise HTTPException(status_code=404, detail=f"Repair case {case_id} was not found")
    return case


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {"name": "Fixora AI API", "version": "1.0.0", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health", response_model=HealthRead, tags=["system"])
def health() -> dict[str, Any]:
    configured = settings.has_gemini_key
    return {
        "status": "ok",
        "app_name": "Fixora AI",
        "model_name": settings.gemma_model,
        "model_configured": configured,
        "inference_mode": "gemini_api" if configured else "rule_based_fallback",
        "note": "Gemma API credentials are configured; connectivity is checked when a recommendation is requested." if configured else "No API key found. The app works with visibly labelled local rule-based demo guidance.",
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
    return {**_case_read(case), "tests": [TestResultRead.model_validate(t).model_dump(mode="json") for t in case.tests], "latest_recommendation": recommendation}


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
def create_recommendation(case_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    if case.status == "completed":
        raise HTTPException(status_code=409, detail="This case is completed. Reopen it before generating a new recommendation.")
    provider, model_name, content, similar = generate_recommendation(db, case)
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
    return {"sources": KNOWLEDGE_SOURCES, "notice": "These are generic Fixora prototype workflow and safety notes, not manufacturer-specific service manuals."}


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
    }

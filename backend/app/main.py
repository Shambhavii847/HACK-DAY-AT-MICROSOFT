from contextlib import asynccontextmanager
from datetime import timedelta
import json
import logging
import re
from typing import Any
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from .ai_service import generate_recommendation, serialize_recommendation
from .config import settings
from .database import create_schema, get_db, SessionLocal
from .knowledge import KNOWLEDGE_SOURCES
from .models import ComponentInventory, ComponentInventoryEvent, ComponentRecord, ComponentTestResult, Recommendation, RepairCase, RepairEvent, TestResult, utcnow
from .intelligence import build_timeline, create_status_event, outdated_test_ids, safety_alerts, similar_repairs
from .schemas import (
    CaseRead, ComponentInventoryCreate, ComponentInventoryRead, ComponentInventoryUpdate,
    ComponentRecordCreate, ComponentRecordRead, ComponentTestCreate, InventoryComponentCandidateRead,
    InventoryQuantityChange, InventoryReviewCreate, InventoryStockAdjustment,
    DashboardSummary, HealthRead, RepairCaseCreate, RepairCaseUpdate,
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


def _component_read(component: ComponentRecord) -> dict[str, Any]:
    tests = sorted(component.tests, key=lambda item: (item.performed_at, item.id))
    latest = tests[-1] if tests else None
    health_status = (
        {"pass": "working", "fail": "faulty"}.get(latest.result, "needs_testing")
        if latest else "unknown"
    )
    return {
        "id": component.id,
        "case_id": component.case_id,
        "component_name": component.component_name,
        "model_part_number": component.model_part_number,
        "health_status": health_status,
        "tests": [
            {
                "id": item.id,
                "component_id": item.component_id,
                "test_name": item.test_name,
                "result": item.result,
                "observed_result": item.observed_result,
                "details": item.details,
                "performed_at": item.performed_at,
            }
            for item in tests
        ],
        "created_at": component.created_at,
        "updated_at": component.updated_at,
    }


def _latest_component_test(component: ComponentRecord) -> ComponentTestResult | None:
    tests = sorted(component.tests, key=lambda item: (item.performed_at, item.id))
    return tests[-1] if tests else None


def _component_health_status(component: ComponentRecord) -> str:
    latest = _latest_component_test(component)
    if latest is None:
        return "unknown"
    return {"pass": "working", "fail": "faulty"}.get(latest.result, "needs_testing")


def _inventory_review_current(inventory: ComponentInventory, kind: str) -> bool:
    component = inventory.component
    latest = _latest_component_test(component)
    test_id = latest.id if latest else None
    return (
        getattr(inventory, f"{kind}_reviewed_at") is not None
        and getattr(inventory, f"{kind}_reviewed_test_id") == test_id
        and getattr(inventory, f"{kind}_reviewed_condition_at") == inventory.condition_assessed_at
    )


def _inventory_read(inventory: ComponentInventory) -> dict[str, Any]:
    component = inventory.component
    latest = _latest_component_test(component)
    case = component.case
    reuse_status = inventory.reuse_status if _inventory_review_current(inventory, "reuse") else "under_review"
    resale_status = inventory.resale_status if _inventory_review_current(inventory, "resale") else "under_review"
    return {
        "id": inventory.id,
        "component_id": component.id,
        "case_id": case.id,
        "component_name": component.component_name,
        "model_part_number": component.model_part_number,
        "source_device": f"{case.brand} {case.model}".strip(),
        "health_status": _component_health_status(component),
        "latest_test": ({
            "id": latest.id,
            "component_id": latest.component_id,
            "test_name": latest.test_name,
            "result": latest.result,
            "observed_result": latest.observed_result,
            "details": latest.details,
            "performed_at": latest.performed_at,
        } if latest else None),
        "quantity_available": inventory.quantity_available,
        "quantity_reserved": inventory.quantity_reserved,
        "quantity_used": inventory.quantity_used,
        "condition": inventory.condition,
        "condition_notes": inventory.condition_notes,
        "condition_assessed_at": inventory.condition_assessed_at,
        "storage_location": inventory.storage_location,
        "reuse_status": reuse_status,
        "reuse_reason": inventory.reuse_reason if reuse_status != "under_review" else "",
        "reuse_reviewed_at": inventory.reuse_reviewed_at if reuse_status != "under_review" else None,
        "resale_status": resale_status,
        "resale_reason": inventory.resale_reason if resale_status != "under_review" else "",
        "resale_reviewed_at": inventory.resale_reviewed_at if resale_status != "under_review" else None,
        "events": [
            {"id": event.id, "event_type": event.event_type, "quantity": event.quantity,
             "reason": event.reason, "occurred_at": event.occurred_at}
            for event in inventory.events
        ],
        "created_at": inventory.created_at,
        "updated_at": inventory.updated_at,
    }


def _inventory_or_404(db: Session, inventory_id: int) -> ComponentInventory:
    inventory = db.query(ComponentInventory).filter(ComponentInventory.id == inventory_id).first()
    if inventory is None:
        raise HTTPException(status_code=404, detail=f"Inventory record {inventory_id} was not found")
    return inventory


def _assert_reuse_evidence(inventory: ComponentInventory) -> ComponentTestResult:
    latest = _latest_component_test(inventory.component)
    if latest is None or latest.result != "pass":
        raise HTTPException(status_code=409, detail="Reuse approval requires a saved component test with a passing result.")
    if inventory.condition not in {"new", "like_new", "good"} or len(inventory.condition_notes.strip()) < 3:
        raise HTTPException(status_code=409, detail="Reuse approval requires a recorded, suitable physical condition assessment.")
    return latest


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
        "evidence_outdated": bool(outdated_test_ids(case)),
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
    tracked_cases = [case for case in cases if case.data_origin != "demo"]
    now = utcnow()
    week_start = now - timedelta(days=7)
    active = [c for c in tracked_cases if c.status in ACTIVE_STATUSES and c.status != "on_hold"]
    ready = [c for c in tracked_cases if c.status == "testing"]
    completed = [c for c in tracked_cases if c.status == "completed" and c.updated_at >= week_start]
    attention = [c for c in tracked_cases if c.priority in {"high", "urgent"} and c.status in ACTIVE_STATUSES]
    recent = sorted(tracked_cases, key=lambda c: c.updated_at, reverse=True)[:6]
    evidence_cases = [case for case in tracked_cases if outdated_test_ids(case)]
    pending_actions: list[dict[str, Any]] = []
    for case in tracked_cases:
        if case.status == "completed":
            continue
        unreviewed = outdated_test_ids(case)
        if unreviewed:
            action, detail = "Review new evidence", f"{len(unreviewed)} saved test(s) are not in the latest recommendation."
        elif case.status == "waiting_parts":
            action, detail = "Follow up on parts", "This repair is waiting for parts."
        elif case.status == "on_hold":
            action, detail = "Review hold", "This repair is on hold and needs a technician review."
        elif case.status in {"new", "diagnosing"} and not case.tests:
            action, detail = "Record diagnostic evidence", "No diagnostic tests are saved for this repair yet."
        elif case.status == "testing":
            action, detail = "Verify repair outcome", "This repair is ready for final verification."
        else:
            continue
        pending_actions.append({
            "case_id": case.id,
            "title": action,
            "detail": detail,
            "status": case.status,
            "priority": case.priority,
            "updated_at": case.updated_at.isoformat(),
        })
    pending_actions.sort(key=lambda item: (
        0 if item["priority"] == "urgent" else 1 if item["priority"] == "high" else 2,
        item["updated_at"],
    ))
    return {
        "total_cases": len(tracked_cases),
        "pending_repairs": sum(1 for c in tracked_cases if c.status in {"new", "diagnosing", "waiting_parts", "on_hold"}),
        "in_progress": sum(1 for c in tracked_cases if c.status in {"in_repair", "testing"}),
        "completed_repairs": sum(1 for c in tracked_cases if c.status == "completed"),
        "awaiting_diagnosis": sum(1 for c in tracked_cases if c.status in {"new", "diagnosing"}),
        "evidence_to_review": len(evidence_cases),
        "active_repairs": len(active),
        "ready_for_testing": len(ready),
        "completed_this_week": len(completed),
        "saved_cases": sum(1 for c in tracked_cases if c.status == "completed" and c.confirmed_fault and c.outcome),
        "needs_attention": len(attention),
        "recent_cases": [_case_read(case) for case in recent],
        "pending_actions": pending_actions[:8],
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
    events = db.query(RepairEvent).filter(RepairEvent.case_id == case.id).order_by(RepairEvent.occurred_at, RepairEvent.id).all()
    return {
        **_case_read(case),
        "tests": [TestResultRead.model_validate(t).model_dump(mode="json") for t in case.tests],
        "components": [_component_read(component) for component in case.components],
        "latest_recommendation": recommendation,
        "timeline": build_timeline(case, events),
        "safety_alerts": safety_alerts(case),
        "similar_cases": similar_repairs(db, case),
    }


@app.patch("/api/cases/{case_id}", response_model=CaseRead, tags=["cases"])
def update_case(case_id: str, payload: RepairCaseUpdate, db: Session = Depends(get_db)) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("status") == "completed" and not (case.confirmed_fault and case.repair_action and case.outcome):
        raise HTTPException(status_code=409, detail="Document the technician-confirmed fault, repair action, and verification outcome in Diagnostics before completing this case.")
    old_status = case.status
    for key, value in updates.items():
        if value is not None:
            setattr(case, key, value.strip() if isinstance(value, str) else value)
    case.updated_at = utcnow()
    if "status" in updates and updates["status"] is not None:
        create_status_event(db, case, old_status, case.status)
    db.commit()
    db.refresh(case)
    return _case_read(case)


@app.post("/api/cases/{case_id}/tests", response_model=TestResultRead, status_code=201, tags=["diagnostics"])
def add_test_result(case_id: str, payload: TestResultCreate, db: Session = Depends(get_db)) -> TestResult:
    case = _get_case_or_404(db, case_id)
    if case.status in {"completed", "on_hold"}:
        raise HTTPException(status_code=409, detail="This case is completed or on hold. Update its status before recording more tests.")
    old_status = case.status
    row = TestResult(
        case_id=case.id,
        test_name=payload.test_name.strip(),
        result=payload.result,
        observed_result=payload.observed_result.strip(),
        details=payload.details.strip(),
    )
    case.status = "diagnosing"
    case.updated_at = utcnow()
    create_status_event(db, case, old_status, case.status)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/api/cases/{case_id}/components", response_model=list[ComponentRecordRead], tags=["components"])
def list_components(case_id: str, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    case = _get_case_or_404(db, case_id)
    return [_component_read(component) for component in case.components]


@app.post("/api/cases/{case_id}/components", response_model=ComponentRecordRead, status_code=201, tags=["components"])
def create_component(case_id: str, payload: ComponentRecordCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    if case.status in {"completed", "on_hold"}:
        raise HTTPException(status_code=409, detail="This case is completed or on hold. Update its status before recording component information.")
    component = ComponentRecord(
        case_id=case.id,
        component_name=payload.component_name,
        model_part_number=payload.model_part_number,
    )
    db.add(component)
    db.commit()
    db.refresh(component)
    return _component_read(component)


@app.post("/api/cases/{case_id}/components/{component_id}/tests", response_model=ComponentRecordRead, tags=["components"])
def add_component_test(
    case_id: str,
    component_id: int,
    payload: ComponentTestCreate,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    if case.status in {"completed", "on_hold"}:
        raise HTTPException(status_code=409, detail="This case is completed or on hold. Update its status before recording component tests.")
    component = next((item for item in case.components if item.id == component_id), None)
    if component is None:
        raise HTTPException(status_code=404, detail=f"Component {component_id} was not found for repair case {case.id}")
    component.tests.append(ComponentTestResult(
        test_name=payload.test_name,
        result=payload.result,
        observed_result=payload.observed_result,
        details=payload.details.strip(),
    ))
    component.updated_at = utcnow()
    if component.inventory:
        inventory = component.inventory
        inventory.reuse_status = "under_review"
        inventory.reuse_reason = ""
        inventory.reuse_reviewed_test_id = None
        inventory.reuse_reviewed_condition_at = None
        inventory.reuse_reviewed_at = None
        inventory.resale_status = "under_review"
        inventory.resale_reason = ""
        inventory.resale_reviewed_test_id = None
        inventory.resale_reviewed_condition_at = None
        inventory.resale_reviewed_at = None
    db.commit()
    db.refresh(component)
    return _component_read(component)


@app.get("/api/components/available-for-inventory", response_model=list[InventoryComponentCandidateRead], tags=["inventory"])
def list_components_without_inventory(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    components = (
        db.query(ComponentRecord)
        .join(RepairCase, ComponentRecord.case_id == RepairCase.id)
        .outerjoin(ComponentInventory, ComponentInventory.component_id == ComponentRecord.id)
        .filter(ComponentInventory.id.is_(None))
        .filter(RepairCase.data_origin != "demo")
        .options(joinedload(ComponentRecord.tests), joinedload(ComponentRecord.case))
        .order_by(ComponentRecord.created_at.desc())
        .all()
    )
    result: list[dict[str, Any]] = []
    for component in components:
        latest = _latest_component_test(component)
        result.append({
            "id": component.id,
            "case_id": component.case_id,
            "component_name": component.component_name,
            "model_part_number": component.model_part_number,
            "health_status": _component_health_status(component),
            "latest_test": ({
                "id": latest.id, "component_id": latest.component_id, "test_name": latest.test_name,
                "result": latest.result, "observed_result": latest.observed_result,
                "details": latest.details, "performed_at": latest.performed_at,
            } if latest else None),
            "source_device": f"{component.case.brand} {component.case.model}".strip(),
        })
    return result


@app.post("/api/components/{component_id}/inventory", response_model=ComponentInventoryRead, status_code=201, tags=["inventory"])
def create_component_inventory(
    component_id: int,
    payload: ComponentInventoryCreate,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    component = db.query(ComponentRecord).filter(ComponentRecord.id == component_id).first()
    if component is None:
        raise HTTPException(status_code=404, detail=f"Component {component_id} was not found")
    if component.case.data_origin == "demo":
        raise HTTPException(status_code=409, detail="Demo repair components cannot be added to real inventory.")
    if component.inventory is not None:
        raise HTTPException(status_code=409, detail="This component already has an inventory record.")
    inventory = ComponentInventory(
        component_id=component.id,
        quantity_available=payload.quantity_available,
        condition=payload.condition,
        condition_notes=payload.condition_notes,
        condition_assessed_at=utcnow(),
        storage_location=payload.storage_location,
    )
    db.add(inventory)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This component already has an inventory record.")
    db.refresh(inventory)
    return _inventory_read(inventory)


@app.get("/api/inventory", response_model=list[ComponentInventoryRead], tags=["inventory"])
def list_inventory(
    q: str | None = Query(default=None, max_length=180),
    reuse_status: str | None = Query(default=None),
    resale_status: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    query = (
        db.query(ComponentInventory)
        .join(ComponentRecord)
        .join(RepairCase)
        .options(
            joinedload(ComponentInventory.component).joinedload(ComponentRecord.case),
            joinedload(ComponentInventory.component).joinedload(ComponentRecord.tests),
            joinedload(ComponentInventory.events),
        )
    )
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(
            ComponentRecord.component_name.ilike(term),
            ComponentRecord.model_part_number.ilike(term),
            RepairCase.id.ilike(term), RepairCase.brand.ilike(term), RepairCase.model.ilike(term),
        ))
    records = query.order_by(ComponentInventory.updated_at.desc()).all()
    result = [_inventory_read(item) for item in records]
    if reuse_status and reuse_status != "all":
        result = [item for item in result if item["reuse_status"] == reuse_status]
    if resale_status and resale_status != "all":
        result = [item for item in result if item["resale_status"] == resale_status]
    return result


@app.patch("/api/inventory/{inventory_id}", response_model=ComponentInventoryRead, tags=["inventory"])
def update_component_inventory(
    inventory_id: int,
    payload: ComponentInventoryUpdate,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    inventory = _inventory_or_404(db, inventory_id)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="Provide at least one inventory field to update.")
    if any(field in {"condition", "condition_notes"} and value is None for field, value in updates.items()):
        raise HTTPException(status_code=422, detail="Condition and condition notes cannot be cleared; record Unknown and explain the observation instead.")
    condition_changed = "condition" in updates or "condition_notes" in updates
    for field, value in updates.items():
        setattr(inventory, field, value)
    if condition_changed:
        if not inventory.condition_notes.strip():
            raise HTTPException(status_code=422, detail="A physical condition observation is required.")
        inventory.condition_assessed_at = utcnow()
        inventory.reuse_status = "under_review"
        inventory.reuse_reason = ""
        inventory.reuse_reviewed_test_id = None
        inventory.reuse_reviewed_condition_at = None
        inventory.reuse_reviewed_at = None
        inventory.resale_status = "under_review"
        inventory.resale_reason = ""
        inventory.resale_reviewed_test_id = None
        inventory.resale_reviewed_condition_at = None
        inventory.resale_reviewed_at = None
    inventory.updated_at = utcnow()
    db.commit()
    db.refresh(inventory)
    return _inventory_read(inventory)


@app.post("/api/inventory/{inventory_id}/stock-adjustments", response_model=ComponentInventoryRead, tags=["inventory"])
def adjust_inventory_stock(
    inventory_id: int,
    payload: InventoryStockAdjustment,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    inventory = _inventory_or_404(db, inventory_id)
    query = db.query(ComponentInventory).filter(ComponentInventory.id == inventory_id)
    if payload.quantity_delta < 0:
        query = query.filter(ComponentInventory.quantity_available >= abs(payload.quantity_delta))
    changed = query.update({
        ComponentInventory.quantity_available: ComponentInventory.quantity_available + payload.quantity_delta,
        ComponentInventory.updated_at: utcnow(),
    }, synchronize_session=False)
    if changed != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Stock adjustment would make available quantity negative.")
    db.add(ComponentInventoryEvent(
        inventory_id=inventory_id,
        event_type="stock_added" if payload.quantity_delta > 0 else "stock_removed",
        quantity=abs(payload.quantity_delta),
        reason=payload.reason,
    ))
    db.commit()
    db.expire_all()
    return _inventory_read(_inventory_or_404(db, inventory_id))


def _review_inventory(inventory: ComponentInventory, kind: str, status: str, reason: str) -> None:
    allowed = {"reuse": {"under_review", "available", "not_eligible"}, "resale": {"under_review", "approved_for_resale", "not_eligible"}}
    if status not in allowed[kind]:
        raise HTTPException(status_code=422, detail=f"Unsupported {kind} review status.")
    latest = _latest_component_test(inventory.component)
    if status in {"available", "approved_for_resale"}:
        _assert_reuse_evidence(inventory)
    if kind == "resale" and status == "approved_for_resale" and inventory.quantity_available < 1:
        raise HTTPException(status_code=409, detail="Resale approval requires positive unreserved inventory quantity.")
    setattr(inventory, f"{kind}_status", status)
    setattr(inventory, f"{kind}_reason", reason)
    setattr(inventory, f"{kind}_reviewed_test_id", latest.id if latest else None)
    setattr(inventory, f"{kind}_reviewed_condition_at", inventory.condition_assessed_at)
    setattr(inventory, f"{kind}_reviewed_at", utcnow())
    inventory.updated_at = utcnow()


@app.post("/api/inventory/{inventory_id}/reuse-review", response_model=ComponentInventoryRead, tags=["inventory"])
def review_reuse(inventory_id: int, payload: InventoryReviewCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    inventory = _inventory_or_404(db, inventory_id)
    _review_inventory(inventory, "reuse", payload.status, payload.reason)
    db.commit()
    db.refresh(inventory)
    return _inventory_read(inventory)


@app.post("/api/inventory/{inventory_id}/resale-review", response_model=ComponentInventoryRead, tags=["inventory"])
def review_resale(inventory_id: int, payload: InventoryReviewCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    inventory = _inventory_or_404(db, inventory_id)
    _review_inventory(inventory, "resale", payload.status, payload.reason)
    db.commit()
    db.refresh(inventory)
    return _inventory_read(inventory)


def _move_reserved_inventory(
    inventory_id: int,
    payload: InventoryQuantityChange,
    db: Session,
    action: str,
) -> dict[str, Any]:
    inventory = _inventory_or_404(db, inventory_id)
    if action == "reserve":
        latest = _latest_component_test(inventory.component)
        if inventory.reuse_status != "available" or not _inventory_review_current(inventory, "reuse"):
            raise HTTPException(status_code=409, detail="Review and approve this component for reuse before reserving quantity.")
        if latest is None or latest.result != "pass" or inventory.condition not in {"new", "like_new", "good"}:
            raise HTTPException(status_code=409, detail="Current test or physical condition evidence no longer supports reuse.")
        changed = db.query(ComponentInventory).filter(
            ComponentInventory.id == inventory_id,
            ComponentInventory.quantity_available >= payload.quantity,
            ComponentInventory.reuse_status == "available",
            ComponentInventory.reuse_reviewed_test_id == latest.id,
            ComponentInventory.reuse_reviewed_condition_at == inventory.condition_assessed_at,
        ).update({
            ComponentInventory.quantity_available: ComponentInventory.quantity_available - payload.quantity,
            ComponentInventory.quantity_reserved: ComponentInventory.quantity_reserved + payload.quantity,
            ComponentInventory.updated_at: utcnow(),
        }, synchronize_session=False)
        event_type = "reserved"
    elif action == "release":
        changed = db.query(ComponentInventory).filter(
            ComponentInventory.id == inventory_id,
            ComponentInventory.quantity_reserved >= payload.quantity,
        ).update({
            ComponentInventory.quantity_available: ComponentInventory.quantity_available + payload.quantity,
            ComponentInventory.quantity_reserved: ComponentInventory.quantity_reserved - payload.quantity,
            ComponentInventory.updated_at: utcnow(),
        }, synchronize_session=False)
        event_type = "released"
    else:
        latest = _latest_component_test(inventory.component)
        if (
            inventory.reuse_status != "available"
            or not _inventory_review_current(inventory, "reuse")
            or latest is None or latest.result != "pass"
            or inventory.condition not in {"new", "like_new", "good"}
        ):
            raise HTTPException(status_code=409, detail="Current test and condition evidence must support reuse before reserved stock can be marked used.")
        changed = db.query(ComponentInventory).filter(
            ComponentInventory.id == inventory_id,
            ComponentInventory.quantity_reserved >= payload.quantity,
        ).update({
            ComponentInventory.quantity_reserved: ComponentInventory.quantity_reserved - payload.quantity,
            ComponentInventory.quantity_used: ComponentInventory.quantity_used + payload.quantity,
            ComponentInventory.updated_at: utcnow(),
        }, synchronize_session=False)
        event_type = "used"
    if changed != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Requested quantity is not available for this inventory action.")
    db.add(ComponentInventoryEvent(
        inventory_id=inventory_id, event_type=event_type,
        quantity=payload.quantity, reason=payload.reason,
    ))
    db.commit()
    db.expire_all()
    return _inventory_read(_inventory_or_404(db, inventory_id))


@app.post("/api/inventory/{inventory_id}/reservations", response_model=ComponentInventoryRead, tags=["inventory"])
def reserve_inventory(inventory_id: int, payload: InventoryQuantityChange, db: Session = Depends(get_db)) -> dict[str, Any]:
    return _move_reserved_inventory(inventory_id, payload, db, "reserve")


@app.post("/api/inventory/{inventory_id}/reservations/release", response_model=ComponentInventoryRead, tags=["inventory"])
def release_inventory_reservation(inventory_id: int, payload: InventoryQuantityChange, db: Session = Depends(get_db)) -> dict[str, Any]:
    return _move_reserved_inventory(inventory_id, payload, db, "release")


@app.post("/api/inventory/{inventory_id}/reservations/use", response_model=ComponentInventoryRead, tags=["inventory"])
def use_inventory_reservation(inventory_id: int, payload: InventoryQuantityChange, db: Session = Depends(get_db)) -> dict[str, Any]:
    return _move_reserved_inventory(inventory_id, payload, db, "use")


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
    old_status = case.status
    if case.status == "new":
        case.status = "diagnosing"
        create_status_event(db, case, old_status, case.status)
    case.updated_at = utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    return {**serialize_recommendation(row, KNOWLEDGE_SOURCES), "similar_cases": similar}


@app.get("/api/cases/{case_id}/similar", tags=["memory"])
def similar_cases(case_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    return {"case_id": case.id, "matches": similar_repairs(db, case)}


@app.post("/api/cases/{case_id}/outcome", tags=["cases"])
def record_outcome(case_id: str, payload: RepairOutcomeCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    old_status = case.status
    case.confirmed_fault = payload.confirmed_fault.strip()
    case.repair_action = payload.repair_action.strip()
    case.outcome = payload.outcome.strip()
    case.status = payload.status
    case.updated_at = utcnow()
    create_status_event(db, case, old_status, case.status)
    db.add(RepairEvent(
        case_id=case.id,
        event_type="outcome_recorded",
        description="Repair outcome recorded.",
        details_json=json.dumps({
            "confirmed_fault": case.confirmed_fault,
            "repair_action": case.repair_action,
            "outcome": case.outcome,
        }),
    ))
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

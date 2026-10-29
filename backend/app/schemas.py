from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

CaseStatus = Literal["new", "diagnosing", "waiting_parts", "in_repair", "testing", "completed", "on_hold"]
Priority = Literal["low", "normal", "high", "urgent"]
TestStatus = Literal["pass", "fail", "inconclusive", "not_tested", "not_applicable"]
ConfidenceLabel = Literal["possible", "plausible", "less_likely"]
SafetyLevel = Literal["routine", "caution", "professional_only"]


class TestResultCreate(BaseModel):
    test_name: str = Field(min_length=2, max_length=180)
    result: TestStatus
    observed_result: str = Field(min_length=1, max_length=1500)
    details: str = Field(default="", max_length=1500)

    @field_validator("test_name", "observed_result")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty")
        return value


class TestResultRead(BaseModel):
    id: int
    case_id: str
    test_name: str
    result: str
    observed_result: str
    details: str
    performed_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RepairCaseCreate(BaseModel):
    device_category: str = Field(default="Smartphone", min_length=2, max_length=40)
    brand: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=100)
    issue_title: str = Field(min_length=4, max_length=160)
    symptoms: str = Field(min_length=5, max_length=3000)
    priority: Priority = "normal"
    status: CaseStatus = "new"
    customer_contact: str | None = Field(default=None, max_length=120)
    estimated_minutes: int | None = Field(default=None, ge=1, le=10000)
    estimate_cost: float | None = Field(default=None, ge=0, le=10000000)

    @field_validator("brand", "model", "issue_title", "symptoms")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty")
        return value


class RepairCaseUpdate(BaseModel):
    status: CaseStatus | None = None
    priority: Priority | None = None
    customer_contact: str | None = Field(default=None, max_length=120)
    estimated_minutes: int | None = Field(default=None, ge=1, le=10000)
    estimate_cost: float | None = Field(default=None, ge=0, le=10000000)


class RepairOutcomeCreate(BaseModel):
    confirmed_fault: str = Field(min_length=3, max_length=1500)
    repair_action: str = Field(min_length=3, max_length=2000)
    outcome: str = Field(min_length=3, max_length=1500)
    status: Literal["testing", "completed", "in_repair"] = "completed"


class CaseRead(BaseModel):
    id: str
    device_category: str
    brand: str
    model: str
    issue_title: str
    symptoms: str
    priority: str
    status: str
    customer_contact: str | None = None
    confirmed_fault: str | None = None
    repair_action: str | None = None
    outcome: str | None = None
    estimate_cost: float | None = None
    estimated_minutes: int | None = None
    data_origin: str
    created_at: datetime
    updated_at: datetime
    test_count: int = 0
    latest_recommendation_provider: str | None = None
    model_config = ConfigDict(from_attributes=True)


class Hypothesis(BaseModel):
    fault: str = Field(min_length=2, max_length=200)
    likelihood: ConfidenceLabel = "possible"
    supporting_evidence: list[str] = Field(default_factory=list, max_length=8)
    contradicting_evidence: list[str] = Field(default_factory=list, max_length=8)
    reasoning: str = Field(min_length=2, max_length=1000)


class NextCheck(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    purpose: str = Field(min_length=2, max_length=500)
    instructions: str = Field(min_length=2, max_length=900)
    what_to_record: str = Field(min_length=2, max_length=400)
    safety_level: SafetyLevel = "routine"


class RecommendationContent(BaseModel):
    summary: str = Field(min_length=2, max_length=1500)
    hypotheses: list[Hypothesis] = Field(default_factory=list, max_length=5)
    next_checks: list[NextCheck] = Field(default_factory=list, max_length=4)
    missing_information: list[str] = Field(default_factory=list, max_length=8)
    safety_notes: list[str] = Field(default_factory=list, max_length=8)
    source_ids: list[str] = Field(default_factory=list, max_length=10)
    limitations: list[str] = Field(default_factory=list, max_length=6)


class RecommendationRead(BaseModel):
    id: int | None = None
    case_id: str
    provider: str
    model_name: str
    generated_at: datetime | None = None
    content: RecommendationContent
    sources: list[dict[str, str | None]] = Field(default_factory=list)


class DashboardSummary(BaseModel):
    active_repairs: int
    ready_for_testing: int
    completed_this_week: int
    saved_cases: int
    needs_attention: int
    recent_cases: list[CaseRead]


class HealthRead(BaseModel):
    status: str
    app_name: str
    model_name: str
    model_configured: bool
    inference_mode: Literal["gemini_api", "rule_based_fallback"]
    note: str

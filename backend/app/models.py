from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class RepairCase(Base):
    __tablename__ = "repair_cases"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    device_category: Mapped[str] = mapped_column(String(40), default="Smartphone", index=True)
    brand: Mapped[str] = mapped_column(String(80), default="Unknown")
    model: Mapped[str] = mapped_column(String(100), default="Unknown")
    issue_title: Mapped[str] = mapped_column(String(160), index=True)
    symptoms: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(20), default="normal", index=True)
    status: Mapped[str] = mapped_column(String(30), default="new", index=True)
    customer_contact: Mapped[str | None] = mapped_column(String(120), nullable=True)
    confirmed_fault: Mapped[str | None] = mapped_column(Text, nullable=True)
    repair_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimate_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    data_origin: Mapped[str] = mapped_column(String(20), default="user_entered")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    tests: Mapped[list["TestResult"]] = relationship(back_populates="case", cascade="all, delete-orphan", order_by="TestResult.performed_at")
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="case", cascade="all, delete-orphan", order_by="Recommendation.created_at")
    components: Mapped[list["Component"]] = relationship(back_populates="case", cascade="all", order_by="Component.created_at")


class TestResult(Base):
    __tablename__ = "test_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("repair_cases.id", ondelete="CASCADE"), index=True)
    test_name: Mapped[str] = mapped_column(String(180))
    result: Mapped[str] = mapped_column(String(30), default="inconclusive")
    observed_result: Mapped[str] = mapped_column(Text, default="")
    details: Mapped[str] = mapped_column(Text, default="")
    performed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    case: Mapped[RepairCase] = relationship(back_populates="tests")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("repair_cases.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(30), default="rule_based")
    model_name: Mapped[str] = mapped_column(String(120), default="Revix rules")
    content_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    case: Mapped[RepairCase] = relationship(back_populates="recommendations")


class Component(Base):
    __tablename__ = "components"

    id: Mapped[str] = mapped_column(String(30), primary_key=True)  # e.g. "CMP-1001"
    name: Mapped[str] = mapped_column(String(160), index=True)
    part_number: Mapped[str] = mapped_column(String(100), default="", index=True)
    category: Mapped[str] = mapped_column(String(60), default="General", index=True)

    # Inventory quantities
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0)
    used_quantity: Mapped[int] = mapped_column(Integer, default=0)

    # Physical condition & Location
    condition: Mapped[str] = mapped_column(String(40), default="Good")  # Pristine, Good, Fair, Damaged, Refurbished
    location: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Association with Repair Case / Source Device
    case_id: Mapped[str | None] = mapped_column(ForeignKey("repair_cases.id", ondelete="SET NULL"), nullable=True, index=True)
    source_device: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Component Health Status (Evidence-based: working, faulty, needs_testing, unknown)
    health_status: Mapped[str] = mapped_column(String(30), default="needs_testing", index=True)
    test_evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    tested_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Reuse Management (eligible, reserved, consumed, ineligible)
    reuse_status: Mapped[str] = mapped_column(String(30), default="ineligible", index=True)
    reuse_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Resale Review Management (under_review, approved, not_eligible)
    resale_status: Mapped[str] = mapped_column(String(30), default="under_review", index=True)
    resale_decision: Mapped[str | None] = mapped_column(String(40), nullable=True)
    resale_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    resale_condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resale_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(80), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    case: Mapped[RepairCase | None] = relationship(back_populates="components")


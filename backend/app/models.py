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
    model_name: Mapped[str] = mapped_column(String(120), default="Fixora rules")
    content_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    case: Mapped[RepairCase] = relationship(back_populates="recommendations")

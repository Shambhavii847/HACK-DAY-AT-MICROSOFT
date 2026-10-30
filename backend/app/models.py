from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text
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
    events: Mapped[list["RepairEvent"]] = relationship(back_populates="case", cascade="all, delete-orphan", order_by="RepairEvent.occurred_at")
    components: Mapped[list["ComponentRecord"]] = relationship(back_populates="case", cascade="all, delete-orphan", order_by="ComponentRecord.created_at")


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


class ComponentRecord(Base):
    """A component noted during a repair; health is derived from its recorded tests."""
    __tablename__ = "component_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("repair_cases.id", ondelete="CASCADE"), index=True)
    component_name: Mapped[str] = mapped_column(String(160))
    model_part_number: Mapped[str | None] = mapped_column(String(160), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    case: Mapped[RepairCase] = relationship(back_populates="components")
    tests: Mapped[list["ComponentTestResult"]] = relationship(
        back_populates="component", cascade="all, delete-orphan",
        order_by=lambda: (ComponentTestResult.performed_at, ComponentTestResult.id),
    )
    inventory: Mapped["ComponentInventory | None"] = relationship(
        back_populates="component", cascade="all, delete-orphan", uselist=False,
    )


class ComponentTestResult(Base):
    __tablename__ = "component_test_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    component_id: Mapped[int] = mapped_column(ForeignKey("component_records.id", ondelete="CASCADE"), index=True)
    test_name: Mapped[str] = mapped_column(String(180))
    result: Mapped[str] = mapped_column(String(30), default="inconclusive")
    observed_result: Mapped[str] = mapped_column(Text, default="")
    details: Mapped[str] = mapped_column(Text, default="")
    performed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    component: Mapped[ComponentRecord] = relationship(back_populates="tests")


class ComponentInventory(Base):
    __tablename__ = "component_inventory"
    __table_args__ = (
        CheckConstraint("quantity_available >= 0", name="ck_inventory_available_nonnegative"),
        CheckConstraint("quantity_reserved >= 0", name="ck_inventory_reserved_nonnegative"),
        CheckConstraint("quantity_used >= 0", name="ck_inventory_used_nonnegative"),
        CheckConstraint("reuse_status IN ('under_review', 'available', 'not_eligible')", name="ck_inventory_reuse_status"),
        CheckConstraint("resale_status IN ('under_review', 'approved_for_resale', 'not_eligible')", name="ck_inventory_resale_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    component_id: Mapped[int] = mapped_column(ForeignKey("component_records.id", ondelete="CASCADE"), unique=True, index=True)
    quantity_available: Mapped[int] = mapped_column(Integer, default=0)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0)
    quantity_used: Mapped[int] = mapped_column(Integer, default=0)
    condition: Mapped[str] = mapped_column(String(30), default="unknown")
    condition_notes: Mapped[str] = mapped_column(Text, default="")
    condition_assessed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    storage_location: Mapped[str | None] = mapped_column(String(180), nullable=True)
    reuse_status: Mapped[str] = mapped_column(String(30), default="under_review")
    reuse_reason: Mapped[str] = mapped_column(Text, default="")
    reuse_reviewed_test_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reuse_reviewed_condition_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reuse_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resale_status: Mapped[str] = mapped_column(String(30), default="under_review")
    resale_reason: Mapped[str] = mapped_column(Text, default="")
    resale_reviewed_test_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resale_reviewed_condition_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resale_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, index=True)

    component: Mapped[ComponentRecord] = relationship(back_populates="inventory")
    events: Mapped[list["ComponentInventoryEvent"]] = relationship(
        back_populates="inventory", cascade="all, delete-orphan",
        order_by=lambda: (ComponentInventoryEvent.occurred_at, ComponentInventoryEvent.id),
    )


class ComponentInventoryEvent(Base):
    __tablename__ = "component_inventory_events"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_inventory_event_quantity_positive"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inventory_id: Mapped[int] = mapped_column(ForeignKey("component_inventory.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(30))
    quantity: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(500), default="")
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    inventory: Mapped[ComponentInventory] = relationship(back_populates="events")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("repair_cases.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(30), default="rule_based")
    model_name: Mapped[str] = mapped_column(String(120), default="Fixora rules")
    content_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    case: Mapped[RepairCase] = relationship(back_populates="recommendations")


class RepairEvent(Base):
    """Explicitly tracked repair events that cannot be reconstructed from current case state."""
    __tablename__ = "repair_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("repair_cases.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(40), index=True)
    description: Mapped[str] = mapped_column(String(500))
    details_json: Mapped[str] = mapped_column(Text, default="{}")
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    case: Mapped[RepairCase] = relationship(back_populates="events")

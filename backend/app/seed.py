from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from .models import RepairCase, TestResult, utcnow


def seed_demo_data(db: Session) -> None:
    if db.query(RepairCase).count() > 0:
        return

    now = utcnow()
    cases = [
        RepairCase(
            id="FX-1048", device_category="Smartphone", brand="Samsung", model="Galaxy A54",
            issue_title="Charging disconnects intermittently",
            symptoms="Charging drops when the cable shifts slightly. The customer reports no recent drop or liquid exposure. This is a fictional demo case.",
            priority="high", status="diagnosing", customer_reference="DEMO-048", assigned_to="Aarav",
            estimated_minutes=35, data_origin="demo", created_at=now - timedelta(hours=2), updated_at=now - timedelta(minutes=12),
        ),
        RepairCase(
            id="FX-1047", device_category="Smartphone", brand="OnePlus", model="Nord CE 3 Lite",
            issue_title="No charging indicator with original cable",
            symptoms="No charging indicator was reported with the customer's cable. A known-good cable was tried during this fictional demo and charging began.",
            priority="normal", status="testing", customer_reference="DEMO-047", assigned_to="Meera",
            confirmed_fault="Original cable appears faulty in this demo scenario", repair_action="Tested using a compatible known-good cable; replacement approval still required.",
            outcome="Charging indicator appeared during the observed check; final customer handover is pending.", estimated_minutes=20,
            data_origin="demo", created_at=now - timedelta(days=1, hours=3), updated_at=now - timedelta(hours=1),
        ),
        RepairCase(
            id="FX-1046", device_category="Smartphone", brand="Redmi", model="Note 12",
            issue_title="Charging is slower than expected",
            symptoms="Customer reports charging is slower than usual. Device-specific supported charging rate has not been verified. Fictional demo case.",
            priority="low", status="completed", customer_reference="DEMO-046", assigned_to="Kabir",
            confirmed_fault="External cable issue suspected and confirmed by technician in this fictional scenario",
            repair_action="Compared with a known-good compatible cable and replaced the customer's damaged cable after approval.",
            outcome="Charging behavior improved during the recorded observation; longer-term outcome was not measured.",
            estimated_minutes=25, estimate_cost=399, data_origin="demo", created_at=now - timedelta(days=3), updated_at=now - timedelta(days=2),
        ),
        RepairCase(
            id="FX-1045", device_category="Smartphone", brand="Google", model="Pixel 7a",
            issue_title="Charging stops after a few minutes",
            symptoms="The device reportedly begins charging and later stops. Cable, adapter, temperature, and port condition have not all been isolated. Fictional demo case.",
            priority="high", status="waiting_parts", customer_reference="DEMO-045", assigned_to="Aarav",
            confirmed_fault=None, repair_action=None, outcome=None, estimated_minutes=45,
            data_origin="demo", created_at=now - timedelta(days=2), updated_at=now - timedelta(hours=5),
        ),
        RepairCase(
            id="FX-1044", device_category="Smartphone", brand="Motorola", model="Edge 40 Neo",
            issue_title="Device gets warm during charging",
            symptoms="Customer reports unusual warmth while charging. Stop-and-escalate guidance should take precedence over further routine tests. Fictional demo case.",
            priority="urgent", status="on_hold", customer_reference="DEMO-044", assigned_to="Unassigned",
            estimated_minutes=15, data_origin="demo", created_at=now - timedelta(days=4), updated_at=now - timedelta(days=4),
        ),
    ]
    db.add_all(cases)
    db.flush()

    tests = [
        TestResult(case_id="FX-1048", test_name="Known-good compatible cable and adapter", result="fail", observed_result="Symptom still appears with the alternate cable/adapter set in this fictional demo.", details="Keep the observation separate from the fault hypothesis.", performed_at=now - timedelta(minutes=22)),
        TestResult(case_id="FX-1048", test_name="External visual inspection (device powered off)", result="pass", observed_result="No obvious debris or external damage seen under normal lighting.", details="A normal visual check cannot establish the internal condition of the connector.", performed_at=now - timedelta(minutes=12)),
        TestResult(case_id="FX-1047", test_name="Known-good compatible cable", result="pass", observed_result="Charging indicator appeared with the known-good cable.", details="Single-variable comparison in the demo scenario.", performed_at=now - timedelta(hours=2)),
        TestResult(case_id="FX-1047", test_name="Known-good compatible adapter", result="pass", observed_result="Adapter operated normally with another compatible device in this fictional scenario.", details="Demo observation only.", performed_at=now - timedelta(hours=1, minutes=30)),
        TestResult(case_id="FX-1046", test_name="Compare compatible known-good cable", result="pass", observed_result="Charging behavior improved after swapping the cable in this fictional scenario.", details="Outcome entered for demonstration; not a real repair record.", performed_at=now - timedelta(days=2, hours=1)),
        TestResult(case_id="FX-1044", test_name="Initial safety screening", result="inconclusive", observed_result="Customer reports unusual warmth; technician has placed the case on hold.", details="Do not continue routine charging tests until assessed by a qualified technician.", performed_at=now - timedelta(days=4)),
    ]
    db.add_all(tests)
    db.commit()

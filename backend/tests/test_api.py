import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, create_schema, get_db
from app.models import RepairCase, Recommendation, RepairEvent, TestResult as DiagnosticTestResult
from app.config import settings
from app.main import app

TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=TEST_ENGINE, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=TEST_ENGINE)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def no_external_model_calls(monkeypatch):
    # Tests must remain deterministic and never call an external API even if a local .env exists.
    monkeypatch.setattr(settings, "gemini_api_key", None)


def setup_function():
    Base.metadata.drop_all(bind=TEST_ENGINE)
    Base.metadata.create_all(bind=TEST_ENGINE)
    from app.seed import seed_demo_data
    with TestSession() as db:
        seed_demo_data(db)


def test_health_discloses_inference_mode():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["model_name"] == "gemma-4-26b-a4b-it"
        assert data["inference_mode"] in {"gemini_api", "rule_based_fallback"}


def test_dashboard_workload_counts_are_derived_once_per_case():
    with TestClient(app) as client:
        cases = client.get("/api/cases").json()
        tracked = [case for case in cases if case["data_origin"] != "demo"]
        dashboard = client.get("/api/dashboard")
        assert dashboard.status_code == 200
        data = dashboard.json()
        assert data["total_cases"] == len(tracked)
        assert data["pending_repairs"] == sum(case["status"] in {"new", "diagnosing", "waiting_parts", "on_hold"} for case in tracked)
        assert data["in_progress"] == sum(case["status"] in {"in_repair", "testing"} for case in tracked)
        assert data["completed_repairs"] == sum(case["status"] == "completed" for case in tracked)
        assert data["awaiting_diagnosis"] == sum(case["status"] in {"new", "diagnosing"} for case in tracked)
        assert data["total_cases"] == 0  # The seeded sample rows are explicitly marked as demo data.
        assert len({action["case_id"] for action in data["pending_actions"]}) == len(data["pending_actions"])


def test_demo_cases_are_explicitly_marked():
    with TestClient(app) as client:
        response = client.get("/api/cases")
        assert response.status_code == 200
        assert response.json()
        assert all(item["data_origin"] == "demo" for item in response.json())


def test_create_case_add_test_and_recommendation():
    with TestClient(app) as client:
        created = client.post("/api/cases", json={
            "device_category": "Smartphone",
            "brand": "TestBrand",
            "model": "Test One",
            "issue_title": "Phone does not charge",
            "symptoms": "The charging indicator does not appear with the current cable.",
            "priority": "normal",
        })
        assert created.status_code == 201, created.text
        case_id = created.json()["id"]
        assert created.json()["data_origin"] == "user_entered"

        test = client.post(f"/api/cases/{case_id}/tests", json={
            "test_name": "Known-good compatible cable",
            "result": "inconclusive",
            "observed_result": "Laptop charging issue is still present with the selected test setup. Charging indicator remains off. Further testing is required to identify the cause.",
            "details": "Tested with the selected cable setup; cause remains unknown.",
        })
        assert test.status_code == 201, test.text

        recommendation = client.post(f"/api/cases/{case_id}/recommendation")
        assert recommendation.status_code == 200, recommendation.text
        data = recommendation.json()
        assert data["case_id"] == case_id
        assert data["content"]["hypotheses"]
        assert data["content"]["next_checks"]
        assert "probability" not in data["content"]
        assert data["provider"] == "rule_based_fallback"
        assert data["content"]["evidence_test_ids"] == [test.json()["id"]]
        assert data["content"]["new_evidence_test_ids"] == [test.json()["id"]]
        assert data["content"]["previous_recommendation_id"] is None
        assert any(
            "inconclusive" in item.lower() and test.json()["observed_result"] in item
            for item in data["content"]["hypotheses"][0]["supporting_evidence"]
        )
        assert "cause not established" in data["content"]["hypotheses"][0]["fault"].lower()
        assert any("inconclusive" in item.lower() for item in data["content"]["missing_information"])
        assert all("known-good compatible cable" not in check["name"].lower() for check in data["content"]["next_checks"])
        serialized = client.get(f"/api/cases/{case_id}").json()
        assert len(serialized["tests"]) == 1
        assert serialized["tests"][0]["observed_result"] == test.json()["observed_result"]
        assert serialized["latest_recommendation"]["content"]["evidence_test_ids"] == [test.json()["id"]]

        # A later test belongs only to this repair and is explicitly tracked as new evidence.
        second = client.post(f"/api/cases/{case_id}/tests", json={
            "test_name": "Compatible adapter comparison",
            "result": "not_tested",
            "observed_result": "Not performed; awaiting an available adapter.",
            "details": "Awaiting an available adapter.",
        })
        assert second.status_code == 201, second.text
        persisted = client.get(f"/api/cases/{case_id}")
        assert persisted.status_code == 200
        assert {item["id"] for item in persisted.json()["tests"]} == {test.json()["id"], second.json()["id"]}
        assert persisted.json()["evidence_outdated"] is True
        dashboard = client.get("/api/dashboard").json()
        assert dashboard["evidence_to_review"] == sum(
            item["evidence_outdated"] for item in client.get("/api/cases").json() if item["data_origin"] != "demo"
        )
        assert any(action["case_id"] == case_id and action["title"] == "Review new evidence" for action in dashboard["pending_actions"])

        regenerated = client.post(f"/api/cases/{case_id}/recommendation")
        assert regenerated.status_code == 200, regenerated.text
        regenerated_data = regenerated.json()
        assert regenerated_data["content"]["evidence_test_ids"] == sorted([test.json()["id"], second.json()["id"]])
        assert regenerated_data["content"]["new_evidence_test_ids"] == [second.json()["id"]]
        assert regenerated_data["content"]["previous_recommendation_id"] == data["id"]
        assert client.get(f"/api/cases/{case_id}").json()["evidence_outdated"] is False

        other_case = client.post("/api/cases", json={
            "device_category": "Laptop",
            "brand": "OtherBrand",
            "model": "Other Model",
            "issue_title": "Keyboard is unresponsive",
            "symptoms": "Several keys do not respond.",
            "priority": "normal",
        })
        assert other_case.status_code == 201, other_case.text
        other_test = client.post(f"/api/cases/{other_case.json()['id']}/tests", json={
            "test_name": "External keyboard comparison",
            "result": "pass",
            "observed_result": "External keyboard input works as expected.",
            "details": "Compared on the same laptop.",
        })
        assert other_test.status_code == 201, other_test.text
        other_recommendation = client.post(f"/api/cases/{other_case.json()['id']}/recommendation")
        assert other_recommendation.status_code == 200, other_recommendation.text
        assert other_recommendation.json()["content"]["evidence_test_ids"] == [other_test.json()["id"]]
        assert test.json()["id"] not in other_recommendation.json()["content"]["evidence_test_ids"]


def test_component_health_is_derived_from_component_test_evidence():
    with TestClient(app) as client:
        created = client.post("/api/cases", json={
            "device_category": "Laptop", "brand": "EvidenceBrand", "model": "Model C",
            "issue_title": "Display issue", "symptoms": "The display intermittently goes blank.",
        })
        assert created.status_code == 201
        case_id = created.json()["id"]

        component = client.post(f"/api/cases/{case_id}/components", json={
            "component_name": "Display cable", "model_part_number": "DC-100",
        })
        assert component.status_code == 201, component.text
        record = component.json()
        assert record["health_status"] == "unknown"
        assert record["tests"] == []
        assert record["case_id"] == case_id

        # Clients cannot assign health directly, including an unsupported claim of Working.
        rejected_override = client.post(f"/api/cases/{case_id}/components", json={
            "component_name": "Second cable", "health_status": "working",
        })
        assert rejected_override.status_code == 422

        evidence = {
            "test_name": "Continuity check",
            "result": "pass",
            "observed_result": "Continuity measured within the manufacturer's specified range.",
            "details": "Meter and test conditions recorded by technician.",
        }
        tested = client.post(f"/api/cases/{case_id}/components/{record['id']}/tests", json=evidence)
        assert tested.status_code == 200, tested.text
        assert tested.json()["health_status"] == "working"
        assert tested.json()["tests"][0]["observed_result"] == evidence["observed_result"]
        assert tested.json()["tests"][0]["details"] == evidence["details"]

        evidence["result"] = "inconclusive"
        evidence["observed_result"] = "Reading fluctuated; no conclusion can be drawn."
        needs_testing = client.post(f"/api/cases/{case_id}/components/{record['id']}/tests", json=evidence)
        assert needs_testing.status_code == 200
        assert needs_testing.json()["health_status"] == "needs_testing"

        evidence["result"] = "fail"
        evidence["observed_result"] = "No continuity under the recorded test conditions."
        faulty = client.post(f"/api/cases/{case_id}/components/{record['id']}/tests", json=evidence)
        assert faulty.status_code == 200
        assert faulty.json()["health_status"] == "faulty"
        assert len(faulty.json()["tests"]) == 3

        detail = client.get(f"/api/cases/{case_id}")
        assert detail.status_code == 200
        assert detail.json()["components"][0]["health_status"] == "faulty"
        assert len(detail.json()["components"][0]["tests"]) == 3
        listed = client.get(f"/api/cases/{case_id}/components")
        assert listed.status_code == 200
        assert listed.json()[0]["id"] == record["id"]


def test_component_tests_cannot_be_attached_to_another_repair():
    with TestClient(app) as client:
        case_ids = []
        for brand in ("ComponentOne", "ComponentTwo"):
            response = client.post("/api/cases", json={
                "device_category": "Laptop", "brand": brand, "model": "M1",
                "issue_title": "Port check", "symptoms": "Port requires inspection.",
            })
            assert response.status_code == 201
            case_ids.append(response.json()["id"])
        component = client.post(f"/api/cases/{case_ids[0]}/components", json={"component_name": "USB port"})
        assert component.status_code == 201
        response = client.post(f"/api/cases/{case_ids[1]}/components/{component.json()['id']}/tests", json={
            "test_name": "Visual inspection", "result": "pass", "observed_result": "No visible damage found.",
        })
        assert response.status_code == 404


def test_component_tables_are_added_without_losing_existing_repair_rows():
    upgrade_engine = create_engine("sqlite://")
    legacy_tables = [RepairCase.__table__, DiagnosticTestResult.__table__, Recommendation.__table__, RepairEvent.__table__]
    Base.metadata.create_all(bind=upgrade_engine, tables=legacy_tables)
    OldSession = sessionmaker(bind=upgrade_engine)
    with OldSession() as db:
        db.add(RepairCase(
            id="FX-OLD", device_category="Laptop", brand="Existing", model="Saved device",
            issue_title="Existing repair", symptoms="Preserve these old case details.",
        ))
        db.commit()

    create_schema(bind=upgrade_engine)

    tables = set(inspect(upgrade_engine).get_table_names())
    assert "component_records" in tables
    assert "component_test_results" in tables
    assert "component_inventory" in tables
    assert "component_inventory_events" in tables
    with upgrade_engine.connect() as conn:
        preserved = conn.execute(text("SELECT id, symptoms FROM repair_cases WHERE id = 'FX-OLD'")).one()
    assert preserved == ("FX-OLD", "Preserve these old case details.")
    upgrade_engine.dispose()


def create_inventory_test_component(client, brand="InventoryBrand"):
    case = client.post("/api/cases", json={
        "device_category": "Laptop", "brand": brand, "model": "Inventory Model",
        "issue_title": "Component inventory test", "symptoms": "Component needs evaluation.",
    })
    assert case.status_code == 201, case.text
    component = client.post(f"/api/cases/{case.json()['id']}/components", json={
        "component_name": "Power module", "model_part_number": "PM-100",
    })
    assert component.status_code == 201, component.text
    return case.json(), component.json()


def test_inventory_validation_and_negative_quantity_protection():
    with TestClient(app) as client:
        case, component = create_inventory_test_component(client)
        invalid = client.post(f"/api/components/{component['id']}/inventory", json={
            "quantity_available": 0, "condition": "good", "condition_notes": "Visual check complete.",
        })
        assert invalid.status_code == 422

        created = client.post(f"/api/components/{component['id']}/inventory", json={
            "quantity_available": 2, "condition": "good", "condition_notes": "No visible damage observed.",
            "storage_location": "Bin A3",
        })
        assert created.status_code == 201, created.text
        record = created.json()
        assert record["case_id"] == case["id"]
        assert record["source_device"] == "InventoryBrand Inventory Model"
        assert record["quantity_available"] == 2
        assert record["health_status"] == "unknown"
        assert record["reuse_status"] == "under_review"
        assert record["resale_status"] == "under_review"

        bad_reuse = client.post(f"/api/inventory/{record['id']}/reuse-review", json={
            "status": "available", "reason": "Reviewed for future repair use.",
        })
        assert bad_reuse.status_code == 409
        bad_resale = client.post(f"/api/inventory/{record['id']}/resale-review", json={
            "status": "approved_for_resale", "reason": "Reviewed for internal resale consideration.",
        })
        assert bad_resale.status_code == 409

        negative = client.post(f"/api/inventory/{record['id']}/stock-adjustments", json={
            "quantity_delta": -3, "reason": "Count correction.",
        })
        assert negative.status_code == 409
        unchanged = client.get("/api/inventory").json()
        assert unchanged[0]["quantity_available"] == 2
        assert client.post(f"/api/inventory/{record['id']}/stock-adjustments", json={
            "quantity_delta": 0, "reason": "No quantity change.",
        }).status_code == 422


def test_reuse_requires_passing_test_and_tracks_reserved_used_and_released_stock():
    with TestClient(app) as client:
        case, component = create_inventory_test_component(client)
        evidence = client.post(f"/api/cases/{case['id']}/components/{component['id']}/tests", json={
            "test_name": "Power module output test", "result": "pass",
            "observed_result": "Output measured within the documented expected range.",
            "details": "Recorded at the specified test points.",
        })
        assert evidence.status_code == 200
        created = client.post(f"/api/components/{component['id']}/inventory", json={
            "quantity_available": 4, "condition": "good", "condition_notes": "No cracks or heat discoloration observed.",
        })
        assert created.status_code == 201
        inventory_id = created.json()["id"]

        approved = client.post(f"/api/inventory/{inventory_id}/reuse-review", json={
            "status": "available", "reason": "Passing output test and good physical condition reviewed.",
        })
        assert approved.status_code == 200, approved.text
        assert approved.json()["reuse_status"] == "available"

        reserved = client.post(f"/api/inventory/{inventory_id}/reservations", json={
            "quantity": 2, "reason": "Reserved for repair FX-TEST.",
        })
        assert reserved.status_code == 200, reserved.text
        assert (reserved.json()["quantity_available"], reserved.json()["quantity_reserved"], reserved.json()["quantity_used"]) == (2, 2, 0)

        used = client.post(f"/api/inventory/{inventory_id}/reservations/use", json={
            "quantity": 1, "reason": "Installed in the recorded repair.",
        })
        assert used.status_code == 200
        assert (used.json()["quantity_available"], used.json()["quantity_reserved"], used.json()["quantity_used"]) == (2, 1, 1)

        released = client.post(f"/api/inventory/{inventory_id}/reservations/release", json={
            "quantity": 1, "reason": "Repair plan changed; returned to stock.",
        })
        assert released.status_code == 200
        assert (released.json()["quantity_available"], released.json()["quantity_reserved"], released.json()["quantity_used"]) == (3, 0, 1)
        assert [event["event_type"] for event in released.json()["events"]] == ["reserved", "used", "released"]

        over_reserve = client.post(f"/api/inventory/{inventory_id}/reservations", json={
            "quantity": 4, "reason": "Requested count exceeds remaining stock.",
        })
        assert over_reserve.status_code == 409
        persisted = client.get("/api/inventory").json()[0]
        assert persisted["quantity_available"] == 3
        assert persisted["quantity_used"] == 1


def test_resale_requires_explicit_review_and_fresh_test_and_condition_evidence():
    with TestClient(app) as client:
        case, component = create_inventory_test_component(client)
        created = client.post(f"/api/components/{component['id']}/inventory", json={
            "quantity_available": 1, "condition": "damaged", "condition_notes": "Cracked casing observed.",
        })
        assert created.status_code == 201
        inventory_id = created.json()["id"]

        untested_approval = client.post(f"/api/inventory/{inventory_id}/resale-review", json={
            "status": "approved_for_resale", "reason": "Requested approval before testing.",
        })
        assert untested_approval.status_code == 409
        assert client.post(f"/api/inventory/{inventory_id}/resale-review", json={
            "status": "not_eligible", "reason": "Damage is recorded; not suitable for resale.",
        }).status_code == 200

        passed = client.post(f"/api/cases/{case['id']}/components/{component['id']}/tests", json={
            "test_name": "Functional output test", "result": "pass",
            "observed_result": "Output measured within the documented range.",
        })
        assert passed.status_code == 200
        still_damaged = client.post(f"/api/inventory/{inventory_id}/resale-review", json={
            "status": "approved_for_resale", "reason": "Passing test but recorded damage remains.",
        })
        assert still_damaged.status_code == 409

        updated = client.patch(f"/api/inventory/{inventory_id}", json={
            "condition": "good", "condition_notes": "Inspected; no visible damage found.",
            "storage_location": "Shelf B2",
        })
        assert updated.status_code == 200
        assert updated.json()["resale_status"] == "under_review"
        assert updated.json()["reuse_status"] == "under_review"

        approved = client.post(f"/api/inventory/{inventory_id}/resale-review", json={
            "status": "approved_for_resale", "reason": "Passing test and updated physical condition reviewed.",
        })
        assert approved.status_code == 200, approved.text
        assert approved.json()["resale_status"] == "approved_for_resale"
        assert approved.json()["resale_reviewed_at"]

        inconclusive = client.post(f"/api/cases/{case['id']}/components/{component['id']}/tests", json={
            "test_name": "Follow-up test", "result": "inconclusive",
            "observed_result": "Follow-up reading did not support a conclusion.",
        })
        assert inconclusive.status_code == 200
        refreshed = client.get("/api/inventory").json()[0]
        assert refreshed["health_status"] == "needs_testing"
        assert refreshed["resale_status"] == "under_review"
        assert refreshed["reuse_status"] == "under_review"
        assert client.get("/api/inventory?resale_status=under_review").json()


def test_demo_components_cannot_enter_real_inventory():
    with TestClient(app) as client:
        demo_case = next(item for item in client.get("/api/cases").json() if item["data_origin"] == "demo")
        detail = client.get(f"/api/cases/{demo_case['id']}").json()
        component_response = client.post(f"/api/cases/{demo_case['id']}/components", json={"component_name": "Sample part"})
        assert component_response.status_code == 201
        blocked = client.post(f"/api/components/{component_response.json()['id']}/inventory", json={
            "quantity_available": 1, "condition": "good", "condition_notes": "Visual check complete.",
        })
        assert blocked.status_code == 409


def test_safety_case_gets_stop_and_escalate_guidance():
    with TestClient(app) as client:
        created = client.post("/api/cases", json={
            "device_category": "Smartphone",
            "brand": "TestBrand",
            "model": "Hot Phone",
            "issue_title": "Phone gets unusually hot while charging",
            "symptoms": "The device becomes hot while plugged in.",
            "priority": "urgent",
        })
        assert created.status_code == 201
        recommendation = client.post(f"/api/cases/{created.json()['id']}/recommendation")
        assert recommendation.status_code == 200
        body = recommendation.json()
        names = [check["name"] for check in body["content"]["next_checks"]]
        assert body["content"]["evidence_test_ids"] == []
        assert any("no diagnostic test results" in item.lower() for item in body["content"]["missing_information"])
        assert body["provider"] == "rule_based_fallback"
        assert any("safety" in name.lower() or "escalate" in name.lower() for name in names)


def test_invalid_case_returns_404():
    with TestClient(app) as client:
        response = client.get("/api/cases/FX-DOES-NOT-EXIST")
        assert response.status_code == 404


def test_case_cannot_be_completed_without_confirmed_outcome():
    with TestClient(app) as client:
        created = client.post("/api/cases", json={
            "device_category": "Smartphone",
            "brand": "TestBrand",
            "model": "Unverified",
            "issue_title": "Phone does not charge",
            "symptoms": "Charging indicator does not appear.",
            "priority": "normal",
        })
        assert created.status_code == 201
        response = client.patch(f"/api/cases/{created.json()['id']}", json={"status": "completed"})
        assert response.status_code == 409
        assert "confirmed fault" in response.json()["detail"]


def test_delete_case():
    with TestClient(app) as client:
        created = client.post("/api/cases", json={
            "device_category": "Smartphone",
            "brand": "DeleteBrand",
            "model": "DeleteModel",
            "issue_title": "To be deleted",
            "symptoms": "Temporary device to delete.",
            "priority": "low",
        })
        assert created.status_code == 201
        case_id = created.json()["id"]

        del_resp = client.delete(f"/api/cases/{case_id}")
        assert del_resp.status_code == 200
        assert del_resp.json()["deleted"] == case_id

        get_resp = client.get(f"/api/cases/{case_id}")
        assert get_resp.status_code == 404


def test_timeline_uses_saved_records_and_tracks_future_status_changes():
    with TestClient(app) as client:
        created = client.post("/api/cases", json={
            "device_category": "Laptop", "brand": "TimelineBrand", "model": "Timeline 1",
            "issue_title": "Laptop will not start", "symptoms": "The power indicator remains off.", "priority": "normal",
        })
        assert created.status_code == 201
        case_id = created.json()["id"]
        initial = client.get(f"/api/cases/{case_id}").json()["timeline"]
        assert [item["event_type"] for item in initial] == ["case_created", "symptoms_recorded"]

        assert client.patch(f"/api/cases/{case_id}", json={"status": "diagnosing"}).status_code == 200
        assert client.patch(f"/api/cases/{case_id}", json={"status": "diagnosing"}).status_code == 200
        test = client.post(f"/api/cases/{case_id}/tests", json={
            "test_name": "External power check", "result": "inconclusive",
            "observed_result": "No indicator was observed during this check.", "details": "Adapter model not recorded.",
        })
        assert test.status_code == 201
        recommendation = client.post(f"/api/cases/{case_id}/recommendation")
        assert recommendation.status_code == 200
        timeline = client.get(f"/api/cases/{case_id}").json()["timeline"]
        types = [item["event_type"] for item in timeline]
        assert types.count("status_changed") == 1
        assert "diagnostic_test" in types
        assert "recommendation_generated" in types
        assert timeline == sorted(timeline, key=lambda item: (item["happened_at"], item["id"]))
        test_event = next(item for item in timeline if item["event_type"] == "diagnostic_test")
        assert test.json()["observed_result"] in test_event["description"]


def test_similar_memory_is_explainable_and_not_a_current_diagnosis():
    with TestClient(app) as client:
        previous = client.post("/api/cases", json={
            "device_category": "Laptop", "brand": "MemoryBrand", "model": "M1",
            "issue_title": "Laptop will not charge", "symptoms": "Charging indicator remains off with the original adapter.", "priority": "normal",
        })
        assert previous.status_code == 201
        previous_id = previous.json()["id"]
        assert client.post(f"/api/cases/{previous_id}/tests", json={
            "test_name": "Known-good adapter comparison", "result": "pass",
            "observed_result": "Indicator appeared using the comparison adapter.", "details": "Single variable changed.",
        }).status_code == 201
        assert client.post(f"/api/cases/{previous_id}/outcome", json={
            "confirmed_fault": "Original adapter fault confirmed by technician",
            "repair_action": "Adapter replaced after approval", "outcome": "Charging verified with replacement.", "status": "completed",
        }).status_code == 200

        current = client.post("/api/cases", json={
            "device_category": "Laptop", "brand": "MemoryBrand", "model": "M2",
            "issue_title": "Laptop will not charge", "symptoms": "Charging indicator remains off with this adapter.", "priority": "normal",
        })
        matches = client.get(f"/api/cases/{current.json()['id']}").json()["similar_cases"]
        match = next(item for item in matches if item["id"] == previous_id)
        assert match["status"] == "completed"
        assert match["tests"][0]["test_name"] == "Known-good adapter comparison"
        assert match["match_reasons"]
        assert "not a diagnosis" in match["disclaimer"].lower()
        assert match["id"] != current.json()["id"]


def test_safety_alerts_only_follow_non_negated_recorded_conditions():
    with TestClient(app) as client:
        safe = client.post("/api/cases", json={
            "device_category": "Laptop", "brand": "SafetyBrand", "model": "Safe",
            "issue_title": "No charging issue", "symptoms": "No unusual heat, no battery swelling, and no smoke were observed.", "priority": "normal",
        })
        assert client.get(f"/api/cases/{safe.json()['id']}").json()["safety_alerts"] == []

        hazard = client.post("/api/cases", json={
            "device_category": "Laptop", "brand": "SafetyBrand", "model": "Alert",
            "issue_title": "Battery swelling reported", "symptoms": "Technician observed battery swelling and unusual heat.", "priority": "urgent",
        })
        detail = client.get(f"/api/cases/{hazard.json()['id']}").json()
        assert {alert["title"] for alert in detail["safety_alerts"]} == {"Possible battery swelling", "Possible overheating"}
        assert all("not a confirmed" in alert["disclaimer"].lower() for alert in detail["safety_alerts"])


def test_detail_contains_actual_report_fields_without_fabricated_outcome():
    with TestClient(app) as client:
        created = client.post("/api/cases", json={
            "device_category": "Tablet", "brand": "ReportBrand", "model": "R-10",
            "issue_title": "Screen flickers", "symptoms": "Display flickers after waking.", "priority": "normal",
        })
        detail = client.get(f"/api/cases/{created.json()['id']}").json()
        assert detail["brand"] == "ReportBrand"
        assert detail["symptoms"] == "Display flickers after waking."
        assert detail["confirmed_fault"] is None
        assert detail["repair_action"] is None
        assert detail["outcome"] is None
        assert detail["tests"] == []

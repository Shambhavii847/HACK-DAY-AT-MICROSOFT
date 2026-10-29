import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
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

        regenerated = client.post(f"/api/cases/{case_id}/recommendation")
        assert regenerated.status_code == 200, regenerated.text
        regenerated_data = regenerated.json()
        assert regenerated_data["content"]["evidence_test_ids"] == sorted([test.json()["id"], second.json()["id"]])
        assert regenerated_data["content"]["new_evidence_test_ids"] == [second.json()["id"]]
        assert regenerated_data["content"]["previous_recommendation_id"] == data["id"]

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

import pytest
from fastapi.testclient import TestClient
from app.main import app


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
            "observed_result": "Not tried yet; technician notes the check is pending.",
            "details": "No test performed yet.",
        })
        assert test.status_code == 201, test.text

        recommendation = client.post(f"/api/cases/{case_id}/recommendation")
        assert recommendation.status_code == 200, recommendation.text
        data = recommendation.json()
        assert data["case_id"] == case_id
        assert data["content"]["hypotheses"]
        assert data["content"]["next_checks"]
        assert "probability" not in data["content"]


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
        names = [check["name"] for check in recommendation.json()["content"]["next_checks"]]
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


def test_language_recommendation_and_voice_briefing():
    with TestClient(app) as client:
        created = client.post("/api/cases", json={
            "device_category": "Smartphone",
            "brand": "Samsung",
            "model": "Galaxy A54",
            "issue_title": "Intermittent charging",
            "symptoms": "Charges only when cable is angled.",
            "priority": "normal",
        })
        assert created.status_code == 201
        case_id = created.json()["id"]

        # Test Hindi recommendation
        hi_rec = client.post(f"/api/cases/{case_id}/recommendation?language=hi")
        assert hi_rec.status_code == 200
        hi_data = hi_rec.json()
        assert "डायग्नोस्टिक" in hi_data["content"]["summary"] or "के लिए" in hi_data["content"]["summary"]

        # Test Hinglish recommendation
        latn_rec = client.post(f"/api/cases/{case_id}/recommendation?language=hi-Latn")
        assert latn_rec.status_code == 200

        # Test Hindi voice briefing
        hi_voice = client.post(f"/api/cases/{case_id}/voice-briefing?language=hi")
        assert hi_voice.status_code == 200
        assert "briefing_text" in hi_voice.json()
        assert hi_voice.json()["language"] == "hi"

        # Test Hinglish voice briefing
        latn_voice = client.post(f"/api/cases/{case_id}/voice-briefing?language=hi-Latn")
        assert latn_voice.status_code == 200
        assert "briefing_text" in latn_voice.json()
        assert latn_voice.json()["language"] == "hi-Latn"

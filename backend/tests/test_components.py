import pytest
from fastapi.testclient import TestClient
from app.main import app


def test_list_components_and_summary():
    with TestClient(app) as client:
        res = client.get("/api/components")
        assert res.status_code == 200
        items = res.json()
        assert len(items) >= 6
        assert any(c["id"] == "CMP-1001" for c in items)

        summary_res = client.get("/api/components/summary")
        assert summary_res.status_code == 200
        summary = summary_res.json()
        assert summary["total_components"] >= 6
        assert summary["working_count"] >= 3
        assert summary["faulty_count"] >= 1
        assert summary["needs_testing_count"] >= 1
        assert summary["resale_approved_count"] >= 1


def test_create_component_inventory_validation():
    with TestClient(app) as client:
        # Create valid working component with evidence
        res = client.post("/api/components", json={
            "name": "Audio Codec IC",
            "part_number": "CS42L73-CRZ",
            "category": "Audio / Haptics",
            "quantity": 5,
            "condition": "Pristine",
            "location": "Bench Box A",
            "health_status": "working",
            "test_evidence": "I2S digital audio clock and output lines confirmed with scope probe.",
        })
        assert res.status_code == 201
        data = res.json()
        assert data["id"].startswith("CMP-")
        assert data["quantity"] == 5
        assert data["health_status"] == "working"
        assert data["is_reuse_eligible"] is True
        assert data["reuse_status"] == "eligible"
        # Never automatically approved for resale
        assert data["resale_status"] == "under_review"

        # Create untested component - must NOT be marked reuse-eligible
        untested_res = client.post("/api/components", json={
            "name": "Untested Logic Board Section",
            "part_number": "MLB-UNKNOWN",
            "category": "Mainboard",
            "quantity": 2,
            "condition": "Good",
            "health_status": "needs_testing",
        })
        assert untested_res.status_code == 201
        untested_data = untested_res.json()
        assert untested_data["is_reuse_eligible"] is False
        assert untested_data["reuse_status"] == "ineligible"
        assert untested_data["resale_status"] == "under_review"


def test_quantity_updates_prevent_negative():
    with TestClient(app) as client:
        # Prevent negative quantity in update
        bad_update = client.patch("/api/components/CMP-1001", json={"quantity": -5})
        assert bad_update.status_code in (400, 422)

        # Valid update
        good_update = client.patch("/api/components/CMP-1001", json={"quantity": 10})
        assert good_update.status_code == 200
        assert good_update.json()["quantity"] == 10


def test_reuse_reserve_use_release_workflow():
    with TestClient(app) as client:
        # CMP-1002 is working with test evidence (Super AMOLED screen, qty=1, reserved=0)
        # 1. Reserve 1 unit
        reserve_res = client.post("/api/components/CMP-1002/reuse", json={
            "action": "reserve",
            "quantity": 1,
            "case_id": "FX-1047",
            "notes": "Reserved for screen replacement",
        })
        assert reserve_res.status_code == 200
        comp = reserve_res.json()
        assert comp["quantity"] == 0
        assert comp["reserved_quantity"] == 1
        assert comp["reuse_status"] == "reserved"

        # 2. Cannot reserve more than available
        over_reserve = client.post("/api/components/CMP-1002/reuse", json={
            "action": "reserve",
            "quantity": 1,
        })
        assert over_reserve.status_code == 400
        assert "insufficient" in over_reserve.json()["detail"].lower()

        # 3. Release reservation
        release_res = client.post("/api/components/CMP-1002/reuse", json={
            "action": "release",
            "quantity": 1,
            "notes": "Customer cancelled repair",
        })
        assert release_res.status_code == 200
        released = release_res.json()
        assert released["quantity"] == 1
        assert released["reserved_quantity"] == 0
        assert released["reuse_status"] == "eligible"

        # 4. Cannot release more than reserved
        over_release = client.post("/api/components/CMP-1002/reuse", json={
            "action": "release",
            "quantity": 5,
        })
        assert over_release.status_code == 400

        # 5. Consume in repair
        use_res = client.post("/api/components/CMP-1002/reuse", json={
            "action": "use",
            "quantity": 1,
            "case_id": "FX-1047",
            "notes": "Installed display panel",
        })
        assert use_res.status_code == 200
        used = use_res.json()
        assert used["quantity"] == 0
        assert used["used_quantity"] == 1
        assert used["reuse_status"] == "consumed"


def test_ineligible_components_cannot_be_reserved_or_reused():
    with TestClient(app) as client:
        # CMP-1004 is a damaged battery with health_status='faulty'
        bad_reserve = client.post("/api/components/CMP-1004/reuse", json={
            "action": "reserve",
            "quantity": 1,
        })
        assert bad_reserve.status_code == 400
        assert "cannot be reserved" in bad_reserve.json()["detail"].lower()

        # CMP-1003 is PMIC needing testing
        untested_reserve = client.post("/api/components/CMP-1003/reuse", json={
            "action": "reserve",
            "quantity": 1,
        })
        assert untested_reserve.status_code == 400


def test_resale_approval_safeguards():
    with TestClient(app) as client:
        # Safeguard 1: Cannot approve an untested component (CMP-1003 has health_status='needs_testing')
        untested_review = client.post("/api/components/CMP-1003/resale-review", json={
            "resale_status": "approved",
            "review_reason": "Looks shiny on visual inspection",
            "resale_price": 25.0,
        })
        assert untested_review.status_code == 400
        assert "health status is 'needs_testing'" in untested_review.json()["detail"].lower()

        # Safeguard 2: Cannot approve a faulty component (CMP-1004)
        faulty_review = client.post("/api/components/CMP-1004/resale-review", json={
            "resale_status": "approved",
            "review_reason": "Someone might want it for parts",
            "resale_price": 5.0,
        })
        assert faulty_review.status_code == 400
        assert "faulty" in faulty_review.json()["detail"].lower()

        # Safeguard 3: Cannot approve damaged component (CMP-1004 is Damaged)
        damaged_review = client.post("/api/components/CMP-1004/resale-review", json={
            "resale_status": "approved",
            "review_reason": "Attempting to approve damaged battery",
            "resale_price": 10.0,
        })
        assert damaged_review.status_code == 400
        assert "damaged" in damaged_review.json()["detail"].lower() or "faulty" in damaged_review.json()["detail"].lower()

        # Valid approval: CMP-1005 is Working with verified coil resistance test evidence
        valid_review = client.post("/api/components/CMP-1005/resale-review", json={
            "resale_status": "approved",
            "review_reason": "Bench frequency sweep and coil resistance strictly within OEM tolerances.",
            "review_condition": "A-Grade Working",
            "resale_price": 14.50,
            "reviewed_by": "Senior Hardware Technician",
        })
        assert valid_review.status_code == 200
        approved_comp = valid_review.json()
        assert approved_comp["resale_status"] == "approved"
        assert approved_comp["resale_decision"] == "Approved for Resale"
        assert approved_comp["resale_price"] == 14.50
        assert approved_comp["reviewed_by"] == "Senior Hardware Technician"

        # If condition subsequently becomes damaged or faulty, approval is revoked
        degrade_update = client.patch("/api/components/CMP-1005", json={
            "condition": "Damaged",
            "health_status": "faulty",
        })
        assert degrade_update.status_code == 200
        revoked = degrade_update.json()
        assert revoked["resale_status"] == "not_eligible"
        assert revoked["is_reuse_eligible"] is False


def test_gemma_acceleration_setting():
    with TestClient(app) as client:
        # Default engine is Gemma 4, with allow_acceleration=True or False
        res = client.post("/api/cases/FX-1048/recommendation?engine=gemma-4&allow_acceleration=false")
        assert res.status_code == 200
        data = res.json()
        assert data["content"]["hypotheses"]
        # Since API key is None in test, falls back to conservative rules
        assert "rule" in data["provider"].lower()


def test_component_health_evidence_requirement():
    with TestClient(app) as client:
        # Creating working/faulty component without evidence must fail (Phase 1 safeguard)
        res_no_ev = client.post("/api/components", json={
            "name": "Unproven PMIC",
            "health_status": "working",
            "condition": "Good",
        })
        assert res_no_ev.status_code == 400
        assert "actual recorded evidence" in res_no_ev.json()["detail"].lower()

        # Needs testing does not require test evidence initially
        res_untested = client.post("/api/components", json={
            "name": "Incoming USB Port",
            "health_status": "needs_testing",
            "condition": "Good",
        })
        assert res_untested.status_code == 201


def test_case_component_health_tracking():
    with TestClient(app) as client:
        # 1. Create case with suspected component on intake
        case_res = client.post("/api/cases", json={
            "device_category": "Smartphone",
            "brand": "Google",
            "model": "Pixel 8",
            "issue_title": "No display backlight",
            "symptoms": "Phone boots with haptic feedback but screen stays black.",
            "priority": "high",
            "suspected_component": "AMOLED Display Flex Cable",
        })
        assert case_res.status_code == 201
        case_data = case_res.json()
        case_id = case_data["id"]

        # 2. Get case detail - should include the tracked component
        detail_res = client.get(f"/api/cases/{case_id}")
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert len(detail["components"]) == 1
        assert detail["components"][0]["name"] == "AMOLED Display Flex Cable"
        assert detail["components"][0]["health_status"] == "needs_testing"

        # 3. Add another component directly to the case
        add_comp = client.post(f"/api/cases/{case_id}/components", json={
            "name": "Backlight Boost Driver IC",
            "part_number": "LM3697",
            "category": "Display",
            "health_status": "working",
            "test_evidence": "Boost output reads 22.4V with PWM duty cycle verified on scope.",
            "condition": "Pristine",
        })
        assert add_comp.status_code == 201
        assert add_comp.json()["case_id"] == case_id

        # 4. Check case components endpoint
        comps_res = client.get(f"/api/cases/{case_id}/components")
        assert comps_res.status_code == 200
        assert len(comps_res.json()) == 2

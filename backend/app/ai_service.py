import json
import logging
import re
from typing import Any
from sqlalchemy.orm import Session
from .config import settings
from .knowledge import KNOWLEDGE_SOURCES, source_map
from .models import RepairCase, TestResult
from .schemas import Hypothesis, NextCheck, RecommendationContent

logger = logging.getLogger(__name__)


def _norm(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").lower()).strip()


def _case_test_text(tests: list[TestResult]) -> str:
    if not tests:
        return "No diagnostic tests have been recorded."
    return "\n".join(
        f"- {test.test_name}: status={test.result}; observation={test.observed_result}; notes={test.details or 'none'}"
        for test in tests
    )


def _similar_cases(db: Session, case: RepairCase) -> list[dict[str, Any]]:
    """Simple transparent keyword retrieval over completed, technician-confirmed cases."""
    candidates = (
        db.query(RepairCase)
        .filter(
            RepairCase.id != case.id,
            RepairCase.status == "completed",
            RepairCase.confirmed_fault.is_not(None),
        )
        .order_by(RepairCase.updated_at.desc())
        .limit(30)
        .all()
    )
    query_text = _norm(f"{case.device_category} {case.brand} {case.model} {case.issue_title} {case.symptoms}")
    query_tokens = {token for token in re.findall(r"[a-z0-9]+", query_text) if len(token) > 3}
    ranked: list[tuple[int, RepairCase]] = []
    for candidate in candidates:
        candidate_text = _norm(
            f"{candidate.device_category} {candidate.brand} {candidate.model} {candidate.issue_title} "
            f"{candidate.symptoms} {candidate.confirmed_fault} {candidate.repair_action} {candidate.outcome}"
        )
        candidate_tokens = {token for token in re.findall(r"[a-z0-9]+", candidate_text) if len(token) > 3}
        overlap = len(query_tokens & candidate_tokens)
        category_bonus = 2 if candidate.device_category.lower() == case.device_category.lower() else 0
        # A match is only a retrieval cue, not a probability or diagnostic confidence score.
        score = overlap + category_bonus
        if overlap > 0:
            ranked.append((score, candidate))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            "id": candidate.id,
            "device": f"{candidate.brand} {candidate.model}",
            "issue_title": candidate.issue_title,
            "confirmed_fault": candidate.confirmed_fault,
            "repair_action": candidate.repair_action,
            "outcome": candidate.outcome,
            "tests": [
                {"test_name": t.test_name, "result": t.result, "observed_result": t.observed_result}
                for t in candidate.tests
            ],
            "data_origin": candidate.data_origin,
            "match_note": "Keyword overlap; verify the device, tests, and context before applying this precedent.",
        }
        for _, candidate in ranked[:3]
    ]


def _fallback_recommendation(case: RepairCase, tests: list[TestResult], similar: list[dict[str, Any]], reason: str) -> RecommendationContent:
    """Deterministic, conservative guidance used without a working model call."""
    issue = _norm(f"{case.issue_title} {case.symptoms}")
    observed = " ".join(_norm(f"{t.test_name} {t.result} {t.observed_result} {t.details}") for t in tests)
    safety_keywords = ("warm", "hot", "heat", "swollen", "swelling", "smoke", "odor", "smell", "liquid", "corrosion", "burn")
    safety_hold = any(word in issue for word in safety_keywords) or any(word in observed for word in safety_keywords)

    source_ids = ["FX-EVIDENCE-001", "FX-GUIDE-001"]
    hypotheses: list[Hypothesis] = []
    next_checks: list[NextCheck] = []
    missing: list[str] = []
    safety_notes = [
        "This is triage support, not a confirmed diagnosis. A qualified technician must verify the fault before repair or part replacement.",
        "Demo records are fictional examples. Do not interpret historical similarity as proof that the current device has the same fault.",
    ]

    if safety_hold:
        source_ids = ["FX-SAFE-001", "FX-EVIDENCE-001"]
        summary = (
            "Stop routine charging tests and assess safety first. The recorded symptom includes a potential safety signal; "
            "this does not establish its cause. Keep the case on hold and refer it to a qualified technician."
        )
        hypotheses.append(Hypothesis(
            fault="Safety-related condition requires assessment",
            likelihood="possible",
            supporting_evidence=["Recorded symptom or notes include unusual warmth, swelling, smoke, odor, liquid, corrosion, or damage."],
            contradicting_evidence=[],
            reasoning="The available description contains a safety-related signal, but it does not identify a specific failed component.",
        ))
        next_checks.append(NextCheck(
            name="Stop-and-escalate safety assessment",
            purpose="Prevent unsafe charging or handling while the reported condition is unresolved.",
            instructions="Do not continue charging tests or open the battery/device as part of this workflow. Isolate the device from normal use if safe to do so and refer it to a qualified technician using the applicable manufacturer procedure.",
            what_to_record="Exact observed condition, whether the device was charging, and the action taken to place the case on hold.",
            safety_level="professional_only",
        ))
        safety_notes.insert(0, "Safety-first: do not charge or continue testing a device with suspected battery swelling, smoke, unusual heat, chemical odor, or visible damage.")
    else:
        summary = (
            "The app is using conservative local rules because the Gemma API could not be used for this request. "
            "Treat the guidance below as a checklist, not an AI diagnosis. Record the next observation before changing parts."
        )
        has_known_good = any("known-good" in _norm(t.test_name) or "alternate cable" in _norm(t.test_name) for t in tests)
        positive_external = any(
            ("pass" == t.result and any(term in _norm(f"{t.test_name} {t.observed_result}") for term in ("charging indicator appeared", "behavior improved", "works with", "problem cleared")))
            for t in tests
        )
        persistent = any(
            term in _norm(f"{t.observed_result} {t.details}")
            for t in tests for term in ("still appears", "still persists", "does not charge", "issue persists")
        )

        if positive_external:
            hypotheses.append(Hypothesis(
                fault="External cable or adapter path may be contributing",
                likelihood="plausible",
                supporting_evidence=[t.observed_result for t in tests if t.result == "pass" and any(term in _norm(f"{t.test_name} {t.observed_result}") for term in ("charging indicator appeared", "behavior improved", "works with", "problem cleared"))][:3],
                contradicting_evidence=[],
                reasoning="The recorded symptom changed when an external power-path variable changed. Repeating the comparison can help confirm reproducibility; this does not automatically prove which accessory is faulty.",
            ))
        elif persistent:
            hypotheses.append(Hypothesis(
                fault="The issue may not be resolved by the tested external power-path setup",
                likelihood="possible",
                supporting_evidence=[t.observed_result for t in tests if any(term in _norm(f"{t.observed_result} {t.details}") for term in ("still appears", "still persists", "does not charge", "issue persists"))][:3],
                contradicting_evidence=[],
                reasoning="The recorded issue remained under the stated test conditions. This alone cannot distinguish connector, battery, software, or internal circuit causes.",
            ))
        else:
            hypotheses.append(Hypothesis(
                fault="Cause not established; isolate the external power path first",
                likelihood="possible",
                supporting_evidence=[f"Reported symptom: {case.issue_title}"],
                contradicting_evidence=[],
                reasoning="The available observations are insufficient to identify a failed component. Begin with safe, low-risk checks and record one variable at a time.",
            ))

        next_checks.append(NextCheck(
            name="Compare one known-good compatible cable",
            purpose="Check whether the symptom changes when only the cable is changed.",
            instructions="If no safety warning is present, use a known-good, compatible cable and observe the same charging setup. Do not force the connector or insert tools into the port. If the device becomes unusually hot or damaged, stop.",
            what_to_record="Cable used, power source, whether the charging indicator appears, and whether the symptom repeats.",
            safety_level="caution",
        ))
        if not any("adapter" in _norm(t.test_name) for t in tests):
            next_checks.append(NextCheck(
                name="Isolate the compatible power adapter and outlet",
                purpose="Avoid changing cable, adapter, and outlet simultaneously, which makes the result ambiguous.",
                instructions="With no signs of damage or overheating, compare against a known-good compatible adapter and a verified outlet, changing one variable at a time. Do not use damaged accessories.",
                what_to_record="Adapter and outlet tested, compatibility basis, and the observed result.",
                safety_level="caution",
            ))
        if not any("visual inspection" in _norm(t.test_name) or "port inspection" in _norm(t.test_name) for t in tests):
            next_checks.append(NextCheck(
                name="External visual inspection (device powered off)",
                purpose="Look for obvious external damage without opening the device.",
                instructions="Power the device off where practical and inspect externally under normal lighting. Do not insert metal or conductive objects into the port, and do not attempt internal repair based on visual appearance alone.",
                what_to_record="Visible damage, debris, corrosion, or none observed; do not infer hidden internal condition.",
                safety_level="caution",
            ))
        if not has_known_good:
            missing.append("Whether the symptom changes with a known-good compatible cable and adapter tested one at a time.")
        if not any("visual inspection" in _norm(t.test_name) or "port inspection" in _norm(t.test_name) for t in tests):
            missing.append("A basic external visual inspection result, if safe and appropriate.")
        if not tests:
            missing.append("No diagnostic test results are recorded yet; symptoms alone cannot establish the fault.")

    if similar:
        safety_notes.append("A completed case with keyword overlap is available in Repair Memory; compare its actual test conditions before drawing a conclusion.")
    else:
        safety_notes.append("No completed, technician-confirmed similar case was found in the current database.")

    return RecommendationContent(
        summary=summary,
        hypotheses=hypotheses,
        next_checks=next_checks,
        missing_information=missing,
        safety_notes=safety_notes,
        source_ids=source_ids,
        limitations=[reason, "Rule-based fallback does not use an LLM and does not estimate calibrated probabilities."],
    )


def _parse_json_response(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def generate_recommendation(db: Session, case: RepairCase) -> tuple[str, str, RecommendationContent, list[dict[str, Any]]]:
    tests = list(case.tests)
    similar = _similar_cases(db, case)
    source_index = source_map()
    reason = "No GEMINI_API_KEY is configured; using explicit local fallback guidance."

    if settings.has_gemini_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.gemini_api_key)
            prompt = f"""You are Fixora, a cautious electronics-repair diagnostic assistant supporting a qualified technician.
Your task is to recommend safe next checks using ONLY the supplied case facts and reference notes. Do not invent measurements, test results, device specifications, manufacturer procedures, component compatibility, prices, or citations. A possible fault is not a confirmed diagnosis. Similar cases are only weak precedents.

Return ONLY a valid JSON object using exactly these keys:
{{"summary":"string","hypotheses":[{{"fault":"string","likelihood":"possible|plausible|less_likely","supporting_evidence":["strings"],"contradicting_evidence":["strings"],"reasoning":"string"}}],"next_checks":[{{"name":"string","purpose":"string","instructions":"string","what_to_record":"string","safety_level":"routine|caution|professional_only"}}],"missing_information":["strings"],"safety_notes":["strings"],"source_ids":["known source IDs only"],"limitations":["strings"]}}

Rules:
- Use no more than 3 hypotheses and 3 next checks.
- Quote or paraphrase only observed evidence supplied below; if a test is not recorded, call it missing, not failed.
- Explain what evidence does and does not establish. Never make up numeric confidence or a probability.
- If there are signs of unusual heat, swelling, smoke, chemical odor, liquid damage, corrosion, exposed conductors, or structural damage, put safety first and advise stop/escalation. Never advise inserting tools into a port, opening/puncturing a battery, or unqualified live electrical work.
- Do not assert a specific fault without sufficient evidence. Recommend the lowest-risk informative next check.
- Only reference one of these source IDs: {', '.join(source_index.keys())}.

CASE:
ID: {case.id}
Device category: {case.device_category}
Brand/model: {case.brand} {case.model}
Reported issue: {case.issue_title}
Reported symptoms: {case.symptoms}
Status: {case.status}
Technician-entered tests:
{_case_test_text(tests)}

SIMILAR COMPLETED CASES (keyword retrieval; verify before applying; demo records are fictional):
{json.dumps(similar, ensure_ascii=False)}

REVIEWED FIXORA PROTOTYPE REFERENCE NOTES (these are generic workflow/safety notes, not manufacturer service manuals):
{json.dumps([{k: s[k] for k in ("id", "title", "scope", "content", "review_note")} for s in KNOWLEDGE_SOURCES], ensure_ascii=False)}
"""
            response = client.models.generate_content(
                model=settings.gemma_model,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=1800),
            )
            raw_text = getattr(response, "text", None)
            if not raw_text or not raw_text.strip():
                raise ValueError("The model returned an empty response")
            parsed = _parse_json_response(raw_text)
            # Strong type and size validation. Ignore unknown source IDs and never use model-supplied URLs.
            content = RecommendationContent.model_validate(parsed)
            content.source_ids = list(dict.fromkeys(sid for sid in content.source_ids if sid in source_index))
            if not content.source_ids:
                content.source_ids = ["FX-EVIDENCE-001"]
            if not content.hypotheses or not content.next_checks:
                raise ValueError("The model response lacked required diagnostic structure")
            provider = "gemini_api"
            return provider, settings.gemma_model, content, similar
        except Exception as exc:  # A failed model call should not break the repair workflow.
            logger.warning("Gemma recommendation unavailable; using conservative fallback: %s", exc)
            reason = f"Gemma API unavailable for this request ({type(exc).__name__}); local fallback guidance is being shown."

    content = _fallback_recommendation(case, tests, similar, reason)
    return "rule_based_fallback", "Fixora conservative rules (not an LLM)", content, similar


def serialize_recommendation(recommendation, sources: list[dict[str, Any]]) -> dict[str, Any]:
    content = RecommendationContent.model_validate_json(recommendation.content_json)
    source_index = source_map()
    selected_sources = []
    for sid in content.source_ids:
        source = source_index.get(sid)
        if source:
            selected_sources.append({
                "id": str(source["id"]),
                "title": str(source["title"]),
                "kind": str(source["kind"]),
                "source_url": source["source_url"],
                "review_note": str(source["review_note"]),
            })
    return {
        "id": recommendation.id,
        "case_id": recommendation.case_id,
        "provider": recommendation.provider,
        "model_name": recommendation.model_name,
        "generated_at": recommendation.created_at.isoformat() if recommendation.created_at else None,
        "content": content.model_dump(),
        "sources": selected_sources,
    }

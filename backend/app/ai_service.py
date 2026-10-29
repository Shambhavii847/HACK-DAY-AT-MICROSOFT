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


def _has_safety_signal(text: str) -> bool:
    safety_terms = r"\b(warm|hot|heat|swollen|swelling|smoke|odor|smell|liquid|corrosion|burn)\b"
    for match in re.finditer(safety_terms, text):
        start = match.start()
        prefix = text[max(0, start - 40) : start]
        # Ignore if preceded by a negation word (e.g., "no recent drop or liquid exposure")
        if re.search(r"\b(no|not|without|denies|zero)\b(?:\s+\w+){0,3}\s*$", prefix):
            continue
        return True
    return False


def _case_test_text(tests: list[TestResult]) -> str:
    if not tests:
        return "No diagnostic tests have been recorded."
    return "\n".join(
        f"- Test ID {test.id} | {test.performed_at.isoformat()} | {test.test_name} | "
        f"recorded result={test.result} | observation={test.observed_result} | notes={test.details or 'none'}"
        for test in tests
    )


def _previous_recommendation_context(case: RepairCase) -> tuple[dict[str, Any] | None, set[int]]:
    if not case.recommendations:
        return None, set()

    previous = case.recommendations[-1]
    try:
        content = RecommendationContent.model_validate_json(previous.content_json)
    except Exception:
        logger.warning("Could not parse previous recommendation %s for %s", previous.id, case.id)
        return {
            "id": previous.id,
            "generated_at": previous.created_at.isoformat() if previous.created_at else None,
            "provider": previous.provider,
            "summary": "Previous recommendation content could not be parsed.",
        }, set()

    known_evidence = set(content.evidence_test_ids)
    if not known_evidence and previous.created_at:
        # Older saved recommendations predate evidence snapshots. Infer only which
        # tests existed by timestamp; never present that inference as a saved snapshot.
        known_evidence = {
            test.id for test in case.tests
            if test.performed_at and test.performed_at <= previous.created_at
        }
    context = {
        "id": previous.id,
        "generated_at": previous.created_at.isoformat() if previous.created_at else None,
        "provider": previous.provider,
        "summary": content.summary,
        "hypotheses": [item.model_dump() for item in content.hypotheses],
        "next_checks": [item.model_dump() for item in content.next_checks],
        "missing_information": content.missing_information,
        "evidence_test_ids": content.evidence_test_ids,
    }
    return context, known_evidence


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
    recorded_text = " ".join(
        _norm(f"{test.test_name} {test.observed_result} {test.details}") for test in tests
    )
    safety_hold = _has_safety_signal(issue) or _has_safety_signal(recorded_text)

    source_ids = ["FX-EVIDENCE-001", "FX-GUIDE-001"]
    hypotheses: list[Hypothesis] = []
    next_checks: list[NextCheck] = []
    missing: list[str] = []
    actual_observations = [
        test for test in tests
        if test.result in {"pass", "fail", "inconclusive"} and test.observed_result.strip()
    ]
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
        if tests:
            result_counts: dict[str, int] = {}
            for test in tests:
                result_counts[test.result] = result_counts.get(test.result, 0) + 1
            count_summary = ", ".join(f"{count} {status.replace('_', ' ')}" for status, count in result_counts.items())
            summary = (
                f"LOCAL RULES reviewed {len(tests)} saved test(s) for {case.brand} {case.model} "
                f"({case.device_category}): {count_summary}. The recorded result label is not a component diagnosis; "
                "use each observation and its test conditions to decide what it establishes. The fault remains unconfirmed."
            )
        else:
            summary = (
                f"LOCAL RULES reviewed the reported symptom for {case.brand} {case.model} ({case.device_category}); "
                "no diagnostic test results are saved yet. Symptoms alone do not establish a failed component."
            )

        changed_observation = next((
            test for test in reversed(actual_observations)
            if any(term in _norm(test.observed_result) for term in (
                "charging began", "indicator appeared", "behavior improved", "symptom stopped",
                "problem cleared", "issue cleared", "works with", "no longer occurs",
            ))
        ), None)
        persistent_observation = next((
            test for test in reversed(actual_observations)
            if any(term in _norm(test.observed_result) for term in (
                "still appears", "still persists", "issue persists", "no change", "did not change",
                "does not charge", "did not resolve", "symptom continued",
            ))
        ), None)
        inconclusive_tests = [test for test in tests if test.result == "inconclusive"]
        not_tested = [test for test in tests if test.result == "not_tested"]
        ignored_results = [test for test in tests if test.result == "not_applicable"]

        if changed_observation:
            hypotheses.append(Hypothesis(
                fault=f"The reported symptom changed during {changed_observation.test_name}",
                likelihood="plausible",
                supporting_evidence=[f"Test {changed_observation.id} observation: {changed_observation.observed_result}"],
                contradicting_evidence=[],
                reasoning=(
                    "The observation reports a symptom change under this test's stated conditions. "
                    "The result label alone does not identify a faulty component, and the observation does not confirm a repair."
                ),
            ))
        elif persistent_observation:
            hypotheses.append(Hypothesis(
                fault=f"The reported issue continued during {persistent_observation.test_name}",
                likelihood="possible",
                supporting_evidence=[f"Test {persistent_observation.id} observation: {persistent_observation.observed_result}"],
                contradicting_evidence=[],
                reasoning=(
                    "The observation reports that the symptom remained for this test. This does not distinguish "
                    "between possible causes or prove that a particular component is faulty."
                ),
            ))
        else:
            evidence = [f"Reported symptom: {case.symptoms}"]
            evidence.extend(
                f"Test {test.id} ({test.result.replace('_', ' ')}): {test.observed_result}"
                for test in inconclusive_tests[:2]
            )
            hypotheses.append(Hypothesis(
                fault="Cause not established by the saved evidence",
                likelihood="possible",
                supporting_evidence=evidence[:3],
                contradicting_evidence=[],
                reasoning=(
                    "The available observations do not establish a cause. Inconclusive, not-tested, and not-applicable "
                    "entries are not treated as proof for or against a component."
                ),
            ))

        # Select only unperformed, symptom-relevant checks. A check already
        # recorded as pass/fail/inconclusive is not repeated by the fallback.
        is_charging_issue = any(term in issue for term in ("charg", "power", "battery", "usb-c", "usb c"))
        candidates: list[tuple[tuple[str, ...], NextCheck]] = []
        if is_charging_issue:
            candidates = [
                (("known-good compatible cable", "alternate cable"), NextCheck(
                    name="Compare one known-good compatible cable",
                    purpose="Check whether changing only the cable changes the reported charging symptom.",
                    instructions="If no safety concern is present, use a known-good compatible cable in the same setup. Do not force the connector or insert anything into the port.",
                    what_to_record="Cable used, unchanged setup, whether charging begins, and whether the reported symptom repeats.",
                    safety_level="caution",
                )),
                (("adapter", "power supply"), NextCheck(
                    name="Isolate the compatible power adapter",
                    purpose="Check the adapter separately so multiple changed variables do not make the result ambiguous.",
                    instructions="If there are no safety concerns, compare with a known-good compatible adapter while keeping the cable and outlet unchanged.",
                    what_to_record="Adapter used, compatibility basis, unchanged cable/outlet, and the observed result.",
                    safety_level="caution",
                )),
                (("known-good power outlet", "outlet"), NextCheck(
                    name="Check a verified power outlet",
                    purpose="Determine whether the power source changes the symptom without changing the device or cable.",
                    instructions="Only if safe, use a verified outlet and keep the other charging setup unchanged. Do not use damaged power equipment.",
                    what_to_record="Outlet used and whether the same charging behavior occurred.",
                    safety_level="caution",
                )),
                (("visual inspection", "port inspection"), NextCheck(
                    name="External visual inspection (device powered off)",
                    purpose="Record visible external conditions without inferring an internal fault.",
                    instructions="Power off where practical and inspect under normal lighting. Do not insert tools or conductive objects into a port or open the device based on appearance alone.",
                    what_to_record="Visible condition, or that none was observed; do not infer hidden internal condition.",
                    safety_level="caution",
                )),
                (("restart", "after restart"), NextCheck(
                    name="Observe charging behavior after restart",
                    purpose="Check whether the reported behavior changes after a normal restart, without changing hardware.",
                    instructions="If the device is safe to handle, restart it using its normal controls and observe the same charging setup.",
                    what_to_record="Whether the device restarted normally and whether the original symptom returned.",
                    safety_level="routine",
                )),
                (("temperature", "battery safety"), NextCheck(
                    name="Battery and temperature safety screening",
                    purpose="Check for warning signs before any further charging tests.",
                    instructions="Stop if there is unusual heat, swelling, smoke, odor, liquid, or visible damage. Do not charge or open a device with these signs; refer it to a qualified technician.",
                    what_to_record="Any safety warning signs and whether testing was stopped or escalated.",
                    safety_level="professional_only",
                )),
            ]

        def already_attempted(terms: tuple[str, ...]) -> bool:
            return any(
                any(term in _norm(test.test_name) for term in terms)
                and test.result in {"pass", "fail", "inconclusive", "not_applicable"}
                for test in tests
            )

        for terms, check in candidates:
            if not already_attempted(terms):
                next_checks.append(check)
            if len(next_checks) == 3:
                break

        if not next_checks:
            if not_tested:
                pending = not_tested[0]
                next_checks.append(NextCheck(
                    name=f"Perform the recorded not-tested check: {pending.test_name}",
                    purpose="The saved record marks this check as not yet performed, so it cannot be used as diagnostic evidence.",
                    instructions="Perform it only if it is safe, relevant to this device, and within the technician's qualifications. Otherwise record why it is not applicable.",
                    what_to_record="The actual conditions, result, and observation; do not record a result before performing the check.",
                    safety_level="caution",
                ))
            else:
                next_checks.append(NextCheck(
                    name="Review saved observations and select a targeted next check",
                    purpose="The available fallback rules cannot identify a safe, specific additional check from the recorded facts.",
                    instructions="Review the reported symptom and all saved test observations, then choose a low-risk, device-appropriate check from approved service guidance. Do not repeat a completed test without a specific reason or changed condition.",
                    what_to_record="Why the selected check is relevant, the changed condition if repeating a prior test, and the result actually observed.",
                    safety_level="caution",
                ))

        if inconclusive_tests:
            missing.extend(
                f"Test {test.id} ({test.test_name}) was inconclusive: {test.observed_result}"
                for test in inconclusive_tests[:3]
            )
        if not_tested:
            missing.extend(
                f"Test {test.id} ({test.test_name}) is recorded as not tested; no result is available."
                for test in not_tested[:3]
            )
        if ignored_results:
            missing.extend(
                f"Test {test.id} ({test.test_name}) is marked not applicable; it was not used as evidence."
                for test in ignored_results[:2]
            )
        if not tests:
            missing.append("No diagnostic test results are recorded yet; symptoms alone cannot establish the fault.")

    if not tests and not any("no diagnostic test results" in item.lower() for item in missing):
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
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start >= 0 and end > start:
            parsed = json.loads(cleaned[start : end + 1])
        else:
            raise
    if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict):
        parsed = parsed[0]
    if not isinstance(parsed, dict):
        raise ValueError(f"Expected a JSON object, got {type(parsed).__name__}")
    return parsed


def generate_recommendation(db: Session, case: RepairCase) -> tuple[str, str, RecommendationContent, list[dict[str, Any]]]:
    tests = sorted(case.tests, key=lambda test: (test.performed_at, test.id))
    similar = _similar_cases(db, case)
    source_index = source_map()
    previous_recommendation, previous_evidence_ids = _previous_recommendation_context(case)
    current_evidence_ids = {test.id for test in tests}
    new_evidence_ids = sorted(current_evidence_ids - previous_evidence_ids)
    reason = "No GEMINI_API_KEY is configured; using explicit local fallback guidance."

    if settings.has_gemini_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.gemini_api_key)
            prompt = f"""You are Fixora, a cautious electronics-repair diagnostic assistant supporting a qualified technician.
Your task is to recommend safe next checks using ONLY the supplied case facts and reference notes. Do not invent measurements, test results, device specifications, manufacturer procedures, component compatibility, prices, or citations. A possible fault is not a confirmed diagnosis. Similar cases are only weak precedents.

Return ONLY a valid JSON object (do not wrap in an array) using exactly these keys:
{{"summary":"string","hypotheses":[{{"fault":"string","likelihood":"possible|plausible|less_likely","supporting_evidence":["strings"],"contradicting_evidence":["strings"],"reasoning":"string"}}],"next_checks":[{{"name":"string","purpose":"string","instructions":"string","what_to_record":"string","safety_level":"routine|caution|professional_only"}}],"missing_information":["strings"],"safety_notes":["strings"],"source_ids":["known source IDs only"],"limitations":["strings"],"evidence_test_ids":[integer test IDs]}}

Rules:
- Use no more than 3 hypotheses and 3 next checks.
- Use the exact current case facts and every saved test below, including test ID, status label, observation, notes, and timestamp. The backend will set evidence_test_ids; do not invent or change them.
- Treat the test result label as technician-entered context, not a universal statement that a component passed or failed. Explain what the observation establishes and what it does not.
- Inconclusive means the test did not establish a cause. Not tested means no observation exists. Not applicable is not evidence. Do not infer a component fault from any result label alone.
- Do not recommend repeating a pass, fail, or inconclusive test unless there is a specific reason; state the reason and the changed condition needed for a useful repeat.
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

PREVIOUS SAVED RECOMMENDATION (historical decision-support context only; not a confirmed finding):
{json.dumps(previous_recommendation, ensure_ascii=False) if previous_recommendation else 'None'}

Saved test IDs added since that recommendation (must be reviewed in this generation):
{json.dumps(new_evidence_ids)}

SIMILAR COMPLETED CASES (keyword retrieval; verify before applying; demo records are fictional):
{json.dumps(similar, ensure_ascii=False)}

REVIEWED FIXORA PROTOTYPE REFERENCE NOTES (these are generic workflow/safety notes, not manufacturer service manuals):
{json.dumps([{k: s[k] for k in ("id", "title", "scope", "content", "review_note")} for s in KNOWLEDGE_SOURCES], ensure_ascii=False)}
"""
            response = client.models.generate_content(
                model=settings.gemma_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=4096,
                    response_mime_type="application/json",
                ),
            )
            raw_text = getattr(response, "text", None)
            if not raw_text and response.candidates and response.candidates[0].content:
                for part in response.candidates[0].content.parts:
                    if not getattr(part, "thought", False) and getattr(part, "text", None):
                        raw_text = (raw_text or "") + part.text
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
            content.evidence_test_ids = sorted(current_evidence_ids)
            content.new_evidence_test_ids = new_evidence_ids
            content.previous_recommendation_id = previous_recommendation.get("id") if previous_recommendation else None
            provider = "gemini_api"
            return provider, settings.gemma_model, content, similar
        except Exception as exc:  # A failed model call should not break the repair workflow.
            logger.warning("Gemma recommendation unavailable; using conservative fallback: %s", exc)
            reason = f"Gemma API unavailable for this request ({type(exc).__name__}); local fallback guidance is being shown."

    content = _fallback_recommendation(case, tests, similar, reason)
    content.evidence_test_ids = sorted(current_evidence_ids)
    content.new_evidence_test_ids = new_evidence_ids
    content.previous_recommendation_id = previous_recommendation.get("id") if previous_recommendation else None
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

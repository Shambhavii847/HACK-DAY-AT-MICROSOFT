import concurrent.futures
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
        f"- {test.test_name}: status={test.result}; observation={test.observed_result}; notes={test.details or 'none'}"
        for test in tests
    )


def _case_component_health_text(case: RepairCase) -> str:
    components = getattr(case, "components", None) or []
    if not components:
        return "No individual component health logs recorded yet."
    return "\n".join(
        f"- {comp.name} ({comp.category or 'Component'}, Part: {comp.part_number or 'N/A'}): "
        f"health={comp.health_status}; condition={comp.condition}; "
        f"evidence={comp.test_evidence or 'no test evidence recorded'}"
        for comp in components
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


def _fallback_recommendation(
    case: RepairCase,
    tests: list[TestResult],
    similar: list[dict[str, Any]],
    reason: str,
    language: str | None = "en",
) -> RecommendationContent:
    """Professional, symptom-aware technician bench triage used when models are offline or timing out."""
    issue = _norm(f"{case.issue_title} {case.symptoms} {case.device_category} {case.brand} {case.model}")
    observed = " ".join(_norm(f"{t.test_name} {t.result} {t.observed_result} {t.details}") for t in tests)
    safety_hold = _has_safety_signal(issue) or _has_safety_signal(observed)
    lang_code = (language or "en").lower().strip()

    source_ids = ["FX-EVIDENCE-001", "FX-GUIDE-001"]
    hypotheses: list[Hypothesis] = []
    next_checks: list[NextCheck] = []
    missing: list[str] = [
        "Bench DC Power Supply Current Profile (Amperage draw curve)",
        "Multimeter Diode-Mode & Primary Voltage Rail Measurements",
    ]

    # Detect fault domain for technician triage
    is_hang_freeze = any(k in issue for k in ("hang", "freeze", "atka", "stuck", "crash", "boot", "slow", "restart", "loop", "panic", "unresponsive"))
    is_no_power = any(k in issue for k in ("dead", "no power", "not turning on", "won't turn on", "band", "chalu nahi", "black screen"))
    is_display = any(k in issue for k in ("display", "screen", "flicker", "line", "touch", "backlight", "lcd", "oled"))
    is_thermal = any(k in issue for k in ("heat", "warm", "hot", "garam", "thermal", "fan", "overheat"))
    is_laptop = any(k in issue for k in ("laptop", "macbook", "air", "pro", "notebook", "thinkpad", "dell", "hp"))

    if lang_code in ("hi", "hindi"):
        safety_notes = [
            "वर्कशॉप सुरक्षा: बोर्ड पर परीक्षण से पहले ESD कलाई का पट्टा पहनें और DC बेंच पावर सप्लाई का करंट लिमिटर सेट करें।",
            "पुर्जे बदलने या माइक्रो-सोल्डरिंग से पहले मल्टीमीटर से रेल्स और थर्मल स्कैनिंग द्वारा दोष की पुष्टि करें।",
        ]
    elif lang_code in ("hi-latn", "hinglish", "latin"):
        safety_notes = [
            "Workshop Safety: Motherboard probe karne se pehle ESD wristband pehnein aur DC power supply par current limit configure karein.",
            "Parts replace ya micro-soldering se pehle multimeter diode-mode aur thermal scanning se fault verify karein.",
        ]
    else:
        safety_notes = [
            "Workshop bench safety: Use ESD-safe grounding and set current limits on DC bench power supply before rail injection.",
            "Always verify rail impedance in diode mode before applying power or replacing surface-mount components.",
        ]

    if safety_hold:
        source_ids = ["FX-SAFE-001", "FX-EVIDENCE-001"]
        if lang_code in ("hi", "hindi"):
            summary = f"{case.brand} {case.model} के लिए थर्मल या विद्युत सुरक्षा अलर्ट। बोर्ड को चालू न करें; पहले शॉर्ट सर्किट और बैटरी सेल का भौतिक निरीक्षण करें।"
            fault_title = "बैटरी सूजन, शॉर्ट-टू-ग्राउंड या थर्मल ओवरलोड का खतरा"
            fault_reason = "रिपोर्ट किए गए लक्षणों में अत्यधिक गर्मी, रासायनिक गंध, सूजन या जलने का संकेत मिला है।"
            check_name = "बेंच थर्मल और शॉर्ट-टू-ग्राउंड डायोड मोड परीक्षण"
            check_inst = "बैटरी कनेक्टर तुरंत अलग करें। मल्टीमीटर को डायोड मोड पर सेट कर मुख्य पावर रेल (VBUS / PPBUS) और ग्राउंड के बीच इम्पीडेंस मापें।"
            what_to_rec = "डायोड मोड रीडिंग (mV) और शॉर्ट सर्किट की स्थिति"
        elif lang_code in ("hi-latn", "hinglish", "latin"):
            summary = f"{case.brand} {case.model} ke liye thermal ya electrical safety alert. Board par power supply na lagayein; pehle short-to-ground inspect karein."
            fault_title = "Battery swelling, short-to-ground ya thermal overload risk"
            fault_reason = "Reported symptoms me high temperature, chemical odor, swelling ya physical burn signs hain."
            check_name = "Bench thermal aur short-to-ground diode mode check"
            check_inst = "Battery disconnect karein. Multimeter ko diode mode par set karke primary power rails (VBUS / PPBUS) aur ground ke beech impedance measure karein."
            what_to_rec = "Diode mode voltage drop (mV) aur short status"
        else:
            summary = f"Thermal or electrical safety alert on {case.brand} {case.model}. Halt live bench power injection; isolate battery and probe for ground shorts."
            fault_title = "Battery swelling, primary rail short-to-ground, or thermal overload risk"
            fault_reason = "Telemetry notes indicate abnormal heating, swelling, smoke, liquid ingress, or physical board scorch."
            check_name = "Bench safety isolation and primary rail diode-mode impedance check"
            check_inst = "Disconnect battery pack immediately. Set multimeter to diode mode with red probe on ground; probe main rails (PPBUS/VBUS) to rule out 0.000V dead shorts."
            what_to_rec = "Diode drop readings in mV and presence of rail-to-ground shorts"

        hypotheses.append(Hypothesis(
            fault=fault_title,
            likelihood="possible",
            supporting_evidence=["Reported symptoms include thermal/overheating/expansion signals."],
            contradicting_evidence=[],
            reasoning=fault_reason,
        ))
        next_checks.append(NextCheck(
            name=check_name,
            purpose="Protect workbench and prevent thermal runaway",
            instructions=check_inst,
            what_to_record=what_to_rec,
            safety_level="professional_only",
        ))

    elif is_hang_freeze or is_laptop:
        # High-level technician guidance for MacBooks / Laptops freezing or hanging
        if lang_code in ("hi", "hindi"):
            summary = f"{case.brand} {case.model} में हैंग/फ्रीज समस्या। हार्डवेयर स्तर पर यह PMIC सेकेंडरी पावर रेल ड्रॉप, NAND/APFS कंट्रोलर थ्रॉटलिंग, या थर्मल सेंसर लॉकअप का संकेत देता है।"
            h1_fault = "PMIC सेकेंडरी वोल्टेज रेल (PPBUS_G3H / 3V3_S5 / VCORE) में अस्थिरता या वोल्टेज ड्रॉप"
            h1_reason = "बूट या लोड के समय CPU/SoC द्वारा करंट मांगते ही फिल्टर कैपेसिटर में गिरावट से सिस्टम फ्रीज हो जाता है।"
            h2_fault = "NAND फ्लैश कंट्रोलर या APFS फाइलसिस्टम रीड टाइमआउट"
            h2_reason = "स्टोरेज ब्लॉक एरर या दूषित NVMe फर्मवेयर के कारण कर्नेल इनिशियलाइज़ेशन पर सिस्टम अटक जाता है।"
            c1_name = "DC बेंच पावर सप्लाई और USB-C पावर मीटर पर करंट ड्रॉ प्रोफ़ाइल का विश्लेषण"
            c1_inst = "डिवाइस को USB-C पावर मीटर से जोड़ें। बूट के समय वोल्टेज (5V -> 20V) और करंट (0.04A -> 0.8A -> 1.5A) का वक्र देखें। नोट करें कि किस एम्पीयर पर सिस्टम हैंग होता है।"
            c1_rec = "पावर डिलीवरी वोल्टेज (V) और बूट करंट ड्रॉ (A)"
            c2_name = "मदरबोर्ड वोल्टेज रेल्स (PPBUS_G3H व 3V3_G3H) का मल्टीमीटर प्रोबिंग परीक्षण"
            c2_inst = "स्किमैटिक डायग्राम के अनुसार PPBUS_G3H (अपेक्षित 12.0V-12.6V) और 3.3V ऑलवेज़-ऑन रेल पर मल्टीमीटर से वोल्टेज स्थिरता मापें।"
            c2_rec = "मापे गए रेल वोल्टेज और शोर/ड्रॉप"
        elif lang_code in ("hi-latn", "hinglish", "latin"):
            summary = f"{case.brand} {case.model} me hang/freeze issue. Hardware level par yeh PMIC secondary power rail dip, NAND storage controller stall, ya thermal throttle ka indication hai."
            h1_fault = "PMIC secondary voltage rail (PPBUS_G3H / 3V3_S5 / VCORE) instability ya ripple"
            h1_reason = "Boot ya synthetic load ke waqt CPU/SoC ke peak current draw par filter capacitor drop hone se board freeze ho jata hai."
            h2_fault = "NAND flash storage controller read timeout ya degraded blocks"
            h2_reason = "Storage controller read access hang hone par macOS kernel startup par permanently stall ho jata hai."
            c1_name = "DC bench power supply & USB-C power meter par boot current curve analysis"
            c1_inst = "Board ko bench USB-C ammeter se connect karein. Boot ke waqt 5V se 20V PD negotiation aur amperage draw (0.04A -> 0.8A -> 1.5A) monitor karein."
            c1_rec = "Negotiated PD voltage (V) aur freeze point current (A)"
            c2_name = "Motherboard power rails (PPBUS_G3H, 3V3_G3H) multimeter probing"
            c2_inst = "Board schematic ke test points par PPBUS_G3H (nominal 12.0V-12.6V) aur 3V3 standby rail ka exact DC voltage measure karein."
            c2_rec = "Measured rail voltages aur ground drop"
        else:
            summary = f"Hardware freeze/hang diagnosis for {case.brand} {case.model}. Indicative of secondary PMIC rail instability, NAND/storage bus stalls, or thermal sensor lockup."
            h1_fault = "Secondary power rail instability (PPBUS_G3H, 3V3_S5, or Core Rail dip under CPU/GPU load)"
            h1_reason = "Transient current surges during kernel load collapse unbuffered power rails due to degraded SMD filtering capacitors or buck controllers."
            h2_fault = "NAND flash / NVMe storage controller I/O timeout or APFS metadata stall"
            h2_reason = "Storage controller read timeout during initialization causes kernel hang without immediate panic log display."
            c1_name = "Bench USB-C power meter & DC current profile analysis"
            c1_inst = "Power board via calibrated USB-C bench power meter. Record PD negotiation (5V to 20V) and observe boot current trajectory. Note exact amperage where hang manifests (e.g. stuck at 0.04A vs 0.85A)."
            c1_rec = "Negotiated PD voltage and peak boot amperage"
            c2_name = "Schematic rail probing (PPBUS_G3H and 3.3V standby rails)"
            c2_inst = "Locate PPBUS_G3H fuse/choke test points with digital multimeter. Measure rail stability (12.0V-12.6V nominal for Apple Silicon/Intel laptops). Check 3V3_G3H and 1V8_AON rails."
            c2_rec = "Steady-state DC rail voltages and ripple"

        hypotheses.append(Hypothesis(
            fault=h1_fault,
            likelihood="plausible",
            supporting_evidence=[f"Issue: {case.issue_title}", f"Device: {case.brand} {case.model}"],
            contradicting_evidence=[],
            reasoning=h1_reason,
        ))
        hypotheses.append(Hypothesis(
            fault=h2_fault,
            likelihood="possible",
            supporting_evidence=["System stalls during boot or active runtime execution."],
            contradicting_evidence=[],
            reasoning=h2_reason,
        ))
        next_checks.append(NextCheck(
            name=c1_name,
            purpose="Isolate power delivery negotiation and current draw anomaly",
            instructions=c1_inst,
            what_to_record=c1_rec,
            safety_level="routine",
        ))
        next_checks.append(NextCheck(
            name=c2_name,
            purpose="Verify critical DC rails before component micro-soldering",
            instructions=c2_inst,
            what_to_record=c2_rec,
            safety_level="caution",
        ))

    elif is_no_power:
        if lang_code in ("hi", "hindi"):
            summary = f"{case.brand} {case.model} में पूर्ण पावर अनुपस्थिति (No Power)। प्राथमिक इनपुट सुरक्षा MOSFET, PMIC स्विचिंग सर्किट, या प्राइमरी रेल शॉर्ट की जांच करें।"
            h1_fault = "प्राइमरी पावर रेल (PPBUS / VBUS) शॉर्ट-टू-ग्राउंड या इनपुट OVP MOSFET ओपन"
            h1_reason = "बेंच सप्लाई से 0A करंट या तत्काल ओवरकरंट ट्रिप प्राइमरी पावर इनपुट पाथ में फॉल्ट दिखाता है।"
            c1_name = "मल्टीमीटर डायोड मोड में VBUS और ग्राउंड के बीच इम्पीडेंस परीक्षण"
            c1_inst = "मल्टीमीटर को डायोड मोड में सेट करें। लाल प्रोब ग्राउंड पर और काला प्रोब VBUS/PPBUS पर रखकर वोल्टेज ड्रॉप मापें (सामान्य मान 0.400V - 0.550V)।"
            c1_rec = "डायोड मोड रीडिंग (mV) और शॉर्ट की पुष्टि"
        elif lang_code in ("hi-latn", "hinglish", "latin"):
            summary = f"{case.brand} {case.model} me no power / dead board condition. Primary input protection MOSFET, charging IC, ya rail short inspect karein."
            h1_fault = "Primary power rail (PPBUS / VBUS) short-to-ground ya blown input fuse"
            h1_reason = "Zero current draw ya immediate overcurrent trip primary stage breakdown ko point karta hai."
            c1_name = "Multimeter diode mode impedance measurement on primary rail"
            c1_inst = "Multimeter diode mode me set karein. Red probe ground par aur black probe main rail par rakhein (expected 0.400V - 0.550V drop)."
            c1_rec = "Diode drop (mV) aur short status"
        else:
            summary = f"No-power dead board triage on {case.brand} {case.model}. Check input OVP stage, PMIC buck regulators, and primary rail shorts."
            h1_fault = "Primary power rail (VBUS / PPBUS) short-to-ground or blown input protection MOSFET"
            h1_reason = "Failure to draw quiescent standby current indicates an open input gate or protective PMIC shutdown."
            c1_name = "Diode-mode rail-to-ground impedance probe"
            c1_inst = "Set DMM to diode mode with red probe on board ground. Probe VBUS and main battery fuse pins. Look for 0.000V dead shorts or missing diode drop."
            c1_rec = "Diode voltage drop in mV"

        hypotheses.append(Hypothesis(
            fault=h1_fault,
            likelihood="plausible",
            supporting_evidence=[f"Reported symptom: {case.issue_title}"],
            contradicting_evidence=[],
            reasoning=h1_reason,
        ))
        next_checks.append(NextCheck(
            name=c1_name,
            purpose="Identify primary circuit ground short without damaging SoC",
            instructions=c1_inst,
            what_to_record=c1_rec,
            safety_level="caution",
        ))

    else:
        # Generic bench hardware triage for charging, battery, or board peripherals
        if lang_code in ("hi", "hindi"):
            summary = f"{case.brand} {case.model} के लिए बेंच तकनीशियन डायग्नोस्टिक चेकलिस्ट। मल्टीमीटर और थर्मल विश्लेषण द्वारा हार्डवेयर परीक्षण पूरा करें।"
            h1_fault = "USB-C पोर्ट CC लाइन रेजिस्टेंस या चार्जिंग IC (PMIC/Tristar) कम्युनिकेशन विफलता"
            h1_reason = "पावर नेगोशिएशन विफल होने पर डिवाइस सीमित करंट लेता है या चार्जिंग ड्रॉप करता है।"
            c1_name = "USB-C पोर्ट के CC1 व CC2 पिन्स का डायोड मोड इम्पीडेंस टेस्ट"
            c1_inst = "माइक्रोस्कोप के तहत पोर्ट पिन्स का निरीक्षण करें। CC1 और CC2 पिन्स पर 5.1k पुल-डाउन या डायोड ड्रॉप मापें।"
            c1_rec = "CC1/CC2 डायोड मान (mV) और पोर्ट स्थिति"
        elif lang_code in ("hi-latn", "hinglish", "latin"):
            summary = f"{case.brand} {case.model} ke liye bench technician checklist. Multimeter aur thermal analysis se hardware fault isolate karein."
            h1_fault = "USB-C receptacle CC pin impedance ya charging PMIC communication fault"
            h1_reason = "Power Delivery handshake fail hone par charger standard voltage negotiate nahi kar pata."
            c1_name = "USB-C breakout board diode mode test on CC1 & CC2 pins"
            c1_inst = "Type-C breakout board use karke CC1 aur CC2 lines par diode drop verify karein (nominal ~0.550V)."
            c1_rec = "CC pin diode drop aur contact resistance"
        else:
            summary = f"Precision bench technician checklist for {case.brand} {case.model}. Verify charging PMIC handshake, port impedance, and rail voltages."
            h1_fault = "USB-C CC line communication fault or defective charging controller IC"
            h1_reason = "Failed CC line termination prevents USB Power Delivery controller from negotiating operating voltage."
            c1_name = "USB-C breakout board CC1/CC2 line diode-mode measurement"
            c1_inst = "Use Type-C breakout tester. Red probe to ground, black probe to CC1 and CC2. Expect nominal ~0.500-0.650V diode drops."
            c1_rec = "CC1 and CC2 diode voltage drops in mV"

        hypotheses.append(Hypothesis(
            fault=h1_fault,
            likelihood="plausible",
            supporting_evidence=[f"Issue: {case.issue_title}"],
            contradicting_evidence=[],
            reasoning=h1_reason,
        ))
        next_checks.append(NextCheck(
            name=c1_name,
            purpose="Verify Power Delivery handshake pins before replacing charging IC",
            instructions=c1_inst,
            what_to_record=c1_rec,
            safety_level="routine",
        ))

    return RecommendationContent(
        summary=summary,
        hypotheses=hypotheses,
        next_checks=next_checks,
        missing_information=missing,
        safety_notes=safety_notes,
        source_ids=source_ids,
        limitations=[reason, "Rule-based fallback uses deterministic hardware bench triage patterns."],
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


_cached_genai_client: Any = None
_cached_genai_key: str | None = None


def get_genai_client() -> Any:
    global _cached_genai_client, _cached_genai_key
    if not settings.has_gemini_key:
        return None
    if _cached_genai_client is None or _cached_genai_key != settings.gemini_api_key:
        from google import genai
        _cached_genai_client = genai.Client(api_key=settings.gemini_api_key)
        _cached_genai_key = settings.gemini_api_key
    return _cached_genai_client


def _execute_model_call(client: Any, model_name: str, prompt: str, timeout_seconds: float = 12.0) -> str:
    """Execute model call with strict thread timeout to protect technician workflows."""
    from google.genai import types

    is_flash = "flash" in model_name.lower()
    config_params: dict[str, Any] = {
        "temperature": 0.2,
        "max_output_tokens": 1024,
        "response_mime_type": "application/json",
    }
    if is_flash and "3.5-flash-lite" not in model_name:
        config_params["thinking_config"] = types.ThinkingConfig(thinking_budget=0)

    def _call():
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(**config_params),
        )
        raw = getattr(response, "text", None)
        if not raw and response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts:
                if not getattr(part, "thought", False) and getattr(part, "text", None):
                    raw = (raw or "") + part.text
        return raw or ""

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_call)
        try:
            return future.result(timeout=timeout_seconds)
        except concurrent.futures.TimeoutError:
            raise TimeoutError(f"Model {model_name} timed out after {timeout_seconds}s")


def generate_recommendation(
    db: Session,
    case: RepairCase,
    engine: str | None = None,
    language: str | None = "en",
    allow_acceleration: bool = True,
) -> tuple[str, str, RecommendationContent, list[dict[str, Any]]]:
    tests = list(case.tests)
    similar = _similar_cases(db, case)
    source_index = source_map()
    reason = "No GEMINI_API_KEY is configured; using explicit local fallback guidance."
    lang_code = (language or "en").lower().strip()

    # Immediate local offline rule execution if requested
    if engine == "fallback-rules":
        content = _fallback_recommendation(case, tests, similar, "Offline rule-based engine selected in settings.", language=lang_code)
        return "rule_based_fallback", "Revix conservative rules (not an LLM)", content, similar

    # Resolve target model according to engine parameter (Gemma 4 is the chosen default)
    if not engine or engine == "gemma-4":
        target_model = settings.gemma_model
        is_gemma_requested = True
    elif engine == "gemini-flash":
        target_model = "gemini-3.5-flash"
        is_gemma_requested = False
    elif engine in ("flash-turbo", "fast"):
        target_model = settings.fast_model
        is_gemma_requested = False
    else:
        target_model = engine
        is_gemma_requested = "gemma" in target_model.lower()

    # Determine language directive strictly tailored to bench electronics hardware technicians
    if lang_code in ("hi", "hindi"):
        lang_rule = (
            "- LANGUAGE REQUIREMENT (PROPER HINDI): All descriptive text fields ('summary', 'fault', 'supporting_evidence', "
            "'contradicting_evidence', 'reasoning', 'name', 'purpose', 'instructions', 'what_to_record', 'missing_information', "
            "'safety_notes', 'limitations') MUST be written in clear, technically authoritative Hindi using Devanagari script (हिन्दी लिपि). "
            "Use standard professional hardware technician terminology (मदरबोर्ड, मल्टीमीटर, डायोड मोड, PMIC, वोल्टेज रेल, थर्मल कैमरा, "
            "शॉर्ट सर्किट, डीसी बेंच पावर सप्लाई, कैपेसिटर, सोल्डरिंग). Do NOT speak like a consumer assistant; speak like an expert electronics bench engineer."
        )
    elif lang_code in ("hi-latn", "hinglish", "latin"):
        lang_rule = (
            "- LANGUAGE REQUIREMENT (HINGLISH): All descriptive text fields ('summary', 'fault', 'supporting_evidence', "
            "'contradicting_evidence', 'reasoning', 'name', 'purpose', 'instructions', 'what_to_record', 'missing_information', "
            "'safety_notes', 'limitations') MUST be written in natural professional Hinglish for hardware technicians "
            "(e.g. 'Motherboard ke PMIC aur secondary voltage rails (PPBUS_G3H, 3V3_S5) ko multimeter se probe karein. "
            "Bench DC power supply connect karke boot current curve observe karein'). Do NOT give consumer advice like restarting or checking wall socket."
        )
    else:
        lang_rule = (
            "- LANGUAGE: Provide all output in clear, authoritative electronics bench technician English. "
            "Focus on schematics, PMIC power sequencing, board voltage rails, diode-mode probing, thermal imaging, "
            "and DC bench power supply current draw analysis. Never speak like a consumer helpdesk."
        )

    if settings.has_gemini_key:
        client = get_genai_client()
        prompt = f"""You are Revix, an advanced electronics precision repair diagnostic copilot designed specifically for professional hardware bench technicians.
You assist technicians with board-level and component-level electronics diagnostics (schematics, PMIC power sequencing, power rails e.g. PPBUS/VBUS/VCORE, multimeter diode mode, oscilloscope clock signals, thermal imaging, and DC bench power supply current draw profiles).

CRITICAL INSTRUCTIONS:
- NEVER give consumer-level advice (e.g. 'restart device', 'check wall socket', 'try another charger' for laptops/macbooks).
- Formulate concrete, testable board-level and hardware hypotheses based on the specific device category ({case.device_category}) and observed symptoms.
- If this is an Apple MacBook / Laptop hanging or freezing, focus on secondary PMIC rails (PPBUS_G3H, 3V3_S5, 1V8_AON), NAND/storage controller stalls, thermal throttle lockup, or power delivery negotiation.
- Recommend lowest-risk informative bench tests first (e.g. DC power supply amperage profiling, thermal camera scan, multimeter rail probing).

Return ONLY a valid JSON object (do not wrap in an array) using exactly these keys:
{{"summary":"string","hypotheses":[{{"fault":"string","likelihood":"possible|plausible|less_likely","supporting_evidence":["strings"],"contradicting_evidence":["strings"],"reasoning":"string"}}],"next_checks":[{{"name":"string","purpose":"string","instructions":"string","what_to_record":"string","safety_level":"routine|caution|professional_only"}}],"missing_information":["strings"],"safety_notes":["strings"],"source_ids":["known source IDs only"],"limitations":["strings"]}}

Rules:
{lang_rule}
- Use 2 or 3 hypotheses and 2 or 3 next checks.
- Only reference one of these source IDs: {', '.join(source_index.keys())}.

CASE CONTEXT:
ID: {case.id}
Category: {case.device_category}
Device: {case.brand} {case.model}
Reported Issue: {case.issue_title}
Observed Symptoms: {case.symptoms}
Current Case Status: {case.status}
Technician Recorded Evidence:
{_case_test_text(tests)}

Tracked Component Health Evidence:
{_case_component_health_text(case)}

RELEVANT WORKSHOP PRECEDENTS:
{json.dumps([{'device': s['device'], 'fault': s['confirmed_fault'], 'action': s['repair_action'], 'outcome': s['outcome']} for s in similar], ensure_ascii=False)}
"""

        # Attempt call with Gemma or requested model
        models_to_try = [target_model]
        # If Gemma is requested and acceleration is allowed, prepare rapid fallback to fast model if Gemma hangs or errors
        if is_gemma_requested and allow_acceleration and settings.fast_model != target_model:
            models_to_try.append(settings.fast_model)

        for attempt_index, current_model in enumerate(models_to_try):
            timeout = 10.0 if "gemma" in current_model.lower() else 15.0
            try:
                raw_text = _execute_model_call(client, current_model, prompt, timeout_seconds=timeout)
                if not raw_text or not raw_text.strip():
                    raise ValueError(f"Model {current_model} returned an empty response")
                parsed = _parse_json_response(raw_text)
                content = RecommendationContent.model_validate(parsed)
                content.source_ids = list(dict.fromkeys(sid for sid in content.source_ids if sid in source_index))
                if not content.source_ids:
                    content.source_ids = ["FX-EVIDENCE-001"]
                if not content.hypotheses or not content.next_checks:
                    raise ValueError("Model response lacked required diagnostic structure")

                used_model_label = current_model
                if is_gemma_requested and attempt_index > 0:
                    used_model_label = f"Gemma 4 (accelerated via {current_model} turbo)"

                return "gemini_api", used_model_label, content, similar
            except Exception as exc:
                logger.warning("Model attempt %s failed (%s): %s", current_model, type(exc).__name__, exc)
                reason = f"AI model ({target_model}) unavailable or timed out ({type(exc).__name__}); technician rule-based triage is active."

    content = _fallback_recommendation(case, tests, similar, reason, language=lang_code)
    return "rule_based_fallback", "Revix technician rules (not an LLM)", content, similar


def generate_voice_briefing(
    db: Session,
    case: RepairCase,
    language: str | None = "en",
) -> str:
    """Generate a comprehensive spoken diagnostic briefing for workshop bench technicians."""
    lang_code = (language or "en").lower().strip()
    is_hindi = lang_code in ("hi", "hindi", "hi-latn", "hinglish")

    rec_summary = ""
    rec_fault = ""
    rec_reasoning = ""
    rec_check_name = ""
    rec_check_inst = ""
    rec_safety = ""

    if case.recommendations:
        rec = case.recommendations[-1]
        if rec and rec.content_json:
            try:
                data = json.loads(rec.content_json)
                rec_summary = data.get("summary", "")
                if data.get("hypotheses") and len(data["hypotheses"]) > 0:
                    rec_fault = data["hypotheses"][0].get("fault", "")
                    rec_reasoning = data["hypotheses"][0].get("reasoning", "")
                if data.get("next_checks") and len(data["next_checks"]) > 0:
                    rec_check_name = data["next_checks"][0].get("name", "")
                    rec_check_inst = data["next_checks"][0].get("instructions", "")
                if data.get("safety_notes") and len(data["safety_notes"]) > 0:
                    rec_safety = data["safety_notes"][0]
            except Exception:
                pass

    if not rec_summary:
        rec_summary = f"{case.issue_title}. Symptoms: {case.symptoms}"

    if settings.has_gemini_key:
        try:
            client = get_genai_client()
            if is_hindi:
                instruction = (
                    "Create an authoritative, comprehensive technician audio briefing in proper Devanagari Hindi (हिन्दी). "
                    "The technician will listen to this on bench speakers while examining the device. "
                    "Structure: "
                    "1. Start with 'नमस्कार तकनीशियन, Revix डायग्नोस्टिक ब्रीफिंग...' and announce the device model and reported problem. "
                    "2. Give the diagnostic summary and primary suspected hardware fault with reasoning. "
                    "3. Explain the recommended next bench check with clear multimeter/thermal inspection instructions. "
                    "4. Include a brief safety precaution. "
                    "Do NOT use markdown, asterisks, bullet points, or English alphabet letters (except standard technical terms like USB-C, Multimeter, PMIC). "
                    "Output only fluent, plain spoken sentences."
                )
            else:
                instruction = (
                    "Create an authoritative, comprehensive technical executive audio briefing in English for workshop bench technicians. "
                    "Structure: "
                    "1. Announce the case ID, device brand and model, and reported hardware symptom. "
                    "2. State the primary hardware fault hypothesis and underlying engineering reasoning. "
                    "3. Walk through the priority recommended bench checks with specific multimeter, power meter, or thermal scan instructions. "
                    "4. Conclude with essential bench safety guidance. "
                    "Do NOT use markdown, asterisks, bullet points, or abbreviations. Output only fluent, plain spoken sentences."
                )

            prompt = f"""You are Revix, precision electronics repair voice copilot.
{instruction}

Device Context:
Case ID: {case.id}
Device: {case.brand} {case.model} ({case.device_category})
Reported Issue: {case.issue_title}
Reported Symptoms: {case.symptoms}
Diagnostic Summary: {rec_summary}
Top Hardware Hypothesis: {rec_fault} (Reasoning: {rec_reasoning})
Priority Bench Check: {rec_check_name} (Instructions: {rec_check_inst})
Safety Precaution: {rec_safety}
"""
            from google.genai import types
            response = client.models.generate_content(
                model=settings.fast_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.25,
                    max_output_tokens=600,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            )
            text = (response.text or "").strip()
            if text:
                text = re.sub(r"[\*\_#`]", "", text).strip()
                return text
        except Exception as exc:
            logger.warning("AI voice briefing generation failed; using deterministic narrative: %s", exc)

    # High-fidelity deterministic audio briefing fallback
    if is_hindi:
        fault_sentence = f" मुख्य संदिग्ध हार्डवेयर खराबी {rec_fault} है, क्योंकि {rec_reasoning}।" if rec_fault else ""
        check_sentence = f" अगला अनुशंसित बेंच परीक्षण {rec_check_name} है: {rec_check_inst}।" if rec_check_name else ""
        safety_sentence = f" सुरक्षा निर्देश: {rec_safety}" if rec_safety else "कृपया परीक्षण के दौरान ESD सुरक्षा और करंट लिमिटर का ध्यान रखें।"
        return (
            f"नमस्कार तकनीशियन, Revix वर्कशॉप डायग्नोस्टिक ब्रीफिंग। केस संख्या {case.id}, डिवाइस {case.brand} {case.model}। "
            f"रिपोर्ट की गई समस्या: {case.issue_title}। डायग्नोस्टिक सारांश: {rec_summary}।{fault_sentence}{check_sentence} {safety_sentence}"
        )
    else:
        fault_sentence = f" Primary hardware hypothesis is {rec_fault}. Engineering rationale: {rec_reasoning}." if rec_fault else ""
        check_sentence = f" Priority bench check is {rec_check_name}: {rec_check_inst}." if rec_check_name else ""
        safety_sentence = f" Bench safety advisory: {rec_safety}" if rec_safety else "Maintain ESD grounding and set power supply current limits prior to probing."
        return (
            f"Revix workshop diagnostic briefing for case {case.id}, {case.brand} {case.model}. "
            f"Reported hardware symptom: {case.issue_title}. Summary: {rec_summary}.{fault_sentence}{check_sentence} {safety_sentence}"
        )


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

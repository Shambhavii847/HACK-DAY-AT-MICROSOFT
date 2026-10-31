"""Small, explicit, prototype knowledge base.

These are Revix's generic workflow and safety notes, not manufacturer service manuals.
They deliberately avoid model-specific repair instructions or unsupported specifications.
"""

KNOWLEDGE_SOURCES: list[dict[str, str | None]] = [
    {
        "id": "FX-GUIDE-001",
        "title": "External power-path triage",
        "kind": "Revix curated prototype guidance",
        "scope": "Generic charging complaints",
        "source_url": None,
        "review_note": "Prototype workflow note; not manufacturer-specific service documentation.",
        "content": (
            "For a charging complaint, isolate external variables one at a time when safe: "
            "try a known-good compatible cable, then a known-good compatible power adapter and outlet. "
            "Record exactly what changed and whether the symptom changed. Do not infer an internal port or board fault "
            "from a single unrepeatable observation. Stop if the device becomes unusually hot, smells unusual, or shows damage."
        ),
    },
    {
        "id": "FX-SAFE-001",
        "title": "Battery and connector safety baseline",
        "kind": "Revix safety checklist",
        "scope": "All electronic devices; especially phones and lithium-ion batteries",
        "source_url": None,
        "review_note": "Conservative safety baseline for this prototype; not a substitute for manufacturer guidance or training.",
        "content": (
            "Do not puncture, bend, heat, crush, or open a lithium-ion battery. Do not insert metal or other conductive objects "
            "into a charging port. Stop normal troubleshooting and refer to a qualified technician if there is battery swelling, "
            "smoke, unusual heat, chemical odor, liquid ingress, corrosion, exposed conductors, or visible structural damage. "
            "Do not ask an unqualified user to open a device or perform live electrical work."
        ),
    },
    {
        "id": "FX-EVIDENCE-001",
        "title": "Evidence before hypothesis",
        "kind": "Revix diagnostic process note",
        "scope": "All diagnostic sessions",
        "source_url": None,
        "review_note": "Internal product workflow guidance; not a diagnostic authority.",
        "content": (
            "Keep reported symptoms separate from technician observations and confirmed faults. A test marked not tested is missing evidence, "
            "not a pass or failure. Change one variable at a time when practical, record observed results in plain language, and leave a diagnosis "
            "unconfirmed until a qualified technician has adequate evidence. A similar historical case is a comparison, not proof."
        ),
    },
    {
        "id": "FX-HISTORY-001",
        "title": "Using repair memory carefully",
        "kind": "Revix repair-history note",
        "scope": "Historical case retrieval",
        "source_url": None,
        "review_note": "Internal product workflow guidance; demo cases are fictional.",
        "content": (
            "Historical cases can help identify what was tried and what happened in a similar situation. Similarity is only a retrieval hint. "
            "Verify device model, symptoms, test conditions, and outcome before relying on an old case. Never infer technician error or component compatibility "
            "solely from repeated symptoms."
        ),
    },
]


def source_map() -> dict[str, dict[str, str | None]]:
    return {source["id"]: source for source in KNOWLEDGE_SOURCES}

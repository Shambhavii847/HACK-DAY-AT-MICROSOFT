# Fixora AI — Evidence-grounded repair intelligence

Fixora AI is a full-stack prototype for electronics repair technicians. It connects reported symptoms, technician-entered test results, AI-assisted next-check recommendations, and confirmed repair outcomes in one traceable workflow.

**Core product idea:** `Symptom → Test → Observed result → Suggested next check → Confirmed fault → Repair action → Outcome`

A general chatbot can suggest possible repairs. Fixora is designed to keep the evidence and final outcome attached to the repair record, so recommendations remain reviewable and future cases can retrieve technician-confirmed precedents.

> **Prototype and safety notice:** This software is decision support, not a diagnostic authority or manufacturer service manual. It must not replace qualified technician judgement. All starter repair records are fictional demonstrations and are visibly marked as samples. Generic prototype guidance is not manufacturer-specific service documentation.

## What works in this repository

- **Repair queue:** register, search, filter, and track cases by status and priority.
- **Diagnostic session:** record the actual result of a check, including `not tested` and `inconclusive` states.
- **Gemma 4 integration:** requests diagnostic reasoning from `gemma-4-26b-a4b-it` through the Gemini API from the FastAPI server. The API key never needs to be exposed to the browser.
- **Conservative fallback:** if no key is configured or the model call/response fails, explicit deterministic rules provide limited safety-first guidance. The UI labels this as local rule-based guidance, not an LLM response.
- **Evidence-linked recommendations:** hypotheses, evidence for/against, next checks, missing information, qualitative uncertainty, safety notes, known reference IDs, and limitations.
- **Repair memory:** basic keyword retrieval over completed records with technician-confirmed outcomes. The match is a retrieval aid, not a probability or proof.
- **Outcome capture:** store the confirmed fault, action taken, verification and resulting status.
- **Reviewed reference notes:** source IDs are allow-listed server-side. The model cannot add arbitrary source URLs to its evidence.
- **Data transparency:** sample records are tagged `demo`; newly created records are tagged `user_entered`.
- **Tests:** API tests cover health, sample-data labeling, case intake, diagnostic results, recommendation structure, safety escalation, and missing cases.

## Tech stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React, TypeScript, Vite | Responsive browser UI; approachable development workflow |
| UI icons | Lucide React | Consistent, lightweight interface icons |
| Backend | Python, FastAPI, Pydantic | Simple HTTP API with request/response validation |
| Database | SQLite, SQLAlchemy | Zero-service local persistence for the prototype |
| AI inference | Gemma 4 26B A4B via Gemini API | Hosted access to the selected open-weight model |
| Tests | pytest, FastAPI TestClient | Repeatable API-level checks |

Official model setup reference: [Run Gemma with the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api). The API model identifier used here is `gemma-4-26b-a4b-it`.

## Requirements

- macOS, Windows, or Linux
- Python 3.11+ recommended
- Node.js 20+ and npm
- An internet connection to install dependencies and call the Gemini API
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) to enable Gemma-powered recommendations

You do **not** need a local GPU to use the hosted Gemini API. Without an API key, the app still starts and demonstrates the workflow with labelled rule-based guidance.

## Quick start on macOS

1. Download and unzip this repository.
2. Open Terminal and go to the project directory:

   ```bash
   cd /path/to/fixora-ai
   ```

3. Start both services:

   ```bash
   ./start.sh
   ```

4. Open:
   - Frontend: <http://localhost:5173>
   - API health: <http://localhost:8000/api/health>
   - Interactive API docs: <http://localhost:8000/docs>

The first startup creates a Python virtual environment and installs the dependencies. It also creates `backend/.env` from `backend/.env.example` if it does not exist.

### Enable Gemma 4

Edit `backend/.env` and add your key:

```dotenv
GEMINI_API_KEY=your_real_key_here
GEMMA_MODEL=gemma-4-26b-a4b-it
DATABASE_URL=sqlite:///./fixora.db
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Stop the servers with `Ctrl+C` and restart `./start.sh`. Check the header and `http://localhost:8000/api/health`; `model_configured` should be `true`. This confirms the key is present, not that it is valid—the first recommendation request verifies actual API access. Never put this key in the frontend `.env`, commit it, or include it in screenshots or the public repository.

### Manual startup (alternative)

Terminal 1 — backend:

```bash
cd fixora-ai/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # only if .env does not already exist
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2 — frontend:

```bash
cd fixora-ai/frontend
npm install
npm run dev
```

## Demo walkthrough

1. Open **Overview** and explain that the sample dataset is fictional.
2. Open **Diagnostics** and select `FX-1048` (Samsung Galaxy A54, intermittent charging). It has sample observations already entered.
3. Click **Generate recommendation**. If the Gemini API key is configured, the backend attempts Gemma 4 inference; otherwise the UI clearly says **local rules**.
4. Show that the recommendation distinguishes a possible fault from a confirmed diagnosis, names evidence and missing information, suggests a next low-risk check, and surfaces the safety notes.
5. Add a new test result and generate again to demonstrate that the repair record is evidence-driven.
6. Save a technician-confirmed outcome and open **Repair memory** to find completed cases.
7. Show **Knowledge base** and explain that the included generic notes are prototype guidance rather than manufacturer service manuals.

For a clean presentation, use a sample case first and avoid entering private customer information.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend and model configuration state |
| `GET` | `/api/dashboard` | Summary counts and recent repairs |
| `GET` | `/api/cases` | Search/filter repair cases |
| `POST` | `/api/cases` | Register a repair |
| `GET` | `/api/cases/{id}` | Case, test evidence, and latest recommendation |
| `PATCH` | `/api/cases/{id}` | Update workflow status, priority, assignee, or estimates |
| `POST` | `/api/cases/{id}/tests` | Add a technician-entered test result |
| `POST` | `/api/cases/{id}/recommendation` | Generate and save diagnostic guidance |
| `GET` | `/api/cases/{id}/similar` | Retrieve similar completed cases |
| `POST` | `/api/cases/{id}/outcome` | Record fault, repair action, outcome, and status |
| `GET` | `/api/knowledge` | List reviewed prototype notes |

All endpoints are documented in the FastAPI docs at `/docs`.

## Run tests and build

Backend tests:

```bash
cd backend
source .venv/bin/activate
pytest -q
```

Frontend production build:

```bash
cd frontend
npm install
npm run build
```

## Deployment notes

The frontend can be hosted on a static site service. The FastAPI backend and SQLite database need a server or container with persistent storage; static hosting alone cannot run the Python backend. For a hosted demo, configure `VITE_API_BASE_URL` to your HTTPS backend URL, and set `GEMINI_API_KEY`, `CORS_ORIGINS`, and `DATABASE_URL` on the backend host. SQLite on an ephemeral filesystem will lose data after some hosting restarts; use a persistent disk or PostgreSQL before production use.

Do not deploy the demo with unrestricted public write access or place real customer information in the starter app. Production hardening would require authentication, per-workshop authorization, rate limits, backups, audit logs, stronger privacy controls, and database migrations.

## Project structure

```text
fixora-ai/
├── README.md
├── LICENSE
├── start.sh
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── app/
│   │   ├── ai_service.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── knowledge.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── seed.py
│   └── tests/
│       └── test_api.py
└── frontend/
    ├── .env.example
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── styles.css
        └── lib/
            ├── api.ts
            └── types.ts
```

## Honest limitations and next steps

- The current repair memory uses simple keyword overlap instead of embeddings/vector search. It is understandable and testable for a small prototype, but it is not semantic search.
- The included guidance is generic and deliberately conservative; add technician-reviewed, device-specific documentation with proper permissions before using it for real repair decisions.
- Model outputs can be wrong. Pydantic validates shape, source IDs are allow-listed, and technician confirmation is required, but schema validation cannot guarantee technical correctness.
- The app does not connect to real suppliers, inventory systems, manufacturer APIs, live parts availability, invoices, or payments.
- The dashboard's sample metrics include clearly marked fictional demo records; do not present them as customer or business statistics.
- No formal diagnostic-accuracy benchmark has been run. The included tests verify software behavior, not real-world repair accuracy.
- The app is a hackathon prototype, not production-ready multi-tenant repair-shop software.

## License

The project code is released under the MIT License. Gemma model access and use are subject to Google's applicable model and API terms. Third-party libraries keep their respective licenses.

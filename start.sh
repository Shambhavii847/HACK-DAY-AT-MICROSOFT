#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install it from https://www.python.org/downloads/"
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. Install the current LTS version from https://nodejs.org/"
  exit 1
fi

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  echo "Creating backend Python environment..."
  python3 -m venv "$BACKEND_DIR/.venv"
fi
source "$BACKEND_DIR/.venv/bin/activate"
if [[ ! -f "$BACKEND_DIR/.venv/.requirements-installed" || "$BACKEND_DIR/requirements.txt" -nt "$BACKEND_DIR/.venv/.requirements-installed" ]]; then
  python -m pip install -r "$BACKEND_DIR/requirements.txt"
  touch "$BACKEND_DIR/.venv/.requirements-installed"
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
fi

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "Created backend/.env. Add your GEMINI_API_KEY there to enable Gemma 4."
fi

echo
echo "Starting Fixora AI..."
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:8000"
echo "API docs: http://localhost:8000/docs"
echo "Press Ctrl+C to stop both servers."

(cd "$BACKEND_DIR" && exec ./.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!
(cd "$FRONTEND_DIR" && exec npm run dev -- --host 127.0.0.1) &
FRONTEND_PID=$!
cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait

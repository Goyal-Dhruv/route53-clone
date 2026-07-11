#!/usr/bin/env bash
# Starts backend (:8000) and frontend (:3000) together for local development.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting backend on http://localhost:8000 ..."
cd "$ROOT/backend"
python -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -q -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:3000 ..."
cd "$ROOT/frontend"
[ -d node_modules ] || npm install
[ -f .env.local ] || echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait

#!/usr/bin/env bash
# ===============================================================================
# FILE: run.sh
# ===============================================================================
# PURPOSE:
# Unified orchestrator to start the IntentQoS Management API backend and
# React Web Console frontend simultaneously with graceful shutdown, or run
# automated tests and benchmarks.
#
# USAGE:
#   ./run.sh             # Starts both Backend (port 8080) and Frontend (port 3000)
#   ./run.sh api         # Starts only the FastAPI Management Backend
#   ./run.sh frontend    # Starts only the React Web Console Frontend
#   ./run.sh test        # Runs all automated unit, integration, and stress tests
#   ./run.sh benchmark   # Runs all 5 baseline profiles across scenarios S1-S5
# ===============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Ensure Python virtual environment exists
if [ ! -d ".venv" ]; then
    echo "[!] Virtual environment not found. Creating .venv with Python 3.12..."
    uv venv --python 3.12 .venv
    uv pip install --python .venv/bin/python torch numpy pandas scikit-learn fastapi uvicorn pydantic pytest httpx
fi

PYTHON_BIN="$PROJECT_ROOT/.venv/bin/python"

case "$1" in
    api)
        echo "[*] Starting IntentQoS Management API on http://localhost:8080..."
        exec "$PYTHON_BIN" -m uvicorn api.server:app --host 0.0.0.0 --port 8080 --reload
        ;;

    frontend)
        echo "[*] Starting React Web Console on http://localhost:3000..."
        cd "$PROJECT_ROOT/Frontend/intentqos-—-adaptive-network-qos-console"
        exec npm run dev
        ;;

    test)
        echo "[*] Running automated test suite (pytest)..."
        exec "$PYTHON_BIN" -m pytest tests/ -v
        ;;

    benchmark)
        echo "[*] Running end-to-end baseline comparison benchmarks..."
        exec "$PYTHON_BIN" scripts/run_experiments.py
        ;;

    *)
        echo "================================================================="
        echo "              Starting IntentQoS Full Stack                      "
        echo "================================================================="
        echo "  [1/2] Management API Backend : http://localhost:8080          "
        echo "  [2/2] Web Console Frontend   : http://localhost:3000          "
        echo "================================================================="

        # Cleanup trap to kill child processes on exit (Ctrl+C)
        cleanup() {
            echo ""
            echo "[*] Shutting down services..."
            if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
                kill "$API_PID" 2>/dev/null || true
            fi
            exit 0
        }
        trap cleanup SIGINT SIGTERM EXIT

        # Start API backend in background
        "$PYTHON_BIN" -m uvicorn api.server:app --host 0.0.0.0 --port 8080 --log-level warning &
        API_PID=$!
        echo "[+] Backend API started (PID: $API_PID)"

        # Wait briefly for backend to initialize
        sleep 1.5

        # Verify backend health
        if curl -s http://localhost:8080/health | grep -q '"status":"ok"'; then
            echo "[+] Backend health probe verified: OK"
        else
            echo "[!] Warning: Backend health probe did not respond immediately, continuing..."
        fi

        echo "[+] Launching Frontend Web Console..."
        echo "-----------------------------------------------------------------"
        echo ">>> Open your browser at: http://localhost:3000"
        echo ">>> Press Ctrl+C at any time to stop both services."
        echo "-----------------------------------------------------------------"

        cd "$PROJECT_ROOT/Frontend/intentqos-—-adaptive-network-qos-console"
        npm run dev
        ;;
esac

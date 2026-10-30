# IntentQoS — Operations & Execution Runbook

**Project:** IntentQoS — Adaptive QoS Engine for Mixed Home Broadband Traffic  
**Date:** 30 October 2026  
**Document Status:** Complete & Verified  

---

## 1. Quickstart & Verification Commands

### 1.1 Environment Setup
The repository includes a Python virtual environment (`.venv`) using Python 3.12 with all required dependencies installed:

```bash
# Verify virtual environment
.venv/bin/python --version
# Expected: Python 3.12.x
```

### 1.2 Running the Model Sanity & Latency Checks
```bash
# Verify model architectures can forward tensors
.venv/bin/python sanity_check.py

# Benchmark CPU inference latency of the INT8 quantized deployment model
.venv/bin/python scripts/measure_latency.py --model checkpoints/home_cnn_quantized.pt --samples 500
# Expected: Median latency <= 0.020 ms (sub-millisecond!)
```

### 1.3 Generating Training Data & Retraining
```bash
# Generate 14,000 session-separated residential traffic flows
.venv/bin/python scripts/generate_home_dataset.py --samples-per-class 2000 --sessions 10

# Train Nano-Stream Tiny1DCNN with session-grouped splits & best-checkpoint saving
.venv/bin/python train.py --model cnn --data data/home_traffic.csv --features docs/data/schema_manifest.json --out checkpoints/home_cnn.pt --epochs 15

# Quantize trained checkpoint to TorchScript INT8
.venv/bin/python scripts/quantize_run.py --float checkpoints/home_cnn.pt --out checkpoints/home_cnn_quantized.pt --csv data/home_traffic.csv --features docs/data/schema_manifest.json
```

### 1.4 Running the Automated Benchmark Matrix
```bash
# Execute all 5 baseline profiles across scenarios and generate report
.venv/bin/python scripts/run_experiments.py
# Outputs:
#   - results/benchmark_results.json
#   - results/benchmark_summary.md
```

### 1.5 Running the Automated Test Suite
```bash
.venv/bin/python -m pytest tests/ -v
```

---

## 2. Starting the Services

### 2.1 Starting the FastAPI Management API Server
In terminal 1:
```bash
.venv/bin/python -m uvicorn api.server:app --host 0.0.0.0 --port 8080
```
Verify the API health probe:
```bash
curl -s http://localhost:8080/health | jq
```

### 2.2 Starting the React Frontend Web Console
In terminal 2:
```bash
cd Frontend/intentqos-—-adaptive-network-qos-console
npm run dev
```
Open your browser at `http://localhost:3000` (or `http://localhost:5173`).
- **DEMO / REPLAY mode:** Works out of the box with deterministic simulation (seed=42026).
- **LIVE mode:** Automatically probes `http://localhost:8080/api/health`, fetches live telemetry from the FastAPI server, and displays live measured traffic.

---

## 3. Troubleshooting & Failure Recovery

| Issue | Cause | Recovery Action |
|---|---|---|
| Frontend shows `Live Telemetry Withheld` | Backend API not running or unreachable on port 8080 | Start API server via `.venv/bin/python -m uvicorn api.server:app --port 8080` or toggle back to `DEMO / REPLAY` mode. |
| Model file missing or corrupt | Checkpoint path altered | `models/model_loader.py` automatically falls back to deterministic rule-based safe classification without crashing. Run `scripts/quantize_run.py` to regenerate the checkpoint. |
| `tc: Operation not permitted` | Linux `tc` requires `CAP_NET_ADMIN` or root | The adapter detects non-root execution and defaults to safe `DRY_RUN` mode with simulated read-backs. |
| Intent expired | TTL passed server-side | Intents naturally expire after their configured duration. To extend, submit a new intent via the UI or API. |

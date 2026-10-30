"""
===============================================================================
FILE: scripts/measure_latency.py
===============================================================================

PURPOSE
-------
Measures CPU inference latency for a TorchScript model artifact with
high-resolution monotonic benchmarking, shape verification, and latency
distribution reporting.

The script reports:

    median latency (P50)
    P95 latency
    P99 latency
    mean and standard deviation

in milliseconds and microseconds.

ROLE IN NANOSTREAM
------------------
This is the DEPLOYMENT BENCHMARKING stage.

It quantifies the real CPU latency of Nano-Stream model artifacts on the
target hardware platform.

PIPELINE POSITION
-----------------

    float_scripted.pt / cnn_quantized.pt
            ↓
    scripts/measure_latency.py
            ↓
    P50 / P95 / P99 latency distribution & JSON export

INPUT
-----
Command-line arguments:

    --model   : Path to TorchScript model file (.pt)
    --shape   : Optional explicit input shape tuple (e.g. "1,1,14" or "1,14")
    --samples : Number of benchmark iterations (default: 1000)
    --warmup  : Number of untimed warmup iterations (default: 50)
    --threads : Number of intra-op CPU threads (default: 1)
    --out     : Optional path to save JSON benchmark report with raw samples

SHAPE RESOLUTION
----------------
Instead of fragile filename substring heuristics, this script uses explicit
shape arguments or shape auto-probing to verify compatibility before benchmarking.

DEPENDENCIES
------------
PyTorch, NumPy, Python standard library (time, platform, json).

===============================================================================
"""

import argparse
import json
import os
import platform
import time
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch


def detect_input_shape(model: torch.jit.ScriptModule, candidate_shapes: Optional[List[Tuple[int, ...]]] = None) -> Tuple[int, ...]:
    """
    Safely determine the valid input shape for a TorchScript model artifact.

    Args:
        model: Loaded TorchScript ScriptModule.
        candidate_shapes: List of shape tuples to probe.

    Returns:
        Valid shape tuple.

    Raises:
        ValueError: If none of the candidate shapes are accepted by the model.
    """
    if candidate_shapes is None:
        candidate_shapes = [(1, 1, 14), (1, 14)]

    for shape in candidate_shapes:
        try:
            dummy = torch.randn(*shape, dtype=torch.float32)
            with torch.no_grad():
                _ = model(dummy)
            return shape
        except Exception:
            continue

    raise ValueError(f"Unable to find compatible input shape among candidates: {candidate_shapes}")


def run_latency_benchmark(
    model_path: str,
    explicit_shape: Optional[Tuple[int, ...]] = None,
    n_samples: int = 1000,
    n_warmup: int = 50,
    num_threads: int = 1,
) -> Dict[str, object]:
    """
    Execute high-resolution CPU inference latency benchmark.

    Args:
        model_path: Absolute or relative path to .pt TorchScript model.
        explicit_shape: Explicit shape tuple if specified.
        n_samples: Number of timed inference iterations.
        n_warmup: Warm-up passes.
        num_threads: PyTorch intra-op CPU threads.

    Returns:
        Dictionary containing summary statistics, environment metadata, and raw samples.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")

    torch.set_num_threads(num_threads)
    model = torch.jit.load(model_path, map_location="cpu")
    model.eval()

    if explicit_shape:
        input_shape = explicit_shape
    else:
        input_shape = detect_input_shape(model)

    dummy_input = torch.randn(*input_shape, dtype=torch.float32)

    # Warmup phase
    with torch.no_grad():
        for _ in range(n_warmup):
            _ = model(dummy_input)

    # Timed inference using high-resolution monotonic timer
    times_ms: List[float] = []
    with torch.no_grad():
        for _ in range(n_samples):
            t0 = time.perf_counter()
            _ = model(dummy_input)
            t1 = time.perf_counter()
            times_ms.append((t1 - t0) * 1000.0)

    arr = np.array(times_ms, dtype=np.float64)
    p50 = float(np.percentile(arr, 50))
    p95 = float(np.percentile(arr, 95))
    p99 = float(np.percentile(arr, 99))
    mean = float(np.mean(arr))
    std = float(np.std(arr))

    report = {
        "modelPath": model_path,
        "inputShape": list(input_shape),
        "sampleCount": n_samples,
        "warmupCount": n_warmup,
        "numThreads": num_threads,
        "environment": {
            "platform": platform.platform(),
            "processor": platform.processor(),
            "pythonVersion": platform.python_version(),
            "torchVersion": torch.__version__,
        },
        "metricsMs": {
            "p50Median": round(p50, 4),
            "p95": round(p95, 4),
            "p99": round(p99, 4),
            "mean": round(mean, 4),
            "stdDev": round(std, 4),
        },
        "metricsUs": {
            "p50MedianUs": round(p50 * 1000.0, 1),
            "p95Us": round(p95 * 1000.0, 1),
            "p99Us": round(p99 * 1000.0, 1),
            "meanUs": round(mean * 1000.0, 1),
        },
        "rawTimesMs": times_ms,
    }

    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Measure CPU inference latency for TorchScript models.")
    parser.add_argument("--model", required=True, help="Path to TorchScript model file")
    parser.add_argument("--shape", type=str, default=None, help="Explicit comma-separated shape (e.g. 1,1,14)")
    parser.add_argument("--samples", type=int, default=1000, help="Benchmark sample count")
    parser.add_argument("--warmup", type=int, default=50, help="Warm-up sample count")
    parser.add_argument("--threads", type=int, default=1, help="PyTorch CPU thread count")
    parser.add_argument("--out", type=str, default=None, help="Optional output JSON path")

    args = parser.parse_args()

    explicit = None
    if args.shape:
        explicit = tuple(int(x.strip()) for x in args.shape.split(","))

    result = run_latency_benchmark(
        model_path=args.model,
        explicit_shape=explicit,
        n_samples=args.samples,
        n_warmup=args.warmup,
        num_threads=args.threads,
    )

    stats = result["metricsMs"]
    us_stats = result["metricsUs"]
    print(
        f"Model: {args.model} | Shape: {result['inputShape']} | Threads: {args.threads}\n"
        f"  P50 (Median) : {stats['p50Median']:.4f} ms ({us_stats['p50MedianUs']:.1f} µs)\n"
        f"  P95          : {stats['p95']:.4f} ms ({us_stats['p95Us']:.1f} µs)\n"
        f"  P99          : {stats['p99']:.4f} ms ({us_stats['p99Us']:.1f} µs)\n"
        f"  Mean ± Std   : {stats['mean']:.4f} ± {stats['stdDev']:.4f} ms"
    )

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w") as f:
            json.dump(result, f, indent=2)
        print(f"[*] Benchmark report saved -> {args.out}")

"""
===============================================================================
FILE: scripts/measure_latency.py
===============================================================================

PURPOSE
-------
Measures CPU inference latency for a TorchScript model.

The script reports:

    median latency
    P95 latency

in milliseconds.

ROLE IN NANOSTREAM
------------------
This is the DEPLOYMENT BENCHMARKING stage.

It is intended to quantify the latency advantage of the optimized
Nano-Stream model.

PIPELINE POSITION
-----------------

    float_scripted.pt
          OR
    cnn_quantized.pt
          ↓
    measure_latency.py
          ↓
    median / P95 latency

INPUT
-----
Command-line argument:

    --model

Expected input:

    TorchScript model file

Examples:

    checkpoints/float_scripted.pt
    checkpoints/cnn_quantized.pt

MODEL LOADING
-------------
Uses:

    torch.jit.load()

with:

    map_location="cpu"

Therefore the current benchmark is CPU-only.

INPUT SHAPE LOGIC
-----------------
The current implementation determines the model input shape by checking
whether the model path contains the string:

    "cnn"

If true:

    (1, 1, 14)

Otherwise:

    (1, 14)

THIS IS A BUG.
-------------
The actual Tiny1DCNN TorchScript model requires:

    (1, 1, 14)

The file:

    checkpoints/float_scripted.pt

does not contain "cnn" in its filename.

Therefore the script incorrectly creates:

    (1, 14)

for float_scripted.pt.

This causes a runtime shape error.

CORRECT BEHAVIOR
----------------
Both:

    float_scripted.pt
    cnn_quantized.pt

should currently receive:

    (1, 1, 14)

FUNCTION / PROCESS
------------------
1. Parse model path.
2. Load TorchScript model.
3. Select input shape.
4. Generate random input.
5. Perform 50 warm-up inferences.
6. Run 1000 timed inferences.
7. Convert measurements to milliseconds.
8. Calculate median.
9. Calculate P95.
10. Print results.

BENCHMARK OUTPUT
----------------
Console output:

    Median: X ms | P95: Y ms

No result file is currently generated.

CHECK 2
-------
Quantized CNN:

    checkpoints/cnn_quantized.pt
        → PASS

Float TorchScript:

    checkpoints/float_scripted.pt
        → FAIL

Failure reason:

    incorrect 2D input shape supplied to a 3D CNN TorchScript model.

THIS IS A CONFIRMED BUG.

ADDITIONAL BENCHMARKING LIMITATIONS
------------------------------------
1. Input-shape selection depends on filename rather than model metadata.

2. Uses time.time() for timing.

3. Does not use a high-resolution monotonic benchmark timer.

4. Measures each inference through a Python loop.

5. Does not report mean latency.

6. Does not report standard deviation.

7. Does not record CPU/system information alongside the benchmark.

PAPER RELATIONSHIP
------------------
The paper reports:

    FP32 latency  ≈ 2.00 ms/flow
    INT8 latency  ≈ 1.17 ms/flow

This script reports median/P95 latency, so the exact relationship between
these reported paper values and this script must be established before
claiming that this script reproduces the paper benchmark.

V1 ACTION
---------
MODIFY.

Replace filename-based shape detection with explicit model metadata or
model-specific configuration.

Improve timing methodology before using this script as a serious benchmark.

===============================================================================
"""

#measure_latency.py

import argparse, time, torch, numpy as np

def run_latency(model_path, n=1000):
    # Load scripted model
    model = torch.jit.load(model_path, map_location="cpu")
    model.eval()
    
    # Create dummy input (1 sample, 14 features)
    # We try to infer input shape. Assuming (1, 1, 14) based on training.
    if "cnn" in model_path:
        dummy_input = torch.randn(1, 1, 14)   # Conv1D deployment shape
    else:
        dummy_input = torch.randn(1, 14)      # sequence models

    # Warmup
    for _ in range(50):
        _ = model(dummy_input)
        
    # Measure
    times = []
    with torch.no_grad():
        for _ in range(n):
            t0 = time.time()
            _ = model(dummy_input)
            t1 = time.time()
            times.append((t1 - t0) * 1000) # Convert to ms

    arr = np.array(times)
    return np.median(arr), np.percentile(arr, 95)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--model", required=True)
    args = p.parse_args()
    
    med, p95 = run_latency(args.model)
    print(f"Median: {med:.4f} ms | P95: {p95:.4f} ms")
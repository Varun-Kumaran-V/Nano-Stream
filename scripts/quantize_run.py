"""
===============================================================================
FILE: scripts/quantize_run.py
===============================================================================

PURPOSE
-------
Performs post-training dynamic quantization of the trained Tiny1DCNN and
creates a TorchScript deployment artifact.

ROLE IN NANOSTREAM
------------------
This is the FP32 → INT8 DEPLOYMENT/OPTIMIZATION stage.

PIPELINE POSITION
-----------------

    checkpoints/float.pt
            ↓
    load FP32 Tiny1DCNN
            ↓
    evaluate FP32
            ↓
    dynamic INT8 quantization
            ↓
    TorchScript tracing
            ↓
    quantized checkpoint
            ↓
    evaluate quantized model

INPUTS
------
Command-line arguments:

    --float
    --out
    --csv
    --features

Typical values:

    --float
        checkpoints/float.pt

    --out
        checkpoints/cnn_quantized.pt

    --csv
        data/cicids2017_slice.csv

    --features
        features.json

FUNCTION: load_data()
---------------------
INPUT:

    CSV path
    feature list

PROCESS:

    1. Load CSV.
    2. Select the requested features.
    3. Extract labels.
    4. Encode labels.
    5. Select the final 10% of the dataset.

OUTPUT:

    X
    y
    number of classes

IMPORTANT:
----------
The evaluation data is the LAST 10% of the CSV.

This is not equivalent to a random 10% test split and is not the same as the
paper's stated 15% test split.

FUNCTION: eval_model()
---------------------
INPUT:

    model
    X
    y
    device

PROCESS:

    1. Move model to device.
    2. Convert NumPy data to PyTorch tensor.
    3. Add CNN channel dimension.
    4. Perform inference.
    5. Calculate classification accuracy.

OUTPUT:

    accuracy

QUANTIZATION
------------
The script uses PyTorch dynamic quantization with:

    dtype = torch.qint8

The quantization target is:

    torch.nn.Linear

IMPORTANT TECHNICAL FACT
------------------------
The current implementation does NOT dynamically INT8-quantize the Conv1D
layers.

The quantization therefore applies to the Linear layers, while the
convolutional layers remain non-dynamically-quantized operations.

This distinction MUST be preserved in project documentation.

OUTPUT
------
The path specified by:

    --out

For the current repository:

    checkpoints/cnn_quantized.pt

CHECK 2
-------
Quantization code path:
    PASS

TorchScript generation:
    PASS

Quantized model loading:
    PASS

Quantized inference:
    PASS

Actual repository quantized artifact:
    VERIFIED

REAL-DATA REPRODUCTION:
    NOT VERIFIED because the uploaded ZIP did not contain the working-tree
    dataset.

WARNINGS
--------
Current PyTorch emitted a deprecation warning for the older
torch.quantization.quantize_dynamic API.

This does not currently prevent execution.

EVALUATION METHODOLOGY ISSUE
----------------------------
The script uses the final 10% of the CSV as its evaluation subset.

Therefore its accuracy result should not automatically be described as the
paper's independent 15% test accuracy.

MODEL-SIZE WARNING
------------------
The serialized TorchScript quantized file is not directly comparable in size
to float.pt because:

    float.pt
        = raw state_dict

    cnn_quantized.pt
        = TorchScript deployment artifact with packed parameters and graph

Therefore the existence of a larger serialized quantized file does NOT prove
quantization failed, but it also means the project should not claim a 4× file
size reduction without a proper memory/weight-size measurement.

V1 ACTION
---------
KEEP.

Later improve:

    - evaluation split handling
    - quantization API
    - model-size measurement
    - metadata preservation

===============================================================================
"""

#quantize_run.py

import sys
import os
# --- PATH FIX: Allow importing from parent directory ---
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import argparse, time, json
import torch, numpy as np, pandas as pd
from models.tiny_1d_cnn import Tiny1DCNN
from sklearn.preprocessing import LabelEncoder

def load_data(csv_path, feature_list):
    df = pd.read_csv(csv_path)
    X = df[feature_list].values.astype("float32")
    y_raw = df["label"].values
    le = LabelEncoder()
    y = le.fit_transform(y_raw)
    
    n = len(X)
    cutoff = int(n * 0.9)
    return X[cutoff:], y[cutoff:], len(le.classes_)

def eval_model(model, X, y, device):
    model.to(device).eval()
    xs = torch.from_numpy(X).to(device)
    ys = torch.from_numpy(y).long().to(device)
    
    if xs.ndim == 2:
        xs = xs.unsqueeze(1)
        
    with torch.no_grad():
        outs = model(xs)
        preds = outs.argmax(dim=1)
        acc = (preds == ys).float().mean().item()
    return acc

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--float", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--csv", required=True)
    p.add_argument("--features", required=True)
    args = p.parse_args()

    with open(args.features, 'r') as f:
        feature_list = json.load(f)
    X_val, y_val, n_classes = load_data(args.csv, feature_list)
    n_features = X_val.shape[1]

    print("[*] Loading Float Model...")
    float_model = Tiny1DCNN(n_features=n_features, n_classes=n_classes)
    float_model.load_state_dict(torch.load(args.float, map_location="cpu"))
    float_acc = eval_model(float_model, X_val, y_val, "cpu")
    print(f"[+] Float Model Accuracy: {float_acc:.4f}")

    print("[*] Quantizing (Dynamic Int8)...")
    quantized_model = torch.quantization.quantize_dynamic(
        float_model, {torch.nn.Linear}, dtype=torch.qint8
    )

    print("[*] Scripting Model for deployment...")
    example_input = torch.randn(1, 1, n_features)
    scripted_model = torch.jit.trace(quantized_model, example_input)
    
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    scripted_model.save(args.out)
    print(f"[+] Saved Quantized Model to: {args.out}")

    q_acc = eval_model(scripted_model, X_val, y_val, "cpu")
    print(f"[+] Quantized Model Accuracy: {q_acc:.4f}")

if __name__ == "__main__":
    main()
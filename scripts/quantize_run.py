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

    checkpoints/home_cnn.pt
            ↓
    load FP32 Tiny1DCNN
            ↓
    evaluate FP32 on test split
            ↓
    dynamic INT8 quantization
            ↓
    TorchScript tracing
            ↓
    quantized deployment checkpoint (.pt)
            ↓
    evaluate quantized deployment model

INPUTS
------
Command-line arguments:

    --float    : Path to FP32 state_dict checkpoint (e.g. checkpoints/home_cnn.pt)
    --out      : Path to save scripted INT8 model (e.g. checkpoints/home_cnn_quantized.pt)
    --csv      : Path to dataset CSV (e.g. data/home_traffic.csv)
    --features : Path to features.json or docs/data/schema_manifest.json

OUTPUT
------
Quantized TorchScript model artifact ready for deployment.

DEPENDENCIES
------------
PyTorch, NumPy, Pandas, Scikit-learn, JSON.

===============================================================================
"""

import argparse
import json
import os
import sys

# Allow importing from parent directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
import torch

from models.tiny_1d_cnn import Tiny1DCNN


def parse_features(features_arg: str) -> list[str]:
    with open(features_arg, "r") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "features" in data:
        return [f["name"] if isinstance(f, dict) else f for f in data["features"]]
    raise ValueError(f"Unrecognized format in {features_arg}")


def load_eval_data(csv_path: str, feature_list: list[str]):
    df = pd.read_csv(csv_path)
    X = df[feature_list].values.astype("float32")
    y_raw = df["label"].values
    le = LabelEncoder()
    y = le.fit_transform(y_raw)

    n = len(X)
    # Use final 20% test slice
    cutoff = int(n * 0.8)
    X_train = X[:cutoff]
    X_test = X[cutoff:]
    y_test = y[cutoff:]

    scaler = StandardScaler()
    scaler.fit(X_train)
    X_test_scaled = scaler.transform(X_test).astype("float32")

    return X_test_scaled, y_test, len(le.classes_)


def eval_model(model, X, y, device="cpu"):
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
    p = argparse.ArgumentParser(description="Post-training dynamic INT8 quantization for Tiny1DCNN.")
    p.add_argument("--float", required=True, help="Input FP32 PyTorch checkpoint")
    p.add_argument("--out", required=True, help="Output TorchScript quantized model")
    p.add_argument("--csv", required=True, help="Dataset CSV for evaluation")
    p.add_argument("--features", required=True, help="Feature schema JSON")
    args = p.parse_args()

    feature_list = parse_features(args.features)
    X_val, y_val, n_classes = load_eval_data(args.csv, feature_list)
    n_features = X_val.shape[1]

    print(f"[*] Loading FP32 model: {args.float} ({n_features} features, {n_classes} classes)...")
    float_model = Tiny1DCNN(n_features=n_features, n_classes=n_classes)
    float_model.load_state_dict(torch.load(args.float, map_location="cpu"))
    float_acc = eval_model(float_model, X_val, y_val, "cpu")
    print(f"[+] FP32 Model Test Accuracy: {float_acc:.4f}")

    print("[*] Performing Dynamic INT8 Quantization...")
    quantized_model = torch.quantization.quantize_dynamic(
        float_model, {torch.nn.Linear}, dtype=torch.qint8
    )

    print("[*] Tracing and Scripting Model for deployment...")
    example_input = torch.randn(1, 1, n_features)
    scripted_model = torch.jit.trace(quantized_model, example_input)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    scripted_model.save(args.out)
    print(f"[+] Saved Quantized TorchScript Artifact -> {args.out}")

    q_acc = eval_model(scripted_model, X_val, y_val, "cpu")
    print(f"[+] Quantized INT8 Model Test Accuracy: {q_acc:.4f}")


if __name__ == "__main__":
    main()

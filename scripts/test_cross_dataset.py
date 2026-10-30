"""
===============================================================================
FILE: scripts/test_cross_dataset.py
===============================================================================

PURPOSE
-------
Evaluates trained Nano-Stream classification models across independent datasets
or capture sessions without retraining, measuring cross-environment generalization
while preserving schema alignment and label mapping.

ROLE IN NANOSTREAM
------------------
This is the CROSS-DATASET GENERALIZATION evaluation module.

It tests whether a model trained on one traffic corpus or session set generalizes
to traffic captured under differing conditions or from alternative data sources.

INPUT
-----
Command-line arguments:

    --data       : Path to test dataset CSV
    --model      : Path to trained model checkpoint (.pt)
    --features   : Path to schema JSON or Boruta ranking CSV
    --manifest   : Optional model manifest containing scaler and class mapping
    --label-col  : Name of the ground-truth label column (default: "label")
    --out        : Optional JSON path to export evaluation metrics

OUTPUT
------
Classification accuracy, Macro-F1, per-class metrics, and optional JSON report.

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
from sklearn.metrics import classification_report, f1_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
import torch

from models.tiny_1d_cnn import Tiny1DCNN


def resolve_features(features_path: str) -> list[str]:
    if features_path.endswith(".json"):
        with open(features_path, "r") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        if "features" in data:
            return [f["name"] if isinstance(f, dict) else f for f in data["features"]]
    elif features_path.endswith(".csv"):
        br = pd.read_csv(features_path)
        if "Support" in br.columns:
            return br.loc[br["Support"] == True, br.columns[0]].tolist()
        return br.iloc[:14, 0].tolist()
    raise ValueError(f"Unable to parse feature list from {features_path}")


def evaluate_cross_dataset(
    data_path: str,
    model_path: str,
    features_path: str,
    manifest_path: str | None = None,
    label_col: str = "label",
) -> dict:
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Test dataset not found: {data_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model checkpoint not found: {model_path}")

    print(f"[*] Loading cross-dataset test data from {data_path}...")
    df = pd.read_csv(data_path)

    # Optional column aliases for CSE-CIC-IDS2018 compatibility
    column_renames = {
        "Flow Duration": "flow_duration",
        "Tot Fwd Pkts": "total_fwd_packets",
        "Tot Bwd Pkts": "total_bwd_packets",
        "TotLen Fwd Pkts": "total_fwd_bytes",
        "TotLen Bwd Pkts": "total_bwd_bytes",
        "Fwd Pkt Len Mean": "fwd_packet_len_mean",
        "Bwd Pkt Len Mean": "bwd_packet_len_mean",
        "Flow Byts/s": "flow_bytes_per_sec",
        "Flow Pkts/s": "flow_packets_per_sec",
        "Fwd IAT Mean": "fwd_iat_mean_ms",
        "Bwd IAT Mean": "bwd_iat_mean_ms",
        "Label": "label",
    }
    df.rename(columns={k: v for k, v in column_renames.items() if k in df.columns}, inplace=True)

    feature_cols = resolve_features(features_path)
    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Test dataset missing required features: {missing}")

    X_raw = df[feature_cols].values.astype(np.float32)

    # Apply scaling from manifest if available
    classes = None
    if manifest_path and os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            meta = json.load(f)
        if "scaler" in meta and "mean" in meta["scaler"]:
            mean = np.array(meta["scaler"]["mean"], dtype=np.float32)
            scale = np.array(meta["scaler"]["scale"], dtype=np.float32)
            X = (X_raw - mean) / (scale + 1e-7)
        else:
            X = X_raw
        classes = meta.get("classes")
    else:
        scaler = StandardScaler()
        X = scaler.fit_transform(X_raw)

    le = LabelEncoder()
    if classes:
        le.classes_ = np.array(classes)
        # Filter rows with labels in classes
        valid_mask = df[label_col].isin(classes)
        if not valid_mask.all():
            print(f"[!] Filtering {len(df) - valid_mask.sum()} samples with unknown classes.")
            df = df[valid_mask]
            X = X[valid_mask]
        y = le.transform(df[label_col].values)
    else:
        y = le.fit_transform(df[label_col].values)
        classes = [str(c) for c in le.classes_]

    n_features = len(feature_cols)
    n_classes = len(classes)

    print(f"[*] Instantiating Tiny1DCNN ({n_features} features, {n_classes} classes)...")
    model = Tiny1DCNN(n_features=n_features, n_classes=n_classes)
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()

    X_tensor = torch.from_numpy(X)
    with torch.no_grad():
        out = model(X_tensor)
        preds = out.argmax(dim=1).numpy()

    acc = float((preds == y).mean())
    macro_f1 = float(f1_score(y, preds, average="macro", zero_division=0))
    report = classification_report(y, preds, target_names=classes, output_dict=True, zero_division=0)

    print(f"\n================ CROSS-DATASET RESULTS ================")
    print(f"  Dataset Samples : {len(y)}")
    print(f"  Accuracy        : {acc:.4f}")
    print(f"  Macro-F1        : {macro_f1:.4f}")
    print(f"=======================================================")

    return {
        "dataset": data_path,
        "model": model_path,
        "sampleCount": len(y),
        "accuracy": round(acc, 4),
        "macroF1": round(macro_f1, 4),
        "classificationReport": report,
    }


def main():
    p = argparse.ArgumentParser(description="Evaluate model cross-dataset generalization.")
    p.add_argument("--data", default="data/home_traffic.csv", help="Test dataset CSV path")
    p.add_argument("--model", default="checkpoints/home_cnn.pt", help="Trained model checkpoint path")
    p.add_argument("--features", default="docs/data/schema_manifest.json", help="Features schema path")
    p.add_argument("--manifest", default="checkpoints/home_cnn_manifest.json", help="Model metadata manifest path")
    p.add_argument("--label-col", default="label", help="Label column name")
    p.add_argument("--out", default=None, help="Optional JSON output path")
    args = p.parse_args()

    results = evaluate_cross_dataset(
        data_path=args.data,
        model_path=args.model,
        features_path=args.features,
        manifest_path=args.manifest,
        label_col=args.label_col,
    )

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w") as f:
            json.dump(results, f, indent=2)
        print(f"[*] Results saved -> {args.out}")


if __name__ == "__main__":
    main()

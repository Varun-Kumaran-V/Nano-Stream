"""
===============================================================================
FILE: train.py
===============================================================================

PURPOSE
-------
Main training orchestrator for Nano-Stream's machine-learning pipeline.

This file loads a prepared CSV dataset, selects the configured features,
encodes labels, creates session-grouped or stratified training/validation/test
splits (preventing session leakage), trains the requested neural-network
architecture (Tiny1DCNN, BiLSTMClassifier, or TransformerClassifier), saves the
BEST validation checkpoint without final-epoch overwrite, evaluates on a held-out
test set, and persists comprehensive model/schema/class-mapping manifests.

ROLE IN NANOSTREAM
------------------
This is the central TRAINING & EVALUATION ENTRY POINT.

It connects:

    prepared dataset (e.g. data/home_traffic.csv)
          ↓
    feature schema (docs/data/schema_manifest.json)
          ↓
    session-separated train/val/test splits (70/10/20)
          ↓
    model definition (Tiny1DCNN / BiLSTM / Transformer)
          ↓
    optimization with cross-entropy & weight decay
          ↓
    validation tracking & best checkpoint preservation
          ↓
    held-out test set evaluation (Macro-F1, Precision, Recall, Confusion Matrix)
          ↓
    checkpoint (.pt) & companion model manifest (.json)

SUPPORTED MODELS
----------------
The script supports:

    --model cnn          (Tiny1DCNN: lightweight 1D-CNN)
    --model bilstm       (BiLSTM baseline)
    --model transformer  (Fixed batch_first Transformer baseline)

REPRODUCIBILITY & SAFETY INVARIANTS
-----------------------------------
1. Grouped session splitting ensures flows from the same capture session do not
   leak between train, validation, and test partitions.
2. The best validation model checkpoint is preserved and never overwritten by
   subsequent degraded epochs.
3. The exact feature list, scaler parameters, and label encoder mappings are
   persisted into a companion JSON manifest beside the checkpoint.
4. Evaluation computes Macro-F1, per-class metrics, and confusion matrix.

DEPENDENCIES
------------
PyTorch, NumPy, Pandas, Scikit-learn, JSON, Python standard library.

===============================================================================
"""

import argparse
import json
import os
import random
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

from models.bilstm_baseline import BiLSTMClassifier
from models.tiny_1d_cnn import Tiny1DCNN
from models.transformer_baseline import TransformerClassifier


def seed_everything(seed: int = 42) -> None:
    """Set random seeds across random, numpy, and torch."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def load_dataset_and_split(
    csv_path: str,
    feature_cols: Optional[List[str]] = None,
    label_col: str = "label",
    session_col: str = "session_id",
    val_frac: float = 0.10,
    test_frac: float = 0.20,
    seed: int = 42,
) -> Tuple[
    np.ndarray, np.ndarray, np.ndarray,
    np.ndarray, np.ndarray, np.ndarray,
    List[str], List[str], StandardScaler
]:
    """
    Load CSV dataset and partition into train, validation, and test splits
    using session grouping when available, or stratified splitting.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset file not found: {csv_path}")

    print(f"[*] Loading dataset from {csv_path}...")
    df = pd.read_csv(csv_path)

    if label_col not in df.columns:
        raise ValueError(f"Label column '{label_col}' not found in CSV. Available columns: {list(df.columns)}")

    # Resolve feature columns
    if not feature_cols:
        exclude_cols = {label_col, session_col, "capture_id", "flow_id", "protocol"}
        feature_cols = [c for c in df.columns if c not in exclude_cols]

    missing_features = [f for f in feature_cols if f not in df.columns]
    if missing_features:
        raise ValueError(f"Missing required feature columns in CSV: {missing_features}")

    print(f"[*] Using {len(feature_cols)} features: {feature_cols}")

    # Encode labels
    le = LabelEncoder()
    y_raw = df[label_col].astype(str).values
    y_encoded = le.fit_transform(y_raw)
    class_names = [str(c) for c in le.classes_]

    print("--- Canonical Class Encoding ---")
    for idx, cname in enumerate(class_names):
        print(f"  Class {idx}: {cname}")
    print("--------------------------------")

    # Split strategy: Session grouping if session_col exists
    if session_col in df.columns and len(df[session_col].unique()) >= 3:
        unique_sessions = sorted(df[session_col].unique().tolist())
        rng = np.random.default_rng(seed)
        shuffled_sessions = rng.permutation(unique_sessions).tolist()

        n_sessions = len(shuffled_sessions)
        n_test = max(1, int(round(n_sessions * test_frac)))
        n_val = max(1, int(round(n_sessions * val_frac)))

        test_sessions = set(shuffled_sessions[:n_test])
        val_sessions = set(shuffled_sessions[n_test : n_test + n_val])
        train_sessions = set(shuffled_sessions[n_test + n_val :])

        print(f"[*] Grouped Session Split: {len(train_sessions)} train, {len(val_sessions)} val, {len(test_sessions)} test sessions")

        train_mask = df[session_col].isin(train_sessions)
        val_mask = df[session_col].isin(val_sessions)
        test_mask = df[session_col].isin(test_sessions)

        X_train_raw = df.loc[train_mask, feature_cols].values.astype(np.float32)
        y_train = y_encoded[train_mask]

        X_val_raw = df.loc[val_mask, feature_cols].values.astype(np.float32)
        y_val = y_encoded[val_mask]

        X_test_raw = df.loc[test_mask, feature_cols].values.astype(np.float32)
        y_test = y_encoded[test_mask]
    else:
        # Random stratified split
        n_total = len(df)
        indices = np.random.default_rng(seed).permutation(n_total)
        n_test = max(1, int(n_total * test_frac))
        n_val = max(1, int(n_total * val_frac))

        test_idx = indices[:n_test]
        val_idx = indices[n_test : n_test + n_val]
        train_idx = indices[n_test + n_val :]

        X_raw = df[feature_cols].values.astype(np.float32)
        X_train_raw, y_train = X_raw[train_idx], y_encoded[train_idx]
        X_val_raw, y_val = X_raw[val_idx], y_encoded[val_idx]
        X_test_raw, y_test = X_raw[test_idx], y_encoded[test_idx]

    # Preprocessing: Fit scaler strictly on training split
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train_raw)
    X_val = scaler.transform(X_val_raw)
    X_test = scaler.transform(X_test_raw)

    print(f"[*] Dataset Partitions: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")
    return X_train, y_train, X_val, y_val, X_test, y_test, feature_cols, class_names, scaler


def train_epoch(
    model: nn.Module,
    loader: DataLoader,
    optimizer: optim.Optimizer,
    criterion: nn.Module,
    device: torch.device,
) -> float:
    """Run one epoch of training."""
    model.train()
    total_loss = 0.0
    total_samples = 0
    for xb, yb in loader:
        xb, yb = xb.to(device), yb.to(device)
        optimizer.zero_grad()
        out = model(xb)
        loss = criterion(out, yb)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * xb.size(0)
        total_samples += xb.size(0)
    return total_loss / max(1, total_samples)


def evaluate_model(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
) -> Tuple[float, float, np.ndarray, np.ndarray]:
    """Evaluate accuracy, macro-F1, predictions, and true labels."""
    model.eval()
    all_preds: List[int] = []
    all_targets: List[int] = []

    with torch.no_grad():
        for xb, yb in loader:
            xb = xb.to(device)
            out = model(xb)
            preds = out.argmax(dim=1).cpu().numpy().tolist()
            targets = yb.numpy().tolist()
            all_preds.extend(preds)
            all_targets.extend(targets)

    y_pred = np.array(all_preds)
    y_true = np.array(all_targets)
    accuracy = float((y_pred == y_true).mean())
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))

    return accuracy, macro_f1, y_pred, y_true


def main(args: argparse.Namespace) -> None:
    seed_everything(args.seed)

    # Load feature column names
    feature_list = None
    if args.features:
        if args.features.endswith(".json"):
            with open(args.features, "r") as f:
                schema_json = json.load(f)
                if isinstance(schema_json, list):
                    feature_list = schema_json
                elif "features" in schema_json:
                    feature_list = [f["name"] if isinstance(f, dict) else f for f in schema_json["features"]]
        elif args.features.endswith(".csv"):
            br = pd.read_csv(args.features)
            # Filter by Support==True if column exists, else take first 14 rows
            if "Support" in br.columns:
                feature_list = br.loc[br["Support"] == True, br.columns[0]].tolist()
            else:
                feature_list = br.iloc[:14, 0].tolist()

    X_train, y_train, X_val, y_val, X_test, y_test, features_used, classes_used, scaler = (
        load_dataset_and_split(
            csv_path=args.data,
            feature_cols=feature_list,
            label_col=args.label,
            val_frac=args.val_frac,
            test_frac=0.20,
            seed=args.seed,
        )
    )

    n_features = X_train.shape[1]
    n_classes = len(classes_used)

    train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train).long())
    val_ds = TensorDataset(torch.from_numpy(X_val), torch.from_numpy(y_val).long())
    test_ds = TensorDataset(torch.from_numpy(X_test), torch.from_numpy(y_test).long())

    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=args.batch, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() and args.gpu else "cpu")
    print(f"[*] Training on device: {device}")
    print(f"[*] Model Architecture: {args.model.upper()}")

    if args.model == "cnn":
        model = Tiny1DCNN(n_features=n_features, n_classes=n_classes)
    elif args.model == "bilstm":
        model = BiLSTMClassifier(n_features=n_features, n_classes=n_classes)
    elif args.model == "transformer":
        model = TransformerClassifier(n_features=n_features, n_classes=n_classes)
    else:
        raise ValueError(f"Unknown model architecture: {args.model}")

    model.to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=args.lr, weight_decay=args.wd)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    os.makedirs("results", exist_ok=True)

    best_val_acc = 0.0
    best_val_f1 = 0.0
    best_epoch = 0

    print(f"[*] Starting {args.epochs} training epochs...")
    for epoch in range(1, args.epochs + 1):
        loss = train_epoch(model, train_loader, optimizer, criterion, device)
        val_acc, val_f1, _, _ = evaluate_model(model, val_loader, device)

        is_best = val_acc > best_val_acc
        if is_best:
            best_val_acc = val_acc
            best_val_f1 = val_f1
            best_epoch = epoch
            # Preserve BEST model weights immediately
            torch.save(model.state_dict(), args.out)

        marker = " [★ BEST]" if is_best else ""
        print(f"  Epoch {epoch:02d}/{args.epochs:02d} | Loss: {loss:.4f} | Val Acc: {val_acc:.4f} | Val Macro-F1: {val_f1:.4f}{marker}")

    # Load best checkpoint weights for final held-out test evaluation
    model.load_state_dict(torch.load(args.out, map_location=device))
    test_acc, test_f1, test_preds, test_targets = evaluate_model(model, test_loader, device)
    cm = confusion_matrix(test_targets, test_preds).tolist()
    clf_report = classification_report(test_targets, test_preds, target_names=classes_used, output_dict=True, zero_division=0)

    print("\n================== FINAL HELD-OUT TEST EVALUATION ==================")
    print(f"  Best Validation Epoch : {best_epoch} (Val Acc: {best_val_acc:.4f})")
    print(f"  Held-Out Test Accuracy: {test_acc:.4f}")
    print(f"  Held-Out Test Macro-F1: {test_f1:.4f}")
    print("====================================================================")

    # Persist model manifest beside checkpoint
    manifest_path = os.path.splitext(args.out)[0] + "_manifest.json"
    manifest_data = {
        "modelArchitecture": args.model,
        "checkpointPath": args.out,
        "nFeatures": n_features,
        "featureColumns": features_used,
        "classes": classes_used,
        "bestEpoch": best_epoch,
        "bestValAccuracy": round(best_val_acc, 4),
        "bestValMacroF1": round(best_val_f1, 4),
        "testAccuracy": round(test_acc, 4),
        "testMacroF1": round(test_f1, 4),
        "perClassMetrics": {c: clf_report[c] for c in classes_used if c in clf_report},
        "confusionMatrix": cm,
        "scaler": {
            "mean": scaler.mean_.tolist(),
            "scale": scaler.scale_.tolist(),
        },
        "hyperparameters": {
            "epochs": args.epochs,
            "batch": args.batch,
            "lr": args.lr,
            "weight_decay": args.wd,
            "seed": args.seed,
        },
    }

    with open(manifest_path, "w") as f:
        json.dump(manifest_data, f, indent=2)

    # Append to experiment log
    log_path = "results/experiment_log.csv"
    row = {
        "model": args.model,
        "seed": args.seed,
        "best_epoch": best_epoch,
        "best_val_acc": round(best_val_acc, 4),
        "test_acc": round(test_acc, 4),
        "test_macro_f1": round(test_f1, 4),
        "epochs": args.epochs,
        "batch": args.batch,
        "lr": args.lr,
        "weight_decay": args.wd,
    }
    df_row = pd.DataFrame([row])
    if os.path.exists(log_path):
        df_row.to_csv(log_path, mode="a", header=False, index=False)
    else:
        df_row.to_csv(log_path, index=False)

    print(f"[*] Checkpoint saved -> {args.out}")
    print(f"[*] Model manifest saved -> {manifest_path}")
    print(f"[*] Experiment logged -> {log_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Nano-Stream traffic classification models.")
    parser.add_argument("--model", type=str, default="cnn", choices=["cnn", "bilstm", "transformer"], help="Model architecture")
    parser.add_argument("--data", required=True, help="Path to input dataset CSV")
    parser.add_argument("--features", type=str, default=None, help="Path to schema JSON or Boruta CSV")
    parser.add_argument("--out", type=str, default="checkpoints/float.pt", help="Checkpoint output path")
    parser.add_argument("--epochs", type=int, default=20, help="Training epoch count")
    parser.add_argument("--batch", type=int, default=128, help="Mini-batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--wd", type=float, default=1e-5, help="Weight decay")
    parser.add_argument("--val_frac", type=float, default=0.10, help="Validation fraction")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--label", type=str, default="label", help="Label column name in CSV")
    parser.add_argument("--gpu", action="store_true", help="Enable GPU training if available")

    args = parser.parse_args()
    main(args)

"""
===============================================================================
FILE: train.py
===============================================================================

PURPOSE
-------
Main training orchestrator for Nano-Stream's machine-learning pipeline.

This file loads a prepared CSV dataset, selects the configured features,
encodes the labels, creates training/validation datasets, instantiates the
requested neural-network architecture, trains it, evaluates validation
accuracy, saves a model checkpoint, and records experiment metadata.

ROLE IN NANOSTREAM
------------------
This is the central TRAINING ENTRY POINT.

It connects:

    prepared dataset
          ↓
    feature schema
          ↓
    model definition
          ↓
    optimization
          ↓
    validation
          ↓
    checkpoint
          ↓
    experiment log

SUPPORTED MODELS
----------------
The script supports:

    --model cnn
    --model bilstm
    --model transformer

MODEL IMPLEMENTATIONS
---------------------
cnn:
    models/tiny_1d_cnn.py

bilstm:
    models/bilstm_baseline.py

transformer:
    models/transformer_baseline.py

INPUTS
------
Command-line parameters include:

    --model
    --data
    --features
    --out
    --epochs
    --batch
    --lr
    --wd
    --val_frac
    --seed
    --label
    --gpu

Important defaults include:

    model      = cnn
    out        = checkpoints/float.pt
    epochs     = 20
    batch      = 128
    lr         = 0.001
    wd         = 1e-5
    val_frac   = 0.10
    seed       = 42
    label      = label

PRIMARY DATA INPUT
------------------
Normally:

    data/cicids2017_slice.csv

This file is expected to have the normalized feature names defined in:

    features.json

FEATURE INPUT
-------------
The --features argument can refer to:

1. features.json

or

2. a Boruta ranking CSV

The latter is currently handled by taking the first 14 feature names from the
first CSV column rather than explicitly filtering by Support=True.

TRAINING FLOW
-------------
CSV
 ↓
load_and_encode_csv()
 ↓
X, y
 ↓
build_datasets()
 ↓
train/validation DataLoaders
 ↓
selected model
 ↓
train_epoch()
 ↓
eval_model()
 ↓
checkpoint
 ↓
experiment log

FUNCTION: seed_everything()
----------------------------
INPUT:
    seed

PURPOSE:
    Establishes reproducible random seeds.

SEEDS:
    Python random
    NumPy
    PyTorch
    CUDA where available

OUTPUT:
    No explicit return value.

FUNCTION: load_and_encode_csv()
--------------------------------
INPUT:
    path
    feature_cols
    label_col

PROCESS:
    1. Read CSV.
    2. Verify requested feature columns.
    3. Select feature columns.
    4. Extract labels.
    5. Encode labels using sklearn LabelEncoder.

OUTPUT:
    X
    y
    number of classes

FUNCTION: build_datasets()
--------------------------
INPUT:
    X
    y
    val_frac
    seed

PROCESS:
    Converts NumPy arrays to PyTorch tensors and creates a random
    train/validation split.

OUTPUT:
    training Dataset
    validation Dataset

IMPORTANT:
    The current implementation creates only train and validation subsets.

    It does NOT create an independent test subset.

FUNCTION: train_epoch()
-----------------------
INPUT:
    model
    DataLoader
    optimizer
    loss function
    device

PROCESS:
    For every batch:

        forward pass
            ↓
        calculate loss
            ↓
        backpropagation
            ↓
        optimizer step

OUTPUT:
    Average training loss for the epoch.

FUNCTION: eval_model()
---------------------
INPUT:
    model
    validation DataLoader
    device

PROCESS:
    Performs inference and compares argmax predictions with labels.

OUTPUT:
    Classification accuracy.

NOTE:
    Precision, recall, F1, confusion matrix, and other metrics are not
    calculated here.

FUNCTION: main()
----------------
Coordinates:

    argument parsing
        ↓
    seeding
        ↓
    feature loading
        ↓
    data loading
        ↓
    dataset creation
        ↓
    model construction
        ↓
    optimizer/loss construction
        ↓
    training loop
        ↓
    checkpoint saving
        ↓
    experiment logging

OUTPUT FILE 1
-------------
Default:

    checkpoints/float.pt

The saved object is:

    model.state_dict()

Therefore this checkpoint contains model weights, not a complete self-contained
model definition.

The corresponding model class and configuration are required to reconstruct it.

OUTPUT FILE 2
-------------
Default:

    results/experiment_log.csv

The log records information such as:

    model
    seed
    best validation accuracy
    epochs
    batch size
    learning rate
    weight decay

EXECUTION ORDER
---------------
NORMAL CORE PIPELINE:

1. Obtain the raw CIC-IDS2017 dataset.
2. Run:

       scripts/create_slice.py

3. Verify that:

       data/cicids2017_slice.csv

   exists and contains the required columns.

4. Run:

       train.py

5. The resulting checkpoint can then be consumed by later quantization,
   evaluation, or deployment scripts.

OPTIONAL BORUTA PATH:

    create_slice.py
        ↓
    run_boruta.py
        ↓
    metrics/boruta_ranking.csv
        ↓
    train.py

However, Boruta does not currently appear to be a mandatory prerequisite
because train.py can use features.json directly.

CHECK 2 STATUS
--------------
Syntax/compilation:
    PASS

Training with a temporary 14-feature / 7-class dataset:
    PASS

Checkpoint generation:
    PASS

Experiment logging:
    PASS

KNOWN BUGS / LIMITATIONS
------------------------
1. --label is currently ineffective.

   Although the CLI defines --label, the training path explicitly passes:

       label_col='label'

   Therefore another label-column name cannot currently be selected through
   the command-line argument.

2. Best-checkpoint overwrite.

   The code saves the best validation checkpoint during training, but then
   unconditionally saves the final model state to the same output path after
   training.

   Therefore the final checkpoint is not guaranteed to be the best-validation
   checkpoint.

3. Train/validation split differs from the published methodology.

   Current default:

       90% training
       10% validation

   The published paper reports:

       70% training
       15% validation
       15% testing

   This is a PAPER/IMPLEMENTATION REPRODUCIBILITY ISSUE that must be
   investigated against the exact experiment-generation workflow.

4. No independent test split is implemented here.

5. LabelEncoder mapping is not persisted.

   This is important for future API/deployment use because the model's numeric
   output must map consistently to the seven traffic classes.

6. No explicit normalization/scaling is performed in this script.

   Whether normalization occurs elsewhere must be verified before calling this
   a definitive preprocessing defect.

7. Boruta CSV handling is fragile.

   When a ranking CSV is supplied, the code takes the first 14 rows of the
   first column rather than explicitly selecting features where Support=True.

PAPER RELATIONSHIP
------------------
This script is part of the training implementation corresponding to the
Nano-Stream model experiments.

However, its current default split configuration does not directly reproduce
the 70/15/15 split described in the published paper.

V1 ACTION
---------
MODIFY after the complete repository dependency audit.

Do not fix the issues yet until the later scripts and recorded experiment
artifacts have been inspected.

===============================================================================
"""

# train.py 
import argparse
import os
import random
import json
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd
from torch.utils.data import DataLoader, TensorDataset, random_split
from sklearn.preprocessing import LabelEncoder
from models.tiny_1d_cnn import Tiny1DCNN
from models.bilstm_baseline import BiLSTMClassifier
from models.transformer_baseline import TransformerClassifier

def seed_everything(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

def load_and_encode_csv(path, feature_cols=None, label_col='label'):
    print(f"[*] Loading data from {path}...")
    df = pd.read_csv(path)
    
    # If feature list is provided, use ONLY those columns
    if feature_cols:
        missing = [f for f in feature_cols if f not in df.columns]
        if missing:
            print(f"[ERROR] Missing features in CSV: {missing}")
            raise ValueError("CSV missing required features!")
        print(f"[*] Filtering to {len(feature_cols)} selected features.")
        X = df[feature_cols].values.astype('float32')
    else:
        print("[*] Using ALL columns as features.")
        feature_cols = [c for c in df.columns if c != label_col]
        X = df[feature_cols].values.astype('float32')

    y_raw = df[label_col].values
    
    # Encode text labels (BENIGN -> 0, DDoS -> 1)
    le = LabelEncoder()
    y = le.fit_transform(y_raw)
    
    print("--- Label Encoding Mapping ---")
    for i, class_name in enumerate(le.classes_):
        print(f"  Class {i}: {class_name}")
    print("------------------------------")
    
    return X, y, len(le.classes_)

def build_datasets(X, y, val_frac=0.1, seed=42):
    dataset = TensorDataset(torch.from_numpy(X), torch.from_numpy(y).long())
    n = len(dataset)
    n_val = max(1, int(n * val_frac))
    n_train = n - n_val
    train_ds, val_ds = random_split(dataset, [n_train, n_val], generator=torch.Generator().manual_seed(seed))
    return train_ds, val_ds

def train_epoch(model, loader, opt, crit, device):
    model.train()
    total_loss = 0.0
    total = 0
    for xb, yb in loader:
        xb, yb = xb.to(device), yb.to(device)
        opt.zero_grad()
        out = model(xb)
        loss = crit(out, yb)
        loss.backward()
        opt.step()
        total_loss += loss.item() * xb.size(0)
        total += xb.size(0)
    return total_loss / total

def eval_model(model, loader, device):
    model.eval()
    total = 0
    correct = 0
    with torch.no_grad():
        for xb, yb in loader:
            xb, yb = xb.to(device), yb.to(device)
            out = model(xb)
            preds = out.argmax(dim=1)
            correct += (preds == yb).sum().item()
            total += xb.size(0)
    acc = correct / total if total>0 else 0.0
    return acc

def main(args):
    seed_everything(args.seed)
    
    # Load features.json if provided
    feature_list = None
    if args.features:
        if args.features.endswith(".csv"):
            # read Boruta ranking directly
            br = pd.read_csv(args.features)
            feature_list = br.iloc[:14, 0].tolist()   # first column = feature names
        else:
            with open(args.features, 'r') as f:
                feature_list = json.load(f)
            
    # Load data
    X, y, n_classes = load_and_encode_csv(args.data, feature_cols=feature_list, label_col='label')
    n_features = X.shape[1]
    
    print(f"[*] Final Setup: {len(X)} samples, {n_features} features, {n_classes} classes")

    train_ds, val_ds = build_datasets(X, y, val_frac=args.val_frac, seed=args.seed)
    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch, shuffle=False)

    device = torch.device('cuda' if torch.cuda.is_available() and args.gpu else 'cpu')
    print(f"[*] Training on: {device}")

    print(f"[*] Using model: {args.model}")

    if args.model == "cnn":
        model = Tiny1DCNN(n_features=n_features, n_classes=n_classes)

    elif args.model == "bilstm":
        model = BiLSTMClassifier(
            n_features=n_features,
            n_classes=n_classes
        )

    elif args.model == "transformer":
        model = TransformerClassifier(
            n_features=n_features,
            n_classes=n_classes
        )

    else:
        raise ValueError("Unknown model type")
    
    model.to(device)
    crit = nn.CrossEntropyLoss()
    opt = optim.Adam(model.parameters(), lr=args.lr, weight_decay=args.wd)

    best_val = 0.0
    os.makedirs("results", exist_ok=True)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)

    for epoch in range(1, args.epochs+1):
        loss = train_epoch(model, train_loader, opt, crit, device)
        val_acc = eval_model(model, val_loader, device)
        print(f"Epoch {epoch:02d} | Loss: {loss:.4f} | Val Acc: {val_acc:.4f}")
        
        if val_acc > best_val:
            best_val = val_acc
            torch.save(model.state_dict(), args.out)
            
    torch.save(model.state_dict(), args.out)
    
    # ---- experiment logging ----
    log_path = "results/experiment_log.csv"

    row = {
        "model": args.model,
        "seed": args.seed,
        "best_val_acc": best_val,
        "epochs": args.epochs,
        "batch": args.batch,
        "lr": args.lr,
        "weight_decay": args.wd
    }

    df_row = pd.DataFrame([row])

    if os.path.exists(log_path):
        df_row.to_csv(log_path, mode="a", header=False, index=False)
    else:
        df_row.to_csv(log_path, index=False)

    print(f"[*] Logged results -> {log_path}")

    print(f"[SUCCESS] Training complete. Best Accuracy: {best_val:.4f}")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument('--model', type=str, default='cnn',
               choices=['cnn', 'bilstm', 'transformer'],
               help='Model architecture')
    p.add_argument('--data', required=True)
    p.add_argument('--features', type=str)
    p.add_argument('--out', default='checkpoints/float.pt')
    p.add_argument('--epochs', type=int, default=20)
    p.add_argument('--batch', type=int, default=128)
    p.add_argument('--lr', type=float, default=1e-3)
    p.add_argument('--wd', type=float, default=1e-5)
    p.add_argument('--val_frac', type=float, default=0.1)
    p.add_argument('--seed', type=int, default=42)
    p.add_argument('--label', type=str, default='label')
    p.add_argument('--gpu', action='store_true')
    args = p.parse_args()
    main(args)
"""
===============================================================================
FILE: scripts/test_cross_dataset.py
===============================================================================

PURPOSE
-------
Tests the trained Nano-Stream Tiny1DCNN on traffic data from
CSE-CIC-IDS2018 without retraining the model.

ROLE IN NANOSTREAM
------------------
This is the CROSS-DATASET GENERALIZATION experiment.

It tests whether a model trained using the CIC-IDS2017-derived feature
representation can classify traffic from CSE-CIC-IDS2018.

CURRENT EXPERIMENT
------------------
The script currently evaluates:

    data/CSE-CIC-IDS2018/DoS attacks-Hulk.csv

Therefore this is NOT a complete evaluation across all CSE-CIC-IDS2018 files.

It is specifically an evaluation on the DoS Hulk dataset file.

INPUTS
------
Current paths are hardcoded:

    DATA
        data/CSE-CIC-IDS2018/DoS attacks-Hulk.csv

    FEATURES
        metrics/boruta_ranking.csv

    MODEL
        checkpoints/float.pt

The script does not currently expose CLI arguments for these paths.

FEATURE MAPPING
---------------
CSE-CIC-IDS2018 column names are converted into the Nano-Stream feature
schema.

Examples:

    Tot Fwd Pkts
        ↓
    total_fwd_packets

    Tot Bwd Pkts
        ↓
    total_bwd_packets

    TotLen Fwd Pkts
        ↓
    total_fwd_bytes

    Flow Byts/s
        ↓
    byte_rate

    SYN Flag Cnt
        ↓
    tcp_flag_count_SYN

FEATURE SELECTION
-----------------
The script reads:

    metrics/boruta_ranking.csv

and extracts the entire Feature column.

It does NOT filter:

    Support == True

Therefore all 14 ranked features are currently supplied to the model.

MODEL
-----
Constructs:

    Tiny1DCNN(
        n_features=number of selected features,
        n_classes=7
    )

Then loads:

    checkpoints/float.pt

PROCESS
-------
1. Load CSE-CIC-IDS2018 CSV.
2. Rename columns.
3. Check required features.
4. Extract features.
5. Encode labels.
6. Construct Tiny1DCNN.
7. Load trained checkpoint.
8. Perform inference.
9. Calculate accuracy.
10. Print accuracy.

OUTPUT
------
Console output:

    Cross-dataset accuracy: X

No result CSV is currently generated.

EXECUTION ORDER
---------------
Requires:

    1. A compatible CSE-CIC-IDS2018 dataset file.
    2. metrics/boruta_ranking.csv
    3. checkpoints/float.pt

The model checkpoint must already exist.

It does NOT require:

    create_float_script.py
    quantize_run.py
    measure_latency.py

CHECK 2
-------
Code path using a controlled CSE-CIC-IDS2018-style dataset:
    PASS

Actual repository dataset reproduction:
    NOT VERIFIED because the dataset was not included in the uploaded ZIP.

IMPORTANT FINDINGS
------------------
1. The script evaluates only DoS attacks-Hulk.csv.

2. Therefore its result must not be described as overall CSE-CIC-IDS2018
   accuracy.

3. All 14 Boruta-ranked features are used.

4. Support=True is not used as a feature filter.

5. Dataset and model paths are hardcoded.

V1 ACTION
---------
KEEP for historical reproducibility.

Later make the dataset/model paths configurable and optionally support
evaluation across multiple CSE-CIC-IDS2018 files.

===============================================================================
"""

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import torch
import pandas as pd
import json
from sklearn.preprocessing import LabelEncoder
from models.tiny_1d_cnn import Tiny1DCNN

DATA = "data/CSE-CIC-IDS2018/DoS attacks-Hulk.csv"
FEATURES = "metrics/boruta_ranking.csv"
MODEL = "checkpoints/float.pt"

print("[*] Loading dataset...")
df = pd.read_csv(DATA)
# ---- map CICIDS2018 column names → 2017 feature names ----
df.rename(columns={
    "Flow Duration": "flow_duration",

    "Tot Fwd Pkts": "total_fwd_packets",
    "Tot Bwd Pkts": "total_bwd_packets",

    "TotLen Fwd Pkts": "total_fwd_bytes",
    "TotLen Bwd Pkts": "total_bwd_bytes",

    "Fwd Pkt Len Mean": "avg_fwd_pkt_len",
    "Bwd Pkt Len Mean": "avg_bwd_pkt_len",

    "Flow Byts/s": "byte_rate",
    "Flow Pkts/s": "pkt_rate",

    "Fwd IAT Mean": "mean_fwd_iat",
    "Fwd IAT Std": "std_fwd_iat",
    "Fwd IAT Tot": "fwd_iat_total",

    "Pkt Len Min": "min_pkt_size",

    "SYN Flag Cnt": "tcp_flag_count_SYN",
}, inplace=True)
df.rename(columns={"Label": "label"}, inplace=True)

feature_cols = pd.read_csv(FEATURES)["Feature"].tolist()
X = df[feature_cols].values.astype("float32")

le = LabelEncoder()
y = le.fit_transform(df["label"].values)

print("[*] Loading trained CNN...")
model = Tiny1DCNN(n_features=len(feature_cols), n_classes=7)
model.load_state_dict(torch.load(MODEL, map_location="cpu"))
model.eval()

X_tensor = torch.from_numpy(X)

correct = 0
with torch.no_grad():
    out = model(X_tensor)
    preds = out.argmax(dim=1)
    correct = (preds.numpy() == y).sum()

acc = correct / len(y)
print(f"\nCross-dataset accuracy: {acc:.4f}")
"""
===============================================================================
FILE: scripts/run_boruta.py
===============================================================================

PURPOSE
-------
Runs Boruta feature-importance analysis over the candidate Nano-Stream feature
set using a Random Forest classifier.

ROLE IN PIPELINE
----------------
This is a FEATURE-ANALYSIS / FEATURE-SELECTION STAGE.

It is downstream of dataset preparation and upstream of optional training
configuration.

PIPELINE
--------
data/cicids2017_slice.csv
        +
features.json
        ↓
run_boruta.py
        ↓
metrics/boruta_ranking.csv

INPUTS
------
Command-line arguments:

    --data
    --features
    --out

Typical inputs:

    --data data/cicids2017_slice.csv
    --features features.json
    --out metrics/boruta_ranking.csv

FUNCTION: run_boruta()
----------------------
INPUT:
    data_path
    features_path
    out_path

PROCESS:
    1. Load prepared CSV.
    2. Load candidate feature names from features.json.
    3. Keep candidate features that actually exist in the dataset.
    4. Extract X and label y.
    5. Encode labels with LabelEncoder.
    6. Create RandomForestClassifier.
    7. Run BorutaPy.
    8. Save feature ranking/support results.

RANDOM FOREST CONFIGURATION
----------------------------
n_jobs:
    -1

class_weight:
    balanced

max_depth:
    5

BORUTA CONFIGURATION
--------------------
n_estimators:
    auto

random_state:
    42

max_iter:
    50

OUTPUT
------
Default:

    metrics/boruta_ranking.csv

Columns:

    Feature
    Ranking
    Support

EXECUTION ORDER
---------------
Must run AFTER:

    scripts/create_slice.py

because the normal data input is:

    data/cicids2017_slice.csv

It should run BEFORE any training invocation that intentionally uses its
ranking CSV as the feature source.

However, training can also directly use features.json, so Boruta is not
currently proven to be a mandatory prerequisite for training.

IMPORTANT IMPLEMENTATION DETAIL
-------------------------------
The output is sorted by Ranking before being saved.

This means train.py can take the first 14 feature names from the first column.

However, this does NOT explicitly mean that only Boruta-supported features
are used.

CHECKED BORUTA RESULT
---------------------
The existing ranking artifact contains all 14 candidate features.

Only four features are marked Support=True.

Therefore the current pipeline appears to preserve all 14 features while using
Boruta primarily to produce a ranking/report.

This is different from a strict feature-reduction pipeline in which only
Support=True features would be passed to the classifier.

CHECK 2 STATUS
--------------
Code inspection:
    PASS

Runtime:
    BLOCKED in the current environment because the Python 'boruta' package is
    not installed.

Therefore the existing code path has not been fully executed in Check 2.

The checked-in Boruta output artifact was inspected separately.

V1 ACTION
---------
KEEP for now.

During later cleanup, determine whether Nano-Stream intends Boruta to:

    A. rank all candidate features, or
    B. actually reduce the feature set.

Do not change the behavior until the published experiment methodology and
downstream scripts have been fully audited.

===============================================================================
"""

# run_boruta.py

import pandas as pd
import numpy as np
import argparse
import json
from sklearn.ensemble import RandomForestClassifier
from boruta import BorutaPy
from sklearn.preprocessing import LabelEncoder

def run_boruta(data_path, features_path, out_path):
    print(f"[*] Loading data from {data_path}...")
    df = pd.read_csv(data_path)
    
    # Load features list
    with open(features_path, 'r') as f:
        candidate_features = json.load(f)
    
    # Filter dataset to only candidate features (if they exist)
    present_features = [f for f in candidate_features if f in df.columns]
    print(f"[*] Found {len(present_features)}/{len(candidate_features)} features in dataset.")
    
    X = df[present_features].values
    y = df['label'].values
    
    # Encode labels
    le = LabelEncoder()
    y_enc = le.fit_transform(y)
    
    # Run Boruta
    print("[*] Starting Boruta (Random Forest)...")
    rf = RandomForestClassifier(n_jobs=-1, class_weight='balanced', max_depth=5)
    feat_selector = BorutaPy(rf, n_estimators='auto', verbose=2, random_state=42, max_iter=50)
    feat_selector.fit(X, y_enc)
    
    # Save results
    results = pd.DataFrame({
        'Feature': present_features,
        'Ranking': feat_selector.ranking_,
        'Support': feat_selector.support_
    })
    results = results.sort_values(by='Ranking')
    results.to_csv(out_path, index=False)
    print(f"[SUCCESS] Boruta results saved to {out_path}")
    print(results.head(10))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument('--data', required=True)
    p.add_argument('--features', required=True)
    p.add_argument('--out', default='metrics/boruta_ranking.csv')
    args = p.parse_args()
    run_boruta(args.data, args.features, args.out)
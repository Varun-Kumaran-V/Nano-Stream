"""
===============================================================================
FILE: scripts/train_baselines.py
===============================================================================

PURPOSE
-------
Trains non-neural and streaming baseline classifiers on the prepared
Nano-Stream traffic-classification dataset.

The script is used to establish comparison baselines against Nano-Stream's
Tiny1DCNN.

SUPPORTED BASELINES
-------------------
1. Decision Tree
2. Random Forest
3. Hoeffding Tree (River)

ROLE IN NANOSTREAM
------------------
This is an OFFLINE BASELINE EVALUATION component.

It does not train the Nano-Stream CNN itself.

Its purpose is to provide conventional/streaming ML reference results for
comparison with the neural-network models.

INPUT
-----
Command-line argument:

    --data

Default:

    data/cicids2017_slice.csv

The dataset is expected to contain:

    feature columns
    label

IMPORTANT:
----------
Unlike train.py, this script currently does not explicitly load
features.json.

It performs:

    X = every column except "label"

Therefore the input CSV must not contain unintended non-feature columns.

PROCESS
-------
1. Load the CSV.
2. Separate all non-label columns as X.
3. Extract label as y.
4. Encode labels using LabelEncoder.
5. Standardize X using StandardScaler.
6. Split data into:
       80% training
       20% testing
   using random_state=42.
7. Train Decision Tree.
8. Train Random Forest.
9. Train Hoeffding Tree if River is installed.
10. Calculate baseline metrics.
11. Save the results CSV.

BASELINE: DECISION TREE
-----------------------
Configuration:

    max_depth = 10

Metrics:

    Accuracy
    Macro F1
    Training time

BASELINE: RANDOM FOREST
-----------------------
Configuration:

    n_estimators = 10
    max_depth = 10

Metrics:

    Accuracy
    Macro F1
    Training time

BASELINE: HOEFFDING TREE
------------------------
Uses River's streaming API.

Training is performed sample-by-sample using:

    learn_one()

Predictions use:

    predict_one()

If the "river" package is unavailable, the script prints a warning and
continues without this baseline.

FUNCTIONS
---------
The script contains the baseline-training functions and main orchestration
logic.

Each baseline function receives the prepared feature/label data and returns
its measured evaluation information for inclusion in the result table.

OUTPUT
------
Default output:

    metrics/offline_baselines.csv

Output columns:

    Model
    Accuracy
    F1
    Time

CURRENT VERIFIED OUTPUT
-----------------------
The checked-in artifact contains:

    DecisionTree
        Accuracy = 0.99975
        Macro F1 = 0.659129

    RandomForest
        Accuracy = 0.99945
        Macro F1 = 0.772432

    HoeffdingTree
        Accuracy = 0.98236
        F1 = N/A

The high accuracy together with substantially lower macro-F1 indicates that
accuracy alone should not be used to interpret these baseline results.

EXECUTION ORDER
---------------
This script requires the prepared dataset.

Required previous step:

    1. scripts/create_slice.py

which produces:

    data/cicids2017_slice.csv

Then:

    2. scripts/train_baselines.py

It does NOT require:

    run_boruta.py
    train.py
    create_float_script.py
    quantize_run.py

CHECK 2
-------
Code execution with a controlled 14-feature/7-class dataset:
    PASS

Decision Tree path:
    PASS

Random Forest path:
    PASS

Hoeffding Tree:
    BLOCKED/SKIPPED because River is not installed in the current environment.

Existing output artifact:
    VERIFIED

REAL DATA REPRODUCTION:
    NOT VERIFIED because the uploaded ZIP did not contain the local dataset
    shown in the updated working-tree listing.

IMPORTANT FINDINGS
------------------
1. Uses every non-label column rather than features.json.

2. Uses an 80/20 split, unlike the paper's reported 70/15/15 methodology.

3. StandardScaler is applied here, while the current train.py path does not
   perform the same scaling.

4. The checked-in accuracy values are extremely high compared with the CNN
   results and should be interpreted alongside macro-F1 and class distribution.

REDUNDANCY
----------
This script is intentionally separate from train.py because it evaluates
different baseline algorithms.

However, data loading, label encoding, splitting, and preprocessing logic are
duplicated conceptually across training scripts.

This can later be consolidated into shared utilities.

V1 ACTION
---------
KEEP for reproducibility.

Consider refactoring common preprocessing after the entire repository audit.

===============================================================================
"""

#train_baselines.py

import pandas as pd
import argparse
import time
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

# Try importing River for streaming baseline
try:
    from river import tree, forest, metrics
    RIVER_AVAILABLE = True
except ImportError:
    RIVER_AVAILABLE = False
    print("[WARN] 'river' package not installed. Skipping streaming baselines.")

def train_baselines(data_path, out_path):
    print(f"[*] Loading {data_path}...")
    df = pd.read_csv(data_path)
    
    # Prepare X, y
    X = df.drop(columns=['label']).values
    y = df['label'].values
    
    # Encode & Scale
    le = LabelEncoder()
    y = le.fit_transform(y)
    scaler = StandardScaler()
    X = scaler.fit_transform(X)
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    results = []

    # 1. Decision Tree (Standard ML)
    print("[*] Training Decision Tree...")
    start = time.time()
    dt = DecisionTreeClassifier(max_depth=10)
    dt.fit(X_train, y_train)
    preds = dt.predict(X_test)
    acc = accuracy_score(y_test, preds)
    f1 = f1_score(y_test, preds, average='macro')
    results.append({'Model': 'DecisionTree', 'Accuracy': acc, 'F1': f1, 'Time': time.time()-start})

    # 2. Random Forest (Strong ML)
    print("[*] Training Random Forest...")
    start = time.time()
    rf = RandomForestClassifier(n_estimators=10, max_depth=10)
    rf.fit(X_train, y_train)
    preds = rf.predict(X_test)
    acc = accuracy_score(y_test, preds)
    f1 = f1_score(y_test, preds, average='macro')
    results.append({'Model': 'RandomForest', 'Accuracy': acc, 'F1': f1, 'Time': time.time()-start})

    # 3. Hoeffding Tree (Streaming Baseline) - Uses River
    if RIVER_AVAILABLE:
        print("[*] Training Hoeffding Tree (Streaming)...")
        ht = tree.HoeffdingTreeClassifier()
        metric = metrics.Accuracy()
        # Stream emulation
        for xi, yi in zip(X_train, y_train):
            # River expects dict input
            x_dict = {i: v for i, v in enumerate(xi)}
            ht.learn_one(x_dict, yi)
        
        # Test
        for xi, yi in zip(X_test, y_test):
            x_dict = {i: v for i, v in enumerate(xi)}
            y_pred = ht.predict_one(x_dict)
            if y_pred is not None:
                metric.update(yi, y_pred)
        
        results.append({'Model': 'HoeffdingTree (Stream)', 'Accuracy': metric.get(), 'F1': 'N/A', 'Time': 'N/A'})

    # Save
    res_df = pd.DataFrame(results)
    res_df.to_csv(out_path, index=False)
    print(res_df)
    print(f"[SUCCESS] Baselines saved to {out_path}")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument('--data', required=True)
    p.add_argument('--out', default='metrics/offline_baselines.csv')
    args = p.parse_args()
    train_baselines(args.data, args.out)
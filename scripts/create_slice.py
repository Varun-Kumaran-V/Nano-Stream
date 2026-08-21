"""
===============================================================================
FILE: scripts/create_slice.py
===============================================================================

PURPOSE
-------
Preprocesses raw CIC-IDS2017 CSV files into a single cleaned, standardized
dataset suitable for Nano-Stream training and feature-selection analysis.

ROLE IN PIPELINE
----------------
This is the FIRST DATA-PREPARATION STAGE.

RAW CIC-IDS2017 CSVs
        ↓
create_slice.py
        ↓
data/cicids2017_slice.csv
        ↓
training / Boruta

INPUT
-----
Default input directory:

    data/raw

The script recursively searches for:

    MachineLearningCSV*.csv

and, if none are found, falls back to:

    *.csv

OUTPUT
------
Default:

    data/cicids2017_slice.csv

The output contains normalized feature names and the label column.

COLUMN NORMALIZATION
--------------------
The script converts raw CIC-IDS2017 column names to Nano-Stream's internal
feature schema.

Examples:

    Flow Duration
        ↓
    flow_duration

    Total Fwd Packets
        ↓
    total_fwd_packets

    Flow Packets/s
        ↓
    pkt_rate

    SYN Flag Count
        ↓
    tcp_flag_count_SYN

    Label
        ↓
    label

FUNCTION: create_slice()
------------------------
INPUT:
    input_dir
    output_file
    max_rows

DEFAULT:
    max_rows = 200000

PROCESS
-------
1. Search recursively for CSV files.
2. Calculate a row budget per input file.
3. Read up to that many rows from each file.
4. Concatenate the samples.
5. Strip whitespace from column names.
6. Rename columns using COLUMN_MAP.
7. Replace positive/negative infinity with NaN.
8. Drop rows containing NaN.
9. Verify that the normalized label column exists.
10. Save the resulting CSV.

OUTPUT CONSUMERS
----------------
The generated:

    data/cicids2017_slice.csv

is intended to be consumed by:

    scripts/run_boruta.py
    train.py

EXECUTION ORDER
---------------
This script must run BEFORE any training or Boruta process that expects the
default cleaned dataset.

Typical order:

    raw CIC-IDS2017 data
        ↓
    create_slice.py
        ↓
    cicids2017_slice.csv
        ↓
    run_boruta.py / train.py

IMPORTANT ROW-BUDGET BEHAVIOR
-----------------------------
The 200,000-row limit is distributed across input files.

It is NOT a class-balancing mechanism.

For N input files:

    rows_per_file = max_rows / N

approximately.

After NaN/infinity removal, the final number of rows can be smaller than
max_rows.

IMPORTANT BALANCING FINDING
---------------------------
The script does NOT explicitly balance classes.

It allocates rows across files rather than labels.

Therefore the claim that a "balanced subset" was used in the published
experiment cannot be established from this script alone.

This must be verified against the actual generated dataset and experiment
artifacts.

CHECK 2 STATUS
--------------
Runtime preprocessing test:
    PASS

A temporary CIC-IDS2017-style dataset was successfully transformed into a
normalized CSV containing the expected 14 features plus label.

CURRENT REPOSITORY STATE
------------------------
The repository ZIP does not contain the required raw data directory.

Therefore the full real-data preprocessing run cannot currently be reproduced
from the ZIP alone.

V1 ACTION
---------
KEEP.

Later improve documentation around dataset acquisition and explicitly document
that the raw dataset is external and not committed to the repository.

===============================================================================
"""

# create_slice.py

import pandas as pd
import numpy as np
import glob
import os
import argparse

# Mapping raw CSV headers to your code's expected feature names
COLUMN_MAP = {
    'Flow Duration': 'flow_duration',
    'Total Fwd Packets': 'total_fwd_packets',
    'Total Backward Packets': 'total_bwd_packets',
    'Total Length of Fwd Packets': 'total_fwd_bytes',
    'Total Length of Bwd Packets': 'total_bwd_bytes',
    'Fwd Packet Length Mean': 'avg_fwd_pkt_len',
    'Bwd Packet Length Mean': 'avg_bwd_pkt_len',
    'Fwd IAT Std': 'std_fwd_iat',
    'Fwd IAT Mean': 'mean_fwd_iat',
    'Flow Packets/s': 'pkt_rate',
    'Flow Bytes/s': 'byte_rate',
    'Fwd IAT Total': 'fwd_iat_total', # Useful for calc
    'Min Packet Length': 'min_pkt_size',
    'SYN Flag Count': 'tcp_flag_count_SYN',
    'Label': 'label'
}

def create_slice(input_dir, output_file, max_rows=200000):
    print(f"[*] Scanning {input_dir}...")
    
    # 1. Find CSVs (recursive search)
    files = glob.glob(os.path.join(input_dir, "**", "MachineLearningCSV*.csv"), recursive=True)
    if not files:
        files = glob.glob(os.path.join(input_dir, "**", "*.csv"), recursive=True)
    
    if not files:
        print("[ERROR] No CSVs found!")
        return

    print(f"[*] Found {len(files)} files. Reading sample...")

    # 2. Read and Concatenate
    df_list = []
    rows_per_file = max_rows // len(files)
    
    for f in files:
        try:
            # Read a chunk from each file
            df_chunk = pd.read_csv(f, nrows=rows_per_file)
            df_list.append(df_chunk)
        except Exception as e:
            print(f"[WARN] Skipped {f}: {e}")

    if not df_list:
        print("[ERROR] Could not read any data.")
        return

    full_df = pd.concat(df_list, ignore_index=True)
    
    # 3. CRITICAL: Clean Column Names
    # Strip spaces from the raw CSV headers (' Flow Duration' -> 'Flow Duration')
    full_df.columns = [c.strip() for c in full_df.columns]
    
    # Rename columns to match your 'features.json' snake_case format
    # This prevents the "KeyError" in training later
    full_df.rename(columns=COLUMN_MAP, inplace=True)

    # 4. Filter & Clean Data
    # Drop rows with Infinity or NaN
    full_df = full_df.replace([np.inf, -np.inf], np.nan).dropna()
    
    # Ensure label column exists
    if 'label' not in full_df.columns:
        print("[ERROR] 'label' column missing after renaming. Check CSV headers.")
        print("Available columns:", full_df.columns[:10])
        return

    # 5. Save
    print(f"[*] Saving {len(full_df)} rows to {output_file}...")
    full_df.to_csv(output_file, index=False)
    print(f"[SUCCESS] Slice created at {output_file}")
    print("Columns are now clean (snake_case).")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_dir", default="data/raw")
    parser.add_argument("--output", default="data/cicids2017_slice.csv")
    parser.add_argument("--max_rows", type=int, default=200000)
    args = parser.parse_args()
    
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    create_slice(args.input_dir, args.output, args.max_rows)
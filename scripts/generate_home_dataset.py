"""
===============================================================================
FILE: scripts/generate_home_dataset.py
===============================================================================

PURPOSE
-------
Generates a reproducible, session-separated synthetic home-broadband traffic
dataset for training and evaluating Nano-Stream's 1D-CNN and baseline models
on the 7-class IntentQoS residential taxonomy.

ROLE IN NANOSTREAM
------------------
This is the DATASET GENERATION STAGE for the residential QoS application domain.

It replaces historical intrusion-detection dataset dependencies with
reproducible home broadband traffic flows reflecting realistic transport
characteristics:

    - Video Calls (WebRTC/Zoom)
    - Multiplayer Gaming
    - Video Streaming (HLS/DASH)
    - Bulk Transfers (ISO/Game downloads)
    - Background Sync (Cloud backups, OS telemetry)
    - Interactive Browsing (Web HTTPS)
    - Unknown / Ambiguous flows

INPUT
-----
Command-line parameters:

    --samples-per-class : Number of flow records per class (default: 2000)
    --sessions          : Number of independent session captures (default: 10)
    --seed              : Master random seed (default: 42)
    --out               : Output CSV filepath (default: data/home_traffic.csv)
    --manifest          : Output JSON metadata manifest (default: data/home_traffic_manifest.json)

OUTPUT
------
1. CSV dataset with 14 canonical early-flow features + metadata columns
   (`session_id`, `capture_id`, `flow_id`, `protocol`, `label`).
2. JSON dataset manifest recording class distributions, generator parameters,
   schema version, and file checksums.

DEPENDENCIES
------------
NumPy, Pandas, Python standard library (hashlib, json, os, random).

===============================================================================
"""

import argparse
import hashlib
import json
import os
import random
from typing import Any, Dict, List

import numpy as np
import pandas as pd


def generate_flow_features(
    label: str,
    session_id: int,
    flow_idx: int,
    rng: np.random.Generator,
) -> Dict[str, Any]:
    """
    Synthesize realistic early-flow 14-dimensional feature vector based on
    the declared residential traffic class profile.

    Features correspond strictly to docs/data/schema_manifest.json:
      0: destination_port
      1: flow_duration_ms
      2: total_fwd_packets
      3: total_bwd_packets
      4: total_fwd_bytes
      5: total_bwd_bytes
      6: fwd_packet_len_mean
      7: fwd_packet_len_std
      8: bwd_packet_len_mean
      9: bwd_packet_len_std
      10: fwd_iat_mean_ms
      11: bwd_iat_mean_ms
      12: flow_bytes_per_sec
      13: flow_packets_per_sec
    """
    capture_id = f"cap_sess_{session_id:02d}"
    flow_id = f"flow_{session_id:02d}_{flow_idx:05d}"

    if label == "VIDEO_CALL":
        # Symmetric, small-to-medium packets, low IAT (15-30ms), UDP dominant
        protocol = "UDP" if rng.random() > 0.15 else "TCP"
        dest_port = int(rng.choice([50000, 50001, 3478, 3479, 8801, 8802]))
        total_fwd_pkts = int(rng.integers(16, 32))
        total_bwd_pkts = int(rng.integers(14, 32))
        fwd_len_mean = float(rng.normal(650.0, 80.0))
        fwd_len_std = float(rng.uniform(40.0, 90.0))
        bwd_len_mean = float(rng.normal(680.0, 90.0))
        bwd_len_std = float(rng.uniform(40.0, 95.0))
        fwd_iat = float(rng.uniform(18.0, 32.0))
        bwd_iat = float(rng.uniform(18.0, 33.0))
        duration_ms = total_fwd_pkts * fwd_iat

    elif label == "GAMING":
        # Small packets (60-200 bytes), high tick rate (10-30ms IAT), UDP
        protocol = "UDP" if rng.random() > 0.05 else "TCP"
        dest_port = int(rng.choice([3074, 27015, 27016, 7777, 9987, 30000]))
        total_fwd_pkts = int(rng.integers(18, 32))
        total_bwd_pkts = int(rng.integers(18, 32))
        fwd_len_mean = float(rng.normal(120.0, 25.0))
        fwd_len_std = float(rng.uniform(10.0, 30.0))
        bwd_len_mean = float(rng.normal(140.0, 30.0))
        bwd_len_std = float(rng.uniform(10.0, 35.0))
        fwd_iat = float(rng.uniform(12.0, 25.0))
        bwd_iat = float(rng.uniform(12.0, 25.0))
        duration_ms = total_fwd_pkts * fwd_iat

    elif label == "VIDEO_STREAMING":
        # Asymmetric, large server-to-client packets (1400-1500 bytes), TCP/QUIC, port 443
        protocol = "TCP" if rng.random() > 0.40 else "QUIC"
        dest_port = 443
        total_fwd_pkts = int(rng.integers(8, 20))    # Client ACKs / requests
        total_bwd_pkts = int(rng.integers(24, 32))   # Server video chunks
        fwd_len_mean = float(rng.normal(90.0, 20.0))
        fwd_len_std = float(rng.uniform(15.0, 30.0))
        bwd_len_mean = float(rng.normal(1380.0, 60.0))
        bwd_len_std = float(rng.uniform(30.0, 80.0))
        fwd_iat = float(rng.uniform(40.0, 120.0))
        bwd_iat = float(rng.uniform(5.0, 18.0))
        duration_ms = float(rng.uniform(400.0, 1500.0))

    elif label == "BULK_TRANSFER":
        # Full MTU packets (1460-1500 bytes), greedy back-to-back packets, low IAT
        protocol = "TCP"
        dest_port = int(rng.choice([443, 80, 8080, 21]))
        total_fwd_pkts = int(rng.integers(10, 22))
        total_bwd_pkts = 32
        fwd_len_mean = float(rng.normal(70.0, 15.0))
        fwd_len_std = float(rng.uniform(10.0, 25.0))
        bwd_len_mean = float(rng.normal(1480.0, 20.0))
        bwd_len_std = float(rng.uniform(5.0, 25.0))
        fwd_iat = float(rng.uniform(10.0, 35.0))
        bwd_iat = float(rng.uniform(1.0, 8.0))
        duration_ms = float(rng.uniform(200.0, 800.0))

    elif label == "BACKGROUND_UPDATE_BACKUP":
        # Steady upstream or downstream transfers, moderate packet size, periodic
        protocol = "TCP"
        dest_port = int(rng.choice([443, 8443, 80]))
        total_fwd_pkts = int(rng.integers(12, 28))
        total_bwd_pkts = int(rng.integers(12, 28))
        fwd_len_mean = float(rng.normal(850.0, 150.0))
        fwd_len_std = float(rng.uniform(50.0, 120.0))
        bwd_len_mean = float(rng.normal(450.0, 120.0))
        bwd_len_std = float(rng.uniform(30.0, 80.0))
        fwd_iat = float(rng.uniform(30.0, 90.0))
        bwd_iat = float(rng.uniform(30.0, 90.0))
        duration_ms = float(rng.uniform(800.0, 2500.0))

    elif label == "INTERACTIVE_WEB_OTHER":
        # Burst of request/reply, small payload, variable ports
        protocol = "TCP" if rng.random() > 0.3 else "QUIC"
        dest_port = int(rng.choice([443, 80, 53, 8000]))
        total_fwd_pkts = int(rng.integers(6, 16))
        total_bwd_pkts = int(rng.integers(8, 20))
        fwd_len_mean = float(rng.normal(320.0, 80.0))
        fwd_len_std = float(rng.uniform(40.0, 90.0))
        bwd_len_mean = float(rng.normal(750.0, 180.0))
        bwd_len_std = float(rng.uniform(60.0, 140.0))
        fwd_iat = float(rng.uniform(40.0, 180.0))
        bwd_iat = float(rng.uniform(30.0, 150.0))
        duration_ms = float(rng.uniform(300.0, 1800.0))

    else:  # UNKNOWN
        # Ambiguous distribution, high variance, unclassified
        protocol = str(rng.choice(["TCP", "UDP", "QUIC"]))
        dest_port = int(rng.integers(1024, 65535))
        total_fwd_pkts = int(rng.integers(3, 14))
        total_bwd_pkts = int(rng.integers(2, 14))
        fwd_len_mean = float(rng.uniform(100.0, 1100.0))
        fwd_len_std = float(rng.uniform(20.0, 150.0))
        bwd_len_mean = float(rng.uniform(100.0, 1100.0))
        bwd_len_std = float(rng.uniform(20.0, 150.0))
        fwd_iat = float(rng.uniform(10.0, 300.0))
        bwd_iat = float(rng.uniform(10.0, 300.0))
        duration_ms = float(rng.uniform(100.0, 3000.0))

    # Clamp values to valid physical ranges
    fwd_len_mean = max(40.0, min(1500.0, fwd_len_mean))
    fwd_len_std = max(0.0, min(800.0, fwd_len_std))
    bwd_len_mean = max(40.0, min(1500.0, bwd_len_mean))
    bwd_len_std = max(0.0, min(800.0, bwd_len_std))
    fwd_iat = max(0.5, fwd_iat)
    bwd_iat = max(0.5, bwd_iat)
    duration_ms = max(10.0, duration_ms)

    total_fwd_bytes = int(total_fwd_pkts * fwd_len_mean)
    total_bwd_bytes = int(total_bwd_pkts * bwd_len_mean)
    duration_sec = duration_ms / 1000.0
    total_bytes = total_fwd_bytes + total_bwd_bytes
    total_pkts = total_fwd_pkts + total_bwd_pkts

    flow_bytes_per_sec = float(total_bytes / duration_sec)
    flow_packets_per_sec = float(total_pkts / duration_sec)

    return {
        "destination_port": dest_port,
        "flow_duration_ms": round(duration_ms, 2),
        "total_fwd_packets": total_fwd_pkts,
        "total_bwd_packets": total_bwd_pkts,
        "total_fwd_bytes": total_fwd_bytes,
        "total_bwd_bytes": total_bwd_bytes,
        "fwd_packet_len_mean": round(fwd_len_mean, 2),
        "fwd_packet_len_std": round(fwd_len_std, 2),
        "bwd_packet_len_mean": round(bwd_len_mean, 2),
        "bwd_packet_len_std": round(bwd_len_std, 2),
        "fwd_iat_mean_ms": round(fwd_iat, 2),
        "bwd_iat_mean_ms": round(bwd_iat, 2),
        "flow_bytes_per_sec": round(flow_bytes_per_sec, 2),
        "flow_packets_per_sec": round(flow_packets_per_sec, 2),
        "label": label,
        "session_id": session_id,
        "capture_id": capture_id,
        "flow_id": flow_id,
        "protocol": protocol,
    }


def generate_home_dataset(
    samples_per_class: int = 2000,
    n_sessions: int = 10,
    seed: int = 42,
    out_csv: str = "data/home_traffic.csv",
    out_manifest: str = "data/home_traffic_manifest.json",
) -> None:
    """
    Generate dataset and save CSV and manifest.
    """
    classes = [
        "VIDEO_CALL",
        "GAMING",
        "VIDEO_STREAMING",
        "BULK_TRANSFER",
        "BACKGROUND_UPDATE_BACKUP",
        "INTERACTIVE_WEB_OTHER",
        "UNKNOWN",
    ]

    rng = np.random.default_rng(seed)
    records: List[Dict[str, Any]] = []

    samples_per_session_class = samples_per_class // n_sessions

    for session_id in range(1, n_sessions + 1):
        for label in classes:
            for idx in range(samples_per_session_class):
                flow = generate_flow_features(
                    label=label,
                    session_id=session_id,
                    flow_idx=len(records) + 1,
                    rng=rng,
                )
                records.append(flow)

    df = pd.DataFrame(records)
    # Shuffle flows deterministically
    df = df.sample(frac=1.0, random_state=seed).reset_index(drop=True)

    os.makedirs(os.path.dirname(os.path.abspath(out_csv)), exist_ok=True)
    df.to_csv(out_csv, index=False)

    # Compute sha256 of generated dataset
    h = hashlib.sha256()
    with open(out_csv, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    csv_sha = h.hexdigest()

    class_distribution = df["label"].value_counts().to_dict()

    manifest = {
        "manifestVersion": "1.0.0",
        "datasetName": "IntentQoS Home Broadband Traffic Corpus",
        "datasetFile": out_csv,
        "sha256": csv_sha,
        "totalSamples": len(df),
        "classes": classes,
        "classDistribution": class_distribution,
        "nSessions": n_sessions,
        "seed": seed,
        "featuresCount": 14,
        "schemaManifest": "docs/data/schema_manifest.json",
        "taxonomyDoc": "docs/data/taxonomy.md",
        "trainValTestSplits": {
            "strategy": "grouped_session_split",
            "trainSessions": [1, 2, 3, 4, 5, 6, 7],
            "valSessions": [8],
            "testSessions": [9, 10],
            "trainPct": 70,
            "valPct": 10,
            "testPct": 20,
        },
    }

    with open(out_manifest, "w") as f:
        json.dump(manifest, f, indent=2)

    print(
        f"[SUCCESS] Generated {len(df)} home-broadband flow records.\n"
        f"  CSV file       : {out_csv} ({os.path.getsize(out_csv) / 1024:.1f} KB)\n"
        f"  SHA-256        : {csv_sha}\n"
        f"  Manifest       : {out_manifest}\n"
        f"  Class counts   : {class_distribution}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic home-broadband traffic dataset.")
    parser.add_argument("--samples-per-class", type=int, default=2000, help="Target samples per class")
    parser.add_argument("--sessions", type=int, default=10, help="Number of distinct capture sessions")
    parser.add_argument("--seed", type=int, default=42, help="Master random seed")
    parser.add_argument("--out", type=str, default="data/home_traffic.csv", help="Output CSV path")
    parser.add_argument("--manifest", type=str, default="data/home_traffic_manifest.json", help="Manifest path")

    args = parser.parse_args()
    generate_home_dataset(
        samples_per_class=args.samples_per_class,
        n_sessions=args.sessions,
        seed=args.seed,
        out_csv=args.out,
        out_manifest=args.manifest,
    )

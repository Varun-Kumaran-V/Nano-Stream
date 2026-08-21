# Layer 01 — Data & Feature Pipeline

## 1. Purpose

This layer is responsible for preparing the network-traffic data before it
reaches the machine-learning models.

It covers:

1. Raw CIC-IDS2017 data discovery and preprocessing
2. Standardization of dataset column names
3. Cleaning invalid values
4. Creation of the prepared CIC-IDS2017 dataset
5. Definition of Nano-Stream's canonical 14-feature schema
6. Boruta feature-ranking analysis
7. Creation of the feature-ranking artifact used by downstream experiments

This layer is the foundation of the ML pipeline.

---

# 2. Files in this layer

## Dataset preprocessing

```text
scripts/create_slice.py
```

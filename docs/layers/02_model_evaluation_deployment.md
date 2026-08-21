# Layer 02 — Model Evaluation & Deployment

## 1. Purpose

This layer connects Nano-Stream's trained model to its evaluation,
optimization, deployment, and cross-dataset experiments.

It covers:

1. Baseline ML evaluation
2. Feature-ranking artifacts
3. FP32 checkpoint conversion
4. Dynamic INT8 quantization
5. TorchScript deployment
6. CPU latency measurement
7. Cross-dataset evaluation
8. Experiment/checkpoint artifacts

---

# 2. Files in this layer

## Baseline evaluation

```text
scripts/train_baselines.py
metrics/offline_baselines.csv
```

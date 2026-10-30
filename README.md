# Nano-Stream

## Lightweight, Quantized 1D-CNN Traffic Classification for Software-Defined Networks

Nano-Stream is a lightweight traffic classification framework for
Software-Defined Networks (SDN), designed to classify network traffic using
flow-level statistical features and perform low-latency inference under
resource-constrained conditions.

The system combines:

- Flow-level traffic feature extraction
- Boruta-based feature selection
- A lightweight 1D Convolutional Neural Network
- FP32 and dynamically quantized INT8 model artifacts
- CPU-oriented inference latency evaluation
- Cross-dataset evaluation
- Ryu-based SDN integration
- OpenFlow-based traffic enforcement

Nano-Stream is associated with a published research paper.

---

## Research Paper

**IEEE Xplore:**

https://ieeexplore.ieee.org/document/11504604/

The repository contains the implementation, experiment artifacts,
documentation, and deployment-related components associated with the published
research work.

> The repository should not be interpreted as containing every experimental
> command, environment configuration, or implementation detail used during
> the original research process. Where appropriate, this README distinguishes
> between implemented code, experiment artifacts, and proposed architectural
> mechanisms.

---

# 1. Problem

Traditional Deep Packet Inspection (DPI) becomes increasingly ineffective
when traffic payloads are encrypted using modern protocols such as TLS 1.3 and
QUIC.

At the same time, many deep-learning-based traffic classification approaches
introduce computational overhead that can be difficult to accommodate in
resource-constrained or latency-sensitive network environments.

Network traffic also changes over time, creating the possibility of
**concept drift**, where a classifier trained on historical traffic becomes
less effective when traffic characteristics change.

Nano-Stream addresses this problem through a lightweight flow-level traffic
classification architecture designed for integration with SDN environments.

The high-level pipeline is:

    Network Traffic
          |
          v
    Flow-Level Features
          |
          v
    Tiny 1D-CNN
          |
          v
    Quantized Inference
          |
          v
    Traffic Classification
          |
          v
    SDN Controller
          |
          v
    QoS / Enforcement

The neural network does not receive raw packet payloads or packet sequences.
It receives a 14-dimensional flow-level feature vector.

---

# 2. Traffic Classes

The classification task contains seven traffic/attack classes:

1. BENIGN
2. Bot
3. DDoS
4. DoS
5. FTP
6. PortScan
7. BruteForce

---

# 3. System Architecture

Nano-Stream can be understood as three major layers.

## Layer 1 — Data & Feature Pipeline

This layer prepares the network traffic data before it reaches the machine
learning models.

    Raw CIC-IDS2017 CSV files
              |
              v
    scripts/create_slice.py
              |
              v
    data/cicids2017_slice.csv
              |
              v
        features.json
              |
              +--------------------+
              |                    |
              v                    v
    scripts/run_boruta.py       train.py
              |
              v
    metrics/boruta_ranking.csv

This layer is responsible for:

- discovering raw CIC-IDS2017 CSV files
- standardizing dataset column names
- cleaning invalid values
- creating the prepared dataset
- defining the canonical 14-feature schema
- performing Boruta feature-ranking analysis
- generating feature-ranking artifacts

---

## Layer 2 — Model, Evaluation & Deployment

This layer connects the trained models to evaluation and deployment
experiments.

    Prepared Dataset
          |
          v
       train.py
          |
          v
    Model Architecture
          |
          +-----------------------------+
          |                             |
          v                             v
      FP32 Model                  Baseline Models
          |                       BiLSTM / Transformer
          v
    TorchScript / Quantization
          |
          v
    Latency Evaluation
          |
          v
    Cross-Dataset Evaluation

Relevant components include:

- `train.py`
- `models/tiny_1d_cnn.py`
- `models/bilstm_baseline.py`
- `models/transformer_baseline.py`
- `scripts/create_float_script.py`
- `scripts/quantize_run.py`
- `scripts/measure_latency.py`
- `scripts/test_cross_dataset.py`
- `scripts/train_baselines.py`

---

## Layer 3 — SDN Control & Enforcement

This layer connects the machine-learning classifier to the Software-Defined
Networking control plane.

    Network Traffic
          |
          v
    OpenFlow Switch
          |
       PacketIn
          |
          v
    Ryu Controller
          |
          v
    Feature Extraction
          |
          v
    Nano-Stream Inference
          |
          v
    Traffic Classification
          |
          v
    FlowMod / QoS Enforcement
          |
          v
    OpenFlow Switch

The main SDN application is:

    ryu_app/nano_guard.py

The intended SDN stack includes:

- Ryu
- Open vSwitch (OVS)
- OpenFlow 1.3
- Mininet
- Tcpreplay

---

# 4. Model

The primary Nano-Stream classifier is a lightweight 1D-CNN.

## Input

The model receives:

    (batch, 1, 14)

where:

- `batch` = number of samples
- `1` = input channel
- `14` = number of flow-level features

## Architecture

    Input: 1 × 14
          |
          v
    Conv1D
    8 filters
    kernel size = 3
          |
          v
        ReLU
          |
          v
     MaxPooling
          |
          v
    Conv1D
    16 filters
    kernel size = 3
          |
          v
        ReLU
          |
          v
    Global Average Pooling
          |
          v
    Fully Connected
    16 → 64
          |
          v
        ReLU
          |
          v
      Dropout 0.2
          |
          v
    Fully Connected
    64 → 7
          |
          v
    Class Prediction

Implementation:

    models/tiny_1d_cnn.py

The model is intentionally compact to reduce inference overhead and make
CPU-oriented deployment more practical.

---

# 5. Input Features

Nano-Stream uses the following canonical 14-dimensional feature vector:

    [
        flow_duration,
        total_fwd_packets,
        total_bwd_packets,
        total_fwd_bytes,
        total_bwd_bytes,
        avg_fwd_pkt_len,
        avg_bwd_pkt_len,
        std_fwd_iat,
        mean_fwd_iat,
        pkt_rate,
        byte_rate,
        fwd_iat_total,
        min_pkt_size,
        tcp_flag_count_SYN
    ]

The canonical feature list is stored in:

    features.json

The feature names are standardized from the original CIC-IDS2017 column names
during preprocessing.

### Important

Feature ordering matters.

The Tiny1DCNN treats the 14 values as an ordered one-dimensional input.
Therefore, the same features in a different order do not represent the same
model input.

---

# 6. Dataset

## Primary Dataset

Nano-Stream uses:

**CIC-IDS2017**

The repository also contains local artifacts associated with:

**CSE-CIC-IDS2018**

The latter is used for cross-dataset evaluation.

## Dataset Distribution

Large raw datasets are not intended to be distributed through the GitHub
repository.

The local research environment may contain dataset files that are excluded
from Git using `.gitignore`.

The expected local structure is:

    data/
    ├── cicids2017_slice.csv
    │
    ├── CSE-CIC-IDS2018/
    │   ├── Bot.csv
    │   ├── Brute Force -Web.csv
    │   ├── Brute Force -XSS.csv
    │   ├── DDOS attack-HOIC.csv
    │   ├── DDOS attack-LOIC-UDP.csv
    │   ├── DDoS attacks-LOIC-HTTP.csv
    │   ├── DoS attacks-GoldenEye.csv
    │   ├── DoS attacks-Hulk.csv
    │   ├── DoS attacks-SlowHTTPTest.csv
    │   ├── DoS attacks-Slowloris.csv
    │   ├── FTP-BruteForce.csv
    │   ├── Infilteration.csv
    │   ├── SQL Injection.csv
    │   └── SSH-Bruteforce.csv
    │
    └── raw/
        └── MachineLearningCVE/
            ├── Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv
            ├── Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv
            ├── Friday-WorkingHours-Morning.pcap_ISCX.csv
            ├── Monday-WorkingHours.pcap_ISCX.csv
            ├── Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv
            ├── Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv
            ├── Tuesday-WorkingHours.pcap_ISCX.csv
            └── Wednesday-workingHours.pcap_ISCX.csv

Users must obtain the datasets through their appropriate public distribution
channels before executing scripts that require them.

---

# 7. Data Preprocessing

The primary preprocessing script is:

    scripts/create_slice.py

Its general flow is:

    Raw CSV files
          |
          v
    Column discovery
          |
          v
    Column-name normalization
          |
          v
    Invalid-value handling
          |
          v
    Required-column validation
          |
          v
    Prepared dataset
          |
          v
    data/cicids2017_slice.csv

The script supports a configurable row limit.

The repository's prepared local slice is approximately 67 MB.

---

# 8. Feature Selection

Feature-selection analysis is performed using Boruta.

Script:

    scripts/run_boruta.py

Output:

    metrics/boruta_ranking.csv

The artifact contains feature ranking and support information generated by
the Boruta procedure.

The feature-selection stage is part of the research workflow used to identify
the feature representation used by Nano-Stream.

---

# 9. Training

The primary training entry point is:

    train.py

Supported architectures:

    cnn
    bilstm
    transformer

General flow:

    CSV Dataset
        |
        v
    Feature Loading
        |
        v
    Label Encoding
        |
        v
    Train / Validation Split
        |
        v
    DataLoader
        |
        v
    Model
        |
        v
    Training
        |
        v
    Validation
        |
        v
    Checkpoint
        |
        v
    results/experiment_log.csv

The training script supports command-line configuration for parameters such
as:

- model architecture
- dataset path
- feature definition
- output checkpoint
- number of epochs
- batch size
- learning rate
- weight decay
- validation fraction
- random seed
- label configuration
- GPU selection

### Reproducibility note

The published experimental results should not be assumed to correspond
automatically to the Python default arguments.

Some experimental configurations were executed explicitly from the command
line during the original research workflow.

Therefore, reproducing the paper requires using the appropriate experimental
commands and parameters rather than relying only on script defaults.

---

# 10. Baseline Models

Nano-Stream includes two neural-network baselines.

## BiLSTM

Implementation:

    models/bilstm_baseline.py

The model provides a bidirectional LSTM-based comparison against the primary
1D-CNN architecture.

## Transformer

Implementation:

    models/transformer_baseline.py

The model provides a Transformer Encoder-based comparison.

These models are included for experimental comparison and are not the primary
Nano-Stream deployment architecture.

---

# 11. Quantization

Nano-Stream uses post-training dynamic quantization.

The intended workflow is:

    FP32 Model
        |
        v
    Dynamic Quantization
        |
        v
    Quantized Model
        |
        v
    CPU Inference

The quantization implementation is:

    scripts/quantize_run.py

The repository contains:

    checkpoints/cnn_quantized.pt

### Technical detail

The current PyTorch implementation applies dynamic INT8 quantization to the
supported `Linear` layers.

Therefore, the repository should not claim that every `Conv1D` operation is
necessarily INT8-quantized.

---

# 12. Deployment Artifacts

The repository contains several checkpoint categories.

## CNN

    cnn_s0.pt
    cnn_s1.pt
    cnn_s2.pt
    cnn_s3.pt
    cnn_s4.pt
    cnn_smoke.pt
    cnn_quantized.pt

## FP32 / deployment artifacts

    float.pt
    float_scripted.pt
    demo.pt

## BiLSTM

    bilstm_s0.pt
    bilstm_s1.pt
    bilstm_s2.pt
    bilstm_s3.pt
    bilstm_s4.pt
    bilstm_smoke.pt
    bilstm_scripted.pt

## Transformer

    transformer_s0.pt
    transformer_s1.pt
    transformer_s2.pt
    transformer_s3.pt
    transformer_s4.pt
    transformer_smoke.pt
    transformer_scripted.pt

These checkpoints were generated for different experiments, seeds, smoke
tests, or deployment stages.

A checkpoint must be loaded using the architecture and configuration
corresponding to that artifact.

---

# 13. Latency Evaluation

Inference latency is measured using:

    scripts/measure_latency.py

The research reports:

| Model     |      Latency |
| --------- | -----------: |
| FP32      | 2.00 ms/flow |
| Quantized | 1.17 ms/flow |

This corresponds to a reported:

**41.5% latency reduction**

The experiments were performed with GPU acceleration disabled to represent
CPU-oriented / edge-style inference conditions.

---

# 14. Cross-Dataset Evaluation

Cross-dataset evaluation is performed using:

    scripts/test_cross_dataset.py

The research reports an accuracy of:

**70.4%**

on CSE-CIC-IDS2018 without retraining.

This experiment is important because it provides an indication of how the
trained classifier behaves when evaluated against a different traffic
distribution.

---

# 15. SDN Environment

Nano-Stream's SDN integration uses:

| Component        | Technology   |
| ---------------- | ------------ |
| SDN Controller   | Ryu          |
| Network Emulator | Mininet      |
| Virtual Switch   | Open vSwitch |
| Protocol         | OpenFlow 1.3 |
| Traffic Replay   | Tcpreplay    |

The primary controller application is:

    ryu_app/nano_guard.py

The intended runtime flow is:

    Traffic
       |
       v
    OpenFlow Switch
       |
       | PacketIn
       v
    Ryu Controller
       |
       v
    Flow Feature Extraction
       |
       v
    Nano-Stream Model
       |
       v
    Classification
       |
       v
    SDN Enforcement
       |
       v
    FlowMod / QoS Rules
       |
       v
    Switch

The environment is emulated/simulated rather than a deployment on physical
network hardware.

---

# 16. QoS Results

The published research reports the following QoS changes:

| Metric          |  Before |  After |
| --------------- | ------: | -----: |
| Video jitter    | 45.2 ms | 3.8 ms |
| Packet loss     |   12.5% |   0.8% |
| Average latency |  120 ms |  28 ms |

Reported video-jitter reduction:

**91%**

These are paper-reported experimental results.

---

# 17. Concept Drift

Nano-Stream proposes a Drift-Aware Replay Buffer for adapting to changing
traffic patterns.

The intended mechanism is:

    Incoming Flow
         |
         v
    Nano-Stream Prediction
         |
         v
    Confidence Check
         |
         +----------------------+
         |                      |
         v                      v
    Confidence >= 0.7      Confidence < 0.7
         |                      |
         v                      v
     Accept                 Replay Buffer
         |                      |
         v                      v
     QoS Rule              Oracle Label
                                |
                                v
                         FC-layer Fine-tuning
                                |
                                v
                          New Checkpoint

The convolutional feature extractor is intended to remain frozen during
adaptation while the fully connected classification layers are fine-tuned.

Periodic checkpoints are intended to provide rollback if an update causes
performance degradation.

The published drift experiment reports a drift event around 80 seconds,
followed by recovery to more than 90% accuracy by approximately 140 seconds.

### Implementation status

The complete replay-buffer, oracle-labeling, online fine-tuning and rollback
pipeline should not be assumed to be fully implemented in the current
repository unless the relevant implementation is explicitly present and
verified.

The mechanism should therefore be understood as a proposed/research
framework component where implementation is incomplete.

---

# 18. Implementation Status

The repository contains both implemented software and mechanisms described at
the research/architectural level.

| Component                         | Status                            |
| --------------------------------- | --------------------------------- |
| CIC-IDS2017 preprocessing         | Implemented                       |
| 14-feature schema                 | Implemented                       |
| Boruta feature analysis           | Implemented                       |
| Tiny1DCNN                         | Implemented                       |
| BiLSTM baseline                   | Implemented                       |
| Transformer baseline              | Implemented                       |
| Training pipeline                 | Implemented                       |
| FP32 checkpoints                  | Present                           |
| TorchScript artifacts             | Present                           |
| Dynamic quantization              | Implemented                       |
| Latency measurement               | Implemented                       |
| Cross-dataset evaluation          | Implemented                       |
| Ryu controller application        | Present                           |
| SDN enforcement                   | Present / research implementation |
| Drift-aware replay buffer         | Proposed / incomplete             |
| Oracle-assisted online adaptation | Not established as complete       |
| Online FC-only fine-tuning        | Not established as complete       |
| Production flow-state tracking    | Requires further implementation   |
| Production deployment hardening   | Future work                       |

This distinction is intentional.

A feature described in the paper or architecture blueprint is not automatically
treated as fully implemented simply because it is part of the proposed
system.

---

# 19. Repository Structure

```text
Nano-Stream/
│
├── .clinerules
│
├── .github/
│
├── checkpoints/
│   ├── CNN checkpoints
│   ├── BiLSTM checkpoints
│   ├── Transformer checkpoints
│   ├── FP32 artifacts
│   ├── TorchScript artifacts
│   └── Quantized artifacts
│
├── data/
│   ├── cicids2017_slice.csv
│   ├── CSE-CIC-IDS2018/
│   └── raw/
│
├── docs/
│   ├── files/
│   │   ├── blueprint.md
│   │   ├── boruta_ranking.md
│   │   ├── clinerules.md
│   │   └── features.md
│   │
│   └── layers/
│       ├── 01_data_and_feature_pipeline.md
│       ├── 02_model_evaluation_deployment.md
│       └── 03_sdn_control_and_enforcement.md
│
├── metrics/
│   ├── boruta_ranking.csv
│   └── offline_baselines.csv
│
├── models/
│   ├── bilstm_baseline.py
│   ├── tiny_1d_cnn.py
│   └── transformer_baseline.py
│
├── plans/
│   └── blueprint.md
│
├── results/
│   └── experiment_log.csv
│
├── ryu_app/
│   └── nano_guard.py
│
├── scripts/
│   ├── create_float_script.py
│   ├── create_slice.py
│   ├── measure_latency.py
│   ├── quantize_run.py
│   ├── run_boruta.py
│   ├── test_cross_dataset.py
│   └── train_baselines.py
│
├── features.json
├── sanity_check.py
├── train.py
│
├── CITATION.cff
├── CONTRIBUTING.md
├── LICENSE
├── SECURITY.md
└── requirements.txt
```

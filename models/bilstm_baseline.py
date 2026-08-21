"""
===============================================================================
FILE: models/bilstm_baseline.py
===============================================================================

PURPOSE
-------
Defines the BiLSTM baseline model used for comparison against Nano-Stream's
Tiny1DCNN architecture.

ROLE IN NANOSTREAM
------------------
This model is a BASELINE.

It is not the primary Nano-Stream deployment architecture.

Its purpose is to provide a sequence-model comparison for offline experiments.

INPUT
-----
Expected input:

    (batch_size, n_features)

The model treats the feature vector as a sequence where each feature is a
timestep containing one value.

INTERNAL REPRESENTATION
-----------------------
Input:

    (B, 14)

becomes approximately:

    (B, 14, 1)

before being passed to the bidirectional LSTM.

ARCHITECTURE
------------
Feature vector
    ↓
sequence representation
    ↓
Bidirectional LSTM
    ↓
max pooling across sequence
    ↓
Linear → 64
    ↓
Dropout(0.2)
    ↓
Linear → n_classes

OUTPUT
------
Classification logits:

    (B, n_classes)

CONSTRUCTOR
-----------
Parameters include:

    n_features
    n_classes
    hidden_size
    num_layers
    dropout
    bidirectional

Current architecture uses a hidden size of 64, one LSTM layer, dropout 0.2,
and bidirectional processing.

FORWARD()
---------
INPUT:
    (B, n_features)

PROCESS:
    Converts the feature vector into a sequence representation, processes it
    through the BiLSTM, and aggregates the sequence using max pooling.

OUTPUT:
    (B, n_classes)

STANDALONE TEST
---------------
The file contains a __main__ smoke test.

The standalone test uses:

    14 features
    5 classes

This is a test configuration rather than the seven-class production task.

DEPENDENCIES
------------
PyTorch.

DOWNSTREAM USE
--------------
Used by:

    train.py

and potentially by baseline checkpoint/evaluation scripts.

CHECK 2 STATUS
--------------
Runtime test:
    PASS

The model successfully accepts the expected feature shape and produces
classification outputs.

KNOWN ISSUE
-----------
The standalone smoke test uses five classes rather than seven.

This does not affect the model's ability to support arbitrary class counts.

V1 ACTION
---------
KEEP as a baseline.

Update the standalone smoke test to use the project's canonical seven classes
for consistency.

===============================================================================
"""

# models/bilstm_baseline.py
import torch
import torch.nn as nn

class BiLSTMClassifier(nn.Module):
    def __init__(self, n_features: int, n_classes: int,
                 hidden_size: int = 64,
                 num_layers: int = 1,
                 dropout: float = 0.2,
                 bidirectional: bool = True):
        super().__init__()

        self.seq_len = n_features
        self.input_size = 1
        self.num_directions = 2 if bidirectional else 1

        self.lstm = nn.LSTM(
            input_size=1,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=bidirectional,
            dropout=dropout if num_layers > 1 else 0.0
        )

        self.fc1 = nn.Linear(hidden_size * self.num_directions, 64)
        self.dropout = nn.Dropout(dropout)
        self.fc2 = nn.Linear(64, n_classes)

    def forward(self, x):
        # x: (B, n_features)
        # convert to (B, seq_len, 1)
        x = x.unsqueeze(-1)   # (B, seq_len, 1)
        out, _ = self.lstm(x)  # out: (B, seq_len, hidden*num_directions)
        out_pool, _ = torch.max(out, dim=1)  # (B, hidden*num_directions)
        h = torch.relu(self.fc1(out_pool))
        h = self.dropout(h)
        logits = self.fc2(h)
        return logits

if __name__ == "__main__":
    # quick sanity check with consistent constructor + input shape
    n_features = 14
    n_classes = 5
    m = BiLSTMClassifier(n_features=n_features, n_classes=n_classes)
    x = torch.randn(8, n_features)   # (batch, n_features)
    y = m(x)
    print("Output shape:", y.shape)  # expected (8, 5)
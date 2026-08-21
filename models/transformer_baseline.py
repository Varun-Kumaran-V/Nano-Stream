"""
===============================================================================
FILE: models/transformer_baseline.py
===============================================================================

PURPOSE
-------
Defines the Transformer-based baseline architecture used to compare
Nano-Stream's Tiny1DCNN against a more attention-oriented sequence model.

ROLE IN NANOSTREAM
------------------
This is an OFFLINE BASELINE.

It is not the primary Nano-Stream deployment model.

CLASSES
-------
1. PositionalEncoding
2. TransformerClassifier

CLASS: PositionalEncoding
-------------------------
Provides sinusoidal positional information to the Transformer representation.

CLASS: TransformerClassifier
----------------------------
Processes the 14-feature vector as a sequence.

INPUT
-----
Expected input:

    (B, n_features)

The features are converted into a sequence representation where each feature
initially contains one scalar value.

ARCHITECTURE
------------
Feature vector
    ↓
sequence representation
    ↓
Linear: 1 → 64
    ↓
Positional Encoding
    ↓
Transformer Encoder
    ↓
Mean pooling across sequence
    ↓
Linear → 64
    ↓
ReLU
    ↓
Dropout(0.2)
    ↓
Linear → n_classes

DEFAULT TRANSFORMER CONFIGURATION
---------------------------------
d_model:
    64

attention heads:
    4

encoder layers:
    2

feedforward dimension:
    128

dropout:
    0.2

OUTPUT
------
Classification logits:

    (B, n_classes)

FORWARD()
---------
INPUT:
    (B, n_features)

PROCESS:
    1. Convert features into sequence representation.
    2. Project scalar feature values into d_model dimensions.
    3. Add positional information.
    4. Apply Transformer encoder.
    5. Average sequence representations.
    6. Apply fully connected classification layers.

OUTPUT:
    (B, n_classes)

DEPENDENCIES
------------
PyTorch.

DOWNSTREAM USE
--------------
Used by:

    train.py

for baseline comparison.

CHECK 2 STATUS
--------------
Runtime test:
    PASS

The Transformer model successfully processes the intended feature shape and
produces classification outputs.

DOCUMENTATION NOTE
------------------
The positional encoding documentation/comments use the traditional
(seq_len, batch, d_model) terminology, while the Transformer encoder is
configured with batch_first=True.

The actual tested execution works, but the comments should be clarified so
future developers do not misunderstand the tensor layout.

V1 ACTION
---------
KEEP as a baseline.

Clarify tensor-shape documentation during repository cleanup.

===============================================================================
"""

# models/transformer_baseline.py
import math
import torch
import torch.nn as nn

class PositionalEncoding(nn.Module):
    """Classic sinusoidal positional encoding."""
    def __init__(self, d_model, max_len=5000):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(0, max_len, dtype=torch.float32).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2, dtype=torch.float32) *
                             (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div_term)
        pe[:, 1::2] = torch.cos(pos * div_term)
        pe = pe.unsqueeze(1)  # (max_len, 1, d_model)
        self.register_buffer('pe', pe)

    def forward(self, x):
        # x: (seq_len, batch, d_model)
        seq_len = x.size(0)
        x = x + self.pe[:seq_len]
        return x

class TransformerClassifier(nn.Module):
    def __init__(self, n_features: int, n_classes: int,
                 d_model: int = 64,
                 nhead: int = 4,
                 num_layers: int = 2,
                 dim_feedforward: int = 128,
                 dropout: float = 0.2):
        super().__init__()

        self.seq_len = n_features

        self.input_proj = nn.Linear(1, d_model)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
         batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.pos_enc = PositionalEncoding(d_model, max_len=500)
        self.fc = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, n_classes)
        )

    def forward(self, x):
        # x: (B, n_features)

        x = x.unsqueeze(-1)          # (B, seq_len, 1)
        x = self.input_proj(x)       # (B, seq_len, d_model)

        x = self.pos_enc(x)          # add positional encoding
        x = self.transformer(x)      # (B, seq_len, d_model)

        x = x.mean(dim=1)            # global average pool over sequence
        logits = self.fc(x)

        return logits

if __name__ == "__main__":
    # quick sanity check with same input shape convention
    n_features = 14
    n_classes = 5
    m = TransformerClassifier(n_features=n_features, n_classes=n_classes)
    x = torch.randn(8, n_features)   # (batch, n_features)
    y = m(x)
    print("Output shape:", y.shape)  # expected (8, 5)
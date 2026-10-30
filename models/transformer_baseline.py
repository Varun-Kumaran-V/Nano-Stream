"""
===============================================================================
FILE: models/transformer_baseline.py
===============================================================================

PURPOSE
-------
Defines the Transformer-based baseline architecture used to compare
Nano-Stream's Tiny1DCNN against an attention-oriented sequence model.

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
Provides sinusoidal positional information to the Transformer representation
with correct broadcasting for batch_first=True tensors: (batch, seq_len, d_model).

CLASS: TransformerClassifier
----------------------------
Processes the 14-feature vector as a sequence where each feature is a token.

INPUT
-----
Expected input:

    (B, n_features)

The features are converted into a sequence representation where each feature
initially contains one scalar value.

ARCHITECTURE
------------
Feature vector (B, n_features)
    ↓
Sequence representation (B, seq_len, 1)
    ↓
Linear projection: 1 → d_model (64)
    ↓
Positional Encoding (broadcasting across batch dimension: (1, seq_len, d_model))
    ↓
Transformer Encoder (batch_first=True, 2 layers, 4 heads)
    ↓
Global Average Pooling across sequence dimension (dim=1)
    ↓
Linear → 64
    ↓
ReLU
    ↓
Dropout(0.2)
    ↓
Linear → n_classes

OUTPUT
------
Classification logits:

    (B, n_classes)

DEPENDENCIES
------------
PyTorch (torch, torch.nn).

===============================================================================
"""

import math
import torch
import torch.nn as nn


class PositionalEncoding(nn.Module):
    """
    Classic sinusoidal positional encoding supporting batch_first=True layouts.

    Tensors entering forward() are shaped (batch_size, seq_len, d_model).
    The stored positional table has shape (1, max_len, d_model) to broadcast
    correctly across arbitrary batch sizes.
    """
    def __init__(self, d_model: int, max_len: int = 5000):
        super().__init__()
        pe = torch.zeros(max_len, d_model, dtype=torch.float32)
        pos = torch.arange(0, max_len, dtype=torch.float32).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2, dtype=torch.float32) * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(pos * div_term)
        pe[:, 1::2] = torch.cos(pos * div_term)
        pe = pe.unsqueeze(0)  # Shape: (1, max_len, d_model)
        self.register_buffer('pe', pe)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Add positional encoding to sequence tokens.

        Args:
            x (torch.Tensor): Input sequence of shape (B, seq_len, d_model).

        Returns:
            torch.Tensor: Position-encoded tensor of shape (B, seq_len, d_model).
        """
        seq_len = x.size(1)
        return x + self.pe[:, :seq_len, :]


class TransformerClassifier(nn.Module):
    """
    Transformer baseline classifier for multi-class flow classification.
    """
    def __init__(
        self,
        n_features: int,
        n_classes: int,
        d_model: int = 64,
        nhead: int = 4,
        num_layers: int = 2,
        dim_feedforward: int = 128,
        dropout: float = 0.2,
    ):
        super().__init__()

        self.seq_len = n_features
        self.d_model = d_model
        self.n_classes = n_classes

        self.input_proj = nn.Linear(1, d_model)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.pos_enc = PositionalEncoding(d_model=d_model, max_len=500)
        self.fc = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, n_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass converting feature vector into logits.

        Args:
            x (torch.Tensor): Batch tensor of shape (B, n_features).

        Returns:
            torch.Tensor: Class logits of shape (B, n_classes).
        """
        # x: (B, n_features) -> (B, seq_len, 1)
        x = x.unsqueeze(-1)
        x = self.input_proj(x)  # (B, seq_len, d_model)

        x = self.pos_enc(x)     # (B, seq_len, d_model)
        x = self.transformer(x) # (B, seq_len, d_model)

        x = x.mean(dim=1)       # Global average pool over sequence -> (B, d_model)
        logits = self.fc(x)     # (B, n_classes)

        return logits


if __name__ == "__main__":
    n_features = 14
    n_classes = 7
    m = TransformerClassifier(n_features=n_features, n_classes=n_classes)
    # Test batch size 8 != seq_len 14
    x = torch.randn(8, n_features)
    y = m(x)
    print("TransformerClassifier output shape:", y.shape)
    assert y.shape == (8, 7), f"Expected (8, 7), got {y.shape}"
    print("[PASS] Positional encoding and Transformer forward verified.")

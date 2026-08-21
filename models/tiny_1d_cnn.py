"""
===============================================================================
FILE: models/tiny_1d_cnn.py
===============================================================================

PURPOSE
-------
Defines Nano-Stream's primary lightweight 1D-CNN classifier.

ROLE IN NANOSTREAM
------------------
This is the core machine-learning architecture responsible for classification
of the 14-dimensional flow-level feature representation.

It is the primary model rather than a baseline.

INPUT
-----
Expected model input:

    (batch_size, n_features)

For the published Nano-Stream configuration:

    n_features = 14

The forward() method adds a channel dimension when necessary so the tensor
becomes:

    (batch_size, 1, n_features)

ARCHITECTURE
------------
Input
    ↓
Conv1D: 1 → 8
kernel = 3
padding = 1
    ↓
ReLU
    ↓
MaxPool1D(kernel=2)
    ↓
Conv1D: 8 → 16
kernel = 3
padding = 1
    ↓
ReLU
    ↓
AdaptiveAvgPool1D(1)
    ↓
Linear: 16 → 64
    ↓
ReLU
    ↓
Dropout(0.2)
    ↓
Linear: 64 → n_classes

OUTPUT
------
For the published seven-class configuration:

    (batch_size, 7)

The output contains classification logits.

The model itself does not apply softmax.

CONSTRUCTOR
-----------
Tiny1DCNN(n_features, n_classes)

Current source defaults:

    n_features = 15
    n_classes = 5

These defaults do not match the published Nano-Stream configuration.

However, train.py explicitly supplies the dimensions based on the dataset,
so the defaults do not currently break the normal training path.

FORWARD()
---------
INPUT:
    Tensor with shape:

        (B, n_features)

or an already channelized tensor compatible with Conv1D.

PROCESS:
    Adds a channel dimension when required.
    Applies the convolutional and fully connected layers.

OUTPUT:
    Tensor with shape:

        (B, n_classes)

DEPENDENCIES
------------
PyTorch only.

DOWNSTREAM USE
--------------
The model is instantiated by:

    train.py

Its saved state_dict is later used by downstream model-loading,
quantization, evaluation, or deployment scripts.

ARCHITECTURAL SIGNIFICANCE
--------------------------
The model is deliberately small to support:

    low inference latency
    CPU/edge-oriented execution
    reduced model complexity

IMPORTANT MODEL ASSUMPTION
--------------------------
The 14 flow features are treated as an ordered one-dimensional sequence.

Therefore feature ordering is part of the model input contract.

Changing the order of features without retraining can alter the learned
relationships represented by the convolutional layers.

CHECK 2 STATUS
--------------
Runtime test:
    PASS

The model accepts the expected feature tensor and produces valid logits.

KNOWN ISSUE
-----------
The constructor defaults use:

    15 features
    5 classes

while Nano-Stream's actual configuration is:

    14 features
    7 classes

This is a configuration/documentation inconsistency rather than a current
training-path failure.

V1 ACTION
---------
MODIFY defaults or make the dimensions explicit after the complete repository
audit.

===============================================================================
"""

# models/tiny_1d_cnn.py
"""
Tiny1DCNN model: small, efficient 1D-CNN for flow-level feature vectors.
Input: (batch, n_features)
We reshape to (batch, 1, n_features) and apply Conv1d layers.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

class Tiny1DCNN(nn.Module):
    def __init__(self, n_features: int = 15, n_classes: int = 5):
        super().__init__()
        # Conv1d expects (batch, channels, length). We'll treat features as "length".
        self.conv1 = nn.Conv1d(in_channels=1, out_channels=8, kernel_size=3, padding=1)
        self.pool1 = nn.MaxPool1d(kernel_size=2)
        self.conv2 = nn.Conv1d(in_channels=8, out_channels=16, kernel_size=3, padding=1)
        self.gap = nn.AdaptiveAvgPool1d(1)  # squeeze length dimension
        self.fc1 = nn.Linear(16, 64)
        self.dropout = nn.Dropout(0.2)
        self.fc2 = nn.Linear(64, n_classes)

        # store shapes
        self.n_features = n_features
        self.n_classes = n_classes

    def forward(self, x):
        """
        x: (batch, n_features)
        returns logits (batch, n_classes)
        """
        # ensure float tensor
        if x.dim() == 2:
            x = x.unsqueeze(1)  # -> (batch, 1, n_features)
        # conv/pool
        x = F.relu(self.conv1(x))
        x = self.pool1(x)
        x = F.relu(self.conv2(x))
        x = self.gap(x)  # (batch, channels, 1)
        x = x.view(x.size(0), -1)  # (batch, channels)
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        logits = self.fc2(x)
        return logits

if __name__ == "__main__":
    # quick shape test
    model = Tiny1DCNN(n_features=15, n_classes=4)
    import torch
    x = torch.randn(8, 15)
    out = model(x)
    print("Out shape:", out.shape)  # should be (8,4)

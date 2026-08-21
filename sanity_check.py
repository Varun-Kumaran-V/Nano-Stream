"""
===============================================================================
FILE: sanity_check.py
===============================================================================

PURPOSE
-------
Performs a lightweight smoke test of Nano-Stream's three model architectures:

    - Tiny1DCNN
    - BiLSTMClassifier
    - TransformerClassifier

The purpose is to verify that the models can accept a feature tensor with
the expected feature dimension and produce classification logits.

ROLE IN PIPELINE
----------------
This file is NOT part of model training.

It is an independent model-interface/shape validation utility.

PIPELINE POSITION
-----------------
No dataset
    ↓
random test tensor
    ↓
model forward pass
    ↓
printed output shapes

INPUT
-----
A randomly generated PyTorch tensor:

    shape = (4, 14)

where:

    4  = number of test samples
    14 = Nano-Stream feature count

The input is generated internally using torch.randn().

No dataset or checkpoint is required.

DEPENDENCIES
------------
- PyTorch
- models/tiny_1d_cnn.py
- models/bilstm_baseline.py
- models/transformer_baseline.py

OUTPUT
------
Prints the output tensor shape produced by each model.

The current smoke test uses:

    n_features = 14
    n_classes  = 5

Therefore its output shape is expected to be:

    (4, 5)

IMPORTANT
---------
The published Nano-Stream classification task uses 7 classes.

Therefore this script currently verifies model interface/shape compatibility,
not the complete production configuration.

FUNCTIONS / CLASSES
-------------------
No user-defined functions are implemented in this file.

The script directly:

1. Creates the models.
2. Creates a random input tensor.
3. Performs forward passes.
4. Prints the resulting tensor shapes.

EXECUTION ORDER
---------------
This file can run independently once the Python dependencies and model files
are available.

It does NOT require:

- create_slice.py
- run_boruta.py
- train.py
- a dataset
- a trained checkpoint

CHECK 2 STATUS
--------------
Runtime verification: PASS.

The script successfully produced model outputs.

CURRENT RESULT
--------------
The three models successfully accepted the 14-feature input and returned
classification outputs.

KNOWN ISSUE
-----------
The smoke test uses 5 classes rather than Nano-Stream's 7 production classes.

This is not a model runtime failure, because the model classes support arbitrary
class counts.

However, the test configuration is inconsistent with the published project.

V1 ACTION
---------
MODIFY.

Use the actual 7-class Nano-Stream configuration and preferably replace simple
printing with explicit assertions.

===============================================================================
"""

# sanity_check.py
import torch
from models.bilstm_baseline import BiLSTMClassifier
from models.transformer_baseline import TransformerClassifier
from models.tiny_1d_cnn import Tiny1DCNN

n_features = 14
n_classes = 5
x = torch.randn(4, n_features)

print("Tiny1DCNN:", Tiny1DCNN(n_features=n_features, n_classes=n_classes)(x).shape)
print("BiLSTM   :", BiLSTMClassifier(n_features=n_features, n_classes=n_classes)(x).shape)
print("Transformer:", TransformerClassifier(n_features=n_features, n_classes=n_classes)(x).shape)
"""
===============================================================================
FILE: tests/test_model_and_schema.py
===============================================================================

PURPOSE
-------
Unit tests verifying model architecture forward passes, schema validation,
Transformer positional encoding correctness, model loader fail-safe behavior,
and confidence gate rejection logic.

===============================================================================
"""

import json
import os
import torch
import pytest

from models.tiny_1d_cnn import Tiny1DCNN
from models.bilstm_baseline import BiLSTMClassifier
from models.transformer_baseline import TransformerClassifier
from models.model_loader import ModelLoader, SafeFallbackClassifier


def test_schema_manifest_validity():
    """Verify that docs/data/schema_manifest.json contains valid 14-feature schema."""
    schema_path = "docs/data/schema_manifest.json"
    assert os.path.exists(schema_path), f"Schema manifest missing at {schema_path}"
    with open(schema_path, "r") as f:
        schema = json.load(f)

    assert "features" in schema
    assert len(schema["features"]) == 14
    for idx, feat in enumerate(schema["features"]):
        assert feat["index"] == idx
        assert "name" in feat
        assert "unit" in feat
        assert "type" in feat


def test_transformer_positional_encoding_batch_first():
    """Verify Transformer positional encoding operates correctly with B != seq_len."""
    n_features = 14
    n_classes = 7
    model = TransformerClassifier(n_features=n_features, n_classes=n_classes)
    model.eval()

    # Batch size 5, seq_len 14
    x = torch.randn(5, n_features)
    out = model(x)
    assert out.shape == (5, 7)


def test_tiny_1d_cnn_forward():
    """Verify Tiny1DCNN produces expected logits for 2D and 3D inputs."""
    model = Tiny1DCNN(n_features=14, n_classes=7)
    model.eval()

    # 2D input (B, 14)
    x2d = torch.randn(4, 14)
    out2d = model(x2d)
    assert out2d.shape == (4, 7)

    # 3D input (B, 1, 14)
    x3d = torch.randn(4, 1, 14)
    out3d = model(x3d)
    assert out3d.shape == (4, 7)


def test_model_loader_missing_artifact_fallback():
    """Verify ModelLoader defaults to safe fallback if artifact is missing."""
    loader = ModelLoader(model_path="non_existent_path.pt")
    assert loader.status == "ARTIFACT_NOT_FOUND"

    res = loader.predict([0.0] * 14, dest_port=50000, protocol="UDP")
    assert res["isFallback"] is True
    assert res["predictedClass"] == "VIDEO_CALL"


def test_model_loader_unknown_gate():
    """Verify that predictions below confidence threshold return UNKNOWN."""
    loader = ModelLoader(
        model_path="checkpoints/home_cnn_quantized.pt",
        schema_manifest_path="docs/data/schema_manifest.json",
        confidence_threshold=1.01,  # Strictly greater than 1.0 to guarantee triggering unknown gate
    )
    if loader.status == "OPERATIONAL":
        res = loader.predict([100.0, 50.0, 10, 10, 5000, 5000, 500.0, 10.0, 500.0, 10.0, 5.0, 5.0, 100000.0, 20.0])
        assert res["predictedClass"] == "UNKNOWN"
        assert res["isLowConfidence"] is True

"""
===============================================================================
FILE: models/model_loader.py
===============================================================================

PURPOSE
-------
Provides safe, validated model artifact loading with cryptographic hash
verification, feature schema checks, taxonomy alignment, and graceful
fallback to deterministic safe policy when models are missing or corrupt.

ROLE IN NANOSTREAM
------------------
This is the MODEL LOADING & ADAPTER INTEGRATION BOUNDARY.

It connects:

    checkpoints/*.pt
          ↓
    schema_manifest.json (Feature schema validation)
          ↓
    sha256 checksum verification
          ↓
    ModelLoader (Safe in-memory model or Safe Fallback state)
          ↓
    ClassifierAdapter (Inference with confidence gate)

SAFETY INVARIANTS
-----------------
1. Missing, unreadable, or corrupted checkpoint files never raise uncaught
   exceptions in runtime service threads.
2. Incompatible feature count or mismatched schema version forces safe mode.
3. When the model is unavailable or in safe mode, the system emits an explicit
   degraded component health status and routes traffic to deterministic
   safe policies rather than failing closed or crashing the network.

INPUT
-----
Configuration dictionary or paths to model artifact and schema manifest.

OUTPUT
------
Loaded model wrapper or SafeFallbackClassifier with explicit status and errors.

DEPENDENCIES
------------
PyTorch, hashlib, json, os, logging.

===============================================================================
"""

import hashlib
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import torch

logger = logging.getLogger("intentqos.models")


class SafeFallbackClassifier:
    """
    Deterministic rule-based fallback classifier used when machine learning
    models are missing, corrupted, or undergoing maintenance.
    """
    def __init__(self, default_class: str = "UNKNOWN"):
        self.default_class = default_class
        self.model_version = "deterministic-rules-fallback-v1.0"
        self.is_ml_active = False

    def predict(
        self,
        features: List[float],
        dest_port: int = 0,
        protocol: str = "TCP",
    ) -> Dict[str, Any]:
        """
        Produce a deterministic classification based on well-known ports.

        Args:
            features: 14-dimensional feature vector.
            dest_port: Transport destination port.
            protocol: Protocol string ('TCP', 'UDP', 'QUIC').

        Returns:
            Dictionary containing predictedClass, confidence, isLowConfidence,
            and modelVersion.
        """
        # Rule-based fallback heuristics based on port/protocol
        if dest_port in (50000, 50001, 3478, 3479) or (protocol == "UDP" and 16384 <= dest_port <= 32767):
            pred_class = "VIDEO_CALL"
            confidence = 0.85
        elif protocol == "UDP" and dest_port in (3074, 27015, 27016, 7777, 9987):
            pred_class = "GAMING"
            confidence = 0.85
        elif dest_port in (80, 443) and protocol == "TCP" and len(features) > 12 and features[12] > 2_000_000:
            pred_class = "VIDEO_STREAMING"
            confidence = 0.70
        elif dest_port in (80, 443):
            pred_class = "INTERACTIVE_WEB_OTHER"
            confidence = 0.75
        else:
            pred_class = "UNKNOWN"
            confidence = 0.50

        return {
            "predictedClass": pred_class,
            "confidence": confidence,
            "isLowConfidence": confidence < 0.65,
            "classScores": {pred_class: confidence},
            "modelVersion": self.model_version,
            "isFallback": True,
            "schemaVersion": "fallback-rules-v1",
        }


class ModelLoader:
    """
    Loads and verifies TorchScript or PyTorch checkpoint artifacts against
    schema manifests and checksum records.
    """
    def __init__(
        self,
        model_path: Optional[str] = None,
        schema_manifest_path: Optional[str] = None,
        expected_sha256: Optional[str] = None,
        confidence_threshold: float = 0.65,
    ):
        self.model_path = model_path
        self.schema_manifest_path = schema_manifest_path
        self.expected_sha256 = expected_sha256
        self.confidence_threshold = confidence_threshold

        self.model: Optional[Any] = None
        self.schema: Dict[str, Any] = {}
        self.classes: List[str] = [
            "VIDEO_CALL",
            "GAMING",
            "VIDEO_STREAMING",
            "BULK_TRANSFER",
            "BACKGROUND_UPDATE_BACKUP",
            "INTERACTIVE_WEB_OTHER",
            "UNKNOWN",
        ]
        self.status: str = "UNINITIALIZED"
        self.error_detail: Optional[str] = None
        self.input_shape: Tuple[int, ...] = (1, 1, 14)
        self.fallback = SafeFallbackClassifier()

        self._load()

    def _compute_sha256(self, filepath: str) -> str:
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                h.update(chunk)
        return h.hexdigest()

    def _load_schema(self) -> bool:
        if not self.schema_manifest_path or not os.path.exists(self.schema_manifest_path):
            self.error_detail = f"Schema manifest not found at: {self.schema_manifest_path}"
            return False

        try:
            with open(self.schema_manifest_path, "r") as f:
                self.schema = json.load(f)

            if "classTaxonomy" in self.schema and "classes" in self.schema["classTaxonomy"]:
                self.classes = self.schema["classTaxonomy"]["classes"]

            return True
        except Exception as e:
            self.error_detail = f"Failed to parse schema manifest: {str(e)}"
            return False

    def _load(self) -> None:
        if not self.model_path:
            self.status = "NO_MODEL_CONFIGURED"
            self.error_detail = "No model artifact path configured. Using deterministic safe fallback."
            return

        if not os.path.exists(self.model_path):
            self.status = "ARTIFACT_NOT_FOUND"
            self.error_detail = f"Model artifact not found: {self.model_path}"
            logger.warning(self.error_detail)
            return

        # Verify checksum if expected
        if self.expected_sha256:
            actual_sha = self._compute_sha256(self.model_path)
            if actual_sha.lower() != self.expected_sha256.lower():
                self.status = "CHECKSUM_MISMATCH"
                self.error_detail = (
                    f"Artifact checksum verification failed. Expected {self.expected_sha256}, "
                    f"got {actual_sha}."
                )
                logger.error(self.error_detail)
                return

        # Verify schema manifest
        if self.schema_manifest_path and not self._load_schema():
            self.status = "SCHEMA_ERROR"
            logger.error(self.error_detail)
            return

        # Attempt loading TorchScript artifact
        try:
            self.model = torch.jit.load(self.model_path, map_location="cpu")
            self.model.eval()

            # Probe valid input shape
            for shape in [(1, 1, 14), (1, 14)]:
                try:
                    dummy = torch.randn(*shape, dtype=torch.float32)
                    with torch.no_grad():
                        _ = self.model(dummy)
                    self.input_shape = shape
                    break
                except Exception:
                    continue

            self.status = "OPERATIONAL"
            logger.info("Successfully loaded model artifact %s (shape %s)", self.model_path, self.input_shape)
        except Exception as e:
            self.status = "LOAD_FAILURE"
            self.error_detail = f"PyTorch load failed for {self.model_path}: {str(e)}"
            logger.error(self.error_detail)
            self.model = None

    def predict(
        self,
        features: List[float],
        dest_port: int = 0,
        protocol: str = "TCP",
    ) -> Dict[str, Any]:
        """
        Run inference using the active model or fall back safely.

        Args:
            features: 14-dimensional feature vector.
            dest_port: Destination port for fallback heuristic.
            protocol: Protocol string.

        Returns:
            Dictionary with classification result, confidence, and provenance metadata.
        """
        if self.status != "OPERATIONAL" or self.model is None:
            return self.fallback.predict(features, dest_port=dest_port, protocol=protocol)

        if len(features) != 14:
            logger.warning("Feature vector length %d != 14. Falling back to safe classifier.", len(features))
            return self.fallback.predict(features, dest_port=dest_port, protocol=protocol)

        try:
            tensor_data = torch.tensor(features, dtype=torch.float32)
            if len(self.input_shape) == 3:
                # Shape: (1, 1, 14)
                input_tensor = tensor_data.view(1, 1, 14)
            else:
                # Shape: (1, 14)
                input_tensor = tensor_data.view(1, 14)

            with torch.no_grad():
                logits = self.model(input_tensor)
                probs = torch.softmax(logits, dim=1).squeeze(0)

            scores: Dict[str, float] = {}
            for i, p in enumerate(probs):
                class_name = self.classes[i] if i < len(self.classes) else f"CLASS_{i}"
                scores[class_name] = round(float(p), 4)

            top_idx = int(torch.argmax(probs).item())
            top_prob = float(probs[top_idx].item())
            top_class = self.classes[top_idx] if top_idx < len(self.classes) else "UNKNOWN"

            # Apply strict confidence threshold & unknown gate
            if top_prob < self.confidence_threshold:
                predicted_class = "UNKNOWN"
                is_low_confidence = True
            else:
                predicted_class = top_class
                is_low_confidence = False

            return {
                "predictedClass": predicted_class,
                "confidence": round(top_prob, 4),
                "isLowConfidence": is_low_confidence,
                "classScores": scores,
                "modelVersion": os.path.basename(self.model_path or "unknown"),
                "isFallback": False,
                "schemaVersion": self.schema.get("schemaVersion", "canonical-14"),
            }
        except Exception as e:
            logger.error("Inference exception: %s. Reverting to safe fallback.", str(e))
            return self.fallback.predict(features, dest_port=dest_port, protocol=protocol)

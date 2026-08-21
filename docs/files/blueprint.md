===============================================================================
FILE: plans/blueprint.md
========================

PURPOSE
-------

Defines the intended architecture and implementation blueprint of Nano-Stream.

It describes how the Training Plane and Control/Enforcement Plane are expected
to interact and identifies the repository components associated with each
stage.

ROLE IN NANOSTREAM
------------------

This is the primary architectural design document.

It is NOT an executable component.

It represents the intended system architecture and should therefore be
compared against the actual source code when assessing implementation
completeness.

MAJOR SYSTEM AREAS
------------------

The blueprint divides Nano-Stream into:

1. Training Plane
2. Control / Enforcement Plane

TRAINING-PLANE FLOW
-------------------

CIC-IDS2017
    ↓
Feature processing
    ↓
14-feature representation
    ↓
Tiny1DCNN
    ↓
Quantized model
    ↓
Deployment artifact

CONTROL / ENFORCEMENT FLOW
--------------------------

OpenFlow Switch
    ↓ PacketIn
Ryu Controller
    ↓
Feature extraction
    ↓
Nano-Stream classifier
    ↓
Prediction
    ↓
FlowMod
    ↓
Switch enforcement

FEATURE SCHEMA
--------------

The model is described as receiving:

    (Batch, 1, 14)

The canonical feature names are maintained separately in:

    features.json

MODEL
-----

The blueprint identifies Tiny1DCNN as the primary lightweight classifier.

It also describes the deployment-oriented checkpoint artifacts.

CHECKPOINTS
-----------

The blueprint refers to:

- float.pt
- float_scripted.pt
- quantized.pt

The quantized checkpoint is described as the primary deployment artifact.

IMPORTANT FILENAME DISCREPANCY
------------------------------

The current repository contains:

    checkpoints/cnn_quantized.pt

rather than:

    checkpoints/quantized.pt

This must be reconciled during the Git V1 cleanup.

SDN FEATURE EXTRACTION
----------------------

The blueprint explicitly states that the current feature extraction logic
uses a placeholder and that a production implementation requires a
flow-state tracker.

Therefore the blueprint itself distinguishes between intended architecture
and the current implementation.

SDN ENFORCEMENT
---------------

The blueprint describes separate malicious and benign enforcement paths.

It also identifies a scalability problem with per-flow exact-match rules.

Under high-volume or spoofed traffic, installing individual flow rules can
increase control-plane traffic and consume switch TCAM resources.

The proposed architectural direction is therefore aggregation/wildcarding
rather than blindly creating one rule per flow.

INPUT
-----

None at runtime.

This file is design documentation.

OUTPUT
------

No executable output.

Its output is an architectural specification.

DEPENDENCIES
------------

None at runtime.

However, it references repository components including:

- features.json
- model implementations
- training scripts
- checkpoint artifacts
- ryu_app/nano_guard.py

CHECK 2 STATUS
--------------

Source inspection completed.

There is no runtime execution associated with this file.

CURRENT-IMPLEMENTATION WARNING
------------------------------

The blueprint should NOT be treated as proof that every described component
is fully implemented.

In particular, the blueprint itself states that feature extraction currently
uses a placeholder and requires a flow-state tracker for production.

V1 ACTION
---------

KEEP.

During final documentation cleanup, distinguish clearly between:

    CURRENT IMPLEMENTATION

and

    PROPOSED / FUTURE ARCHITECTURE

===============================================================================

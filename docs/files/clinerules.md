===============================================================================
FILE: .clinerules
=================

PURPOSE
-------

Defines project-level architectural and engineering rules for Nano-Stream.

This file describes how Nano-Stream is expected to be developed and deployed,
particularly with respect to lightweight inference, SDN control-plane
efficiency, TCAM conservation, and scalable mitigation.

ROLE IN NANOSTREAM
------------------

This is a DEVELOPMENT/ARCHITECTURE RULE FILE.

It does not participate directly in the Python execution pipeline.

Instead, it establishes constraints and intended design principles that should
be followed when modifying the repository.

MAJOR AREAS COVERED
-------------------

1. Nano-Stream architectural identity
2. Model/deployment constraints
3. SDN control-plane efficiency
4. TCAM conservation
5. DDoS mitigation scalability
6. Feature extraction and deployment expectations

KEY PROJECT REFERENCES
----------------------

The rules identify the following components:

- Tiny1DCNN
- features.json
- ryu_app/nano_guard.py
- checkpoints/quantized.pt
- 14-feature model input
- sub-millisecond inference
- reduced PacketIn events

IMPORTANT ARCHITECTURAL REQUIREMENTS
------------------------------------

The rules discourage blindly installing per-flow exact-match rules.

Instead, they prescribe scalable mechanisms such as:

- proactive aggregation
- CIDR/wildcard matching
- phase detection
- Bloom-union synthesis

The motivation is to avoid excessive SDN control-plane activity and TCAM
exhaustion under large traffic volumes or spoofed attacks.

INPUT
-----

None at runtime.

This file is read as project/development guidance.

OUTPUT
------

No runtime output.

Its effective output is a set of engineering constraints for developers.

DEPENDENCIES
------------

None at runtime.

RELATIONSHIP TO OTHER FILES
---------------------------

This file establishes expectations for components that are implemented or
described elsewhere, especially:

- plans/blueprint.md
- models/tiny_1d_cnn.py
- features.json
- ryu_app/nano_guard.py
- checkpoints/

CHECK 2 STATUS
--------------

Verified by source inspection.

There is no executable behavior to test.

IMPORTANT DISCREPANCY
---------------------

The rules refer to:

    checkpoints/quantized.pt

The current repository tree contains:

    checkpoints/cnn_quantized.pt

Therefore the deployment-artifact filename documented here does not currently
match the repository filename.

This must be investigated before Git V1 is finalized.

DO NOT ASSUME YET
-----------------

Do not rename the checkpoint until the complete quantization/deployment
pipeline has been inspected.

V1 ACTION
---------

KEEP.

Later update the artifact name/documentation after the complete checkpoint
pipeline is understood.

===============================================================================

"""
===============================================================================
FILE: scripts/create_float_script.py
===============================================================================

PURPOSE
-------
Converts the trained FP32 Tiny1DCNN checkpoint into a TorchScript model that
can be used for deployment/inference without depending on the normal Python
training pipeline.

ROLE IN NANOSTREAM
------------------
This is the FP32 DEPLOYMENT-CONVERSION stage.

PIPELINE POSITION
-----------------

    train.py
        ↓
    checkpoints/float.pt
        ↓
    create_float_script.py
        ↓
    checkpoints/float_scripted.pt

INPUTS
------
Reads:

    features.json
    checkpoints/float.pt

The number of model input features is derived from features.json.

The model is instantiated as:

    Tiny1DCNN(
        n_features=len(features),
        n_classes=7
    )

OUTPUT
------
Creates:

    checkpoints/float_scripted.pt

This is a TorchScript representation of the FP32 Tiny1DCNN.

INTERNAL PROCESS
----------------
1. Locate repository root.
2. Load features.json.
3. Count the feature names.
4. Construct Tiny1DCNN.
5. Load checkpoints/float.pt.
6. Switch model to evaluation mode.
7. Create example input with shape:

       (1, 1, n_features)

8. Trace the model with torch.jit.trace().
9. Save the resulting TorchScript module.

FUNCTIONS
---------
The script primarily performs its conversion directly in the module execution
path rather than exposing a large reusable function API.

MODEL INPUT
-----------
The resulting TorchScript model expects:

    (batch, 1, 14)

for the current Nano-Stream configuration.

MODEL OUTPUT
------------
The resulting model produces:

    (batch, 7)

classification logits.

EXECUTION ORDER
---------------
This script MUST run after:

    1. train.py

which must produce:

    checkpoints/float.pt

It also requires:

    features.json
    models/tiny_1d_cnn.py

It does NOT require:

    run_boruta.py
    train_baselines.py
    quantize_run.py

CHECK 2
-------
Actual execution:
    PASS

Actual output:
    checkpoints/float_scripted.pt

TorchScript loading:
    PASS

Input shape verified:
    (1, 1, 14)

Output shape verified:
    (1, 7)

IMPORTANT FINDINGS
------------------
1. The class count is hardcoded to 7.

2. The model architecture is reconstructed from source code and then populated
   using float.pt.

3. The resulting TorchScript artifact is a deployment representation, not
   merely a state_dict.

4. The generated TorchScript model requires a 3D CNN input tensor.

V1 ACTION
---------
KEEP.

Later consider storing the class mapping and model metadata alongside the
TorchScript artifact so deployment does not rely on hardcoded values.

===============================================================================
"""

#create_float_script.py

import sys
import os
# --- PATH FIX: Allow importing from parent directory ---
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import torch, json
from models.tiny_1d_cnn import Tiny1DCNN

def script_float():
    # Load configs
    # We assume features.json is in the parent dir relative to this script, or current dir
    # Safe bet: look in parent dir
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    features_path = os.path.join(base_dir, 'features.json')
    float_model_path = os.path.join(base_dir, 'checkpoints', 'float.pt')
    
    with open(features_path) as f:
        features = json.load(f)
    n_features = len(features)
    
    # Load Model
    print(f"[*] Loading float model from {float_model_path}...")
    model = Tiny1DCNN(n_features=n_features, n_classes=7) 
    model.load_state_dict(torch.load(float_model_path, map_location='cpu'))
    model.eval()
    
    # Trace
    print("[*] Scripting (Tracing) float model...")
    example = torch.randn(1, 1, n_features)
    scripted = torch.jit.trace(model, example)
    
    # Save
    out_path = os.path.join(base_dir, 'checkpoints', 'float_scripted.pt')
    scripted.save(out_path)
    print(f"[SUCCESS] Saved scripted float model to {out_path}")

if __name__ == "__main__":
    script_float()
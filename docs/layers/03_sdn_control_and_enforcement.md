# Layer 03 — SDN Control & Enforcement

## 1. Purpose

This layer connects the Nano-Stream ML model to the Software-Defined
Networking control plane.

Its purpose is to demonstrate the path from:

```text
network traffic
    ↓
OpenFlow switch
    ↓
Ryu controller
    ↓
Nano-Stream inference
    ↓
traffic classification
    ↓
SDN enforcement
```

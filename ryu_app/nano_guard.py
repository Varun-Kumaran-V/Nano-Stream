"""
===============================================================================
FILE: ryu_app/nano_guard.py
===============================================================================

PURPOSE
-------
Implements the Nano-Stream SDN control/enforcement application using the Ryu
SDN controller and OpenFlow 1.3.

The application connects an OpenFlow switch to the Nano-Stream inference
model and uses the model's predicted traffic class to determine whether
traffic should be forwarded or dropped.

ROLE IN NANOSTREAM
------------------
This file represents the CONTROL / ENFORCEMENT PLANE.

It is intended to connect:

    OpenFlow switch
          ↓
    Ryu controller
          ↓
    Nano-Stream model
          ↓
    traffic classification
          ↓
    SDN enforcement

CURRENT IMPLEMENTATION STATUS
-----------------------------
This file implements the Ryu/OpenFlow control flow and model-inference
integration.

However, the actual network-flow feature extraction is NOT implemented.

Instead, the current code generates:

    torch.randn(1, 1, 14)

as a placeholder input to the model.

Therefore this file currently demonstrates the SDN + AI inference pipeline,
but it does NOT perform real flow-level traffic classification from packet
history.

DEPENDENCIES
------------
Python packages/components:

- Ryu
- PyTorch
- NumPy
- OpenFlow 1.3 support
- Ryu packet parsing modules

Project dependencies:

- checkpoints/quantized.pt   [CURRENT CODE EXPECTS THIS NAME]
- 14-feature Nano-Stream model

IMPORTANT CHECKPOINT DISCREPANCY
--------------------------------
The code attempts to load:

    checkpoints/quantized.pt

The current repository contains:

    checkpoints/cnn_quantized.pt

Therefore the current source code does NOT match the actual repository
checkpoint filename.

This is a confirmed deployment integration issue.

Do NOT silently rename either artifact until the complete deployment pipeline
has been audited.

CLASS
-----
NanoGuard(app_manager.RyuApp)

This is the main Ryu application class.

OPENFLOW VERSION
----------------
The application explicitly uses:

    OpenFlow 1.3

through:

    ofproto_v1_3.OFP_VERSION

INITIALIZATION
--------------
__init__()

The constructor:

1. Initializes the parent Ryu application.
2. Attempts to load the TorchScript quantized model.
3. Moves the model into evaluation mode.
4. Defines the expected 14-feature ordering.

MODEL LOADING
-------------
The code uses:

    torch.jit.load()

with:

    map_location='cpu'

Therefore inference is intended to run on the CPU.

If model loading fails:

    self.model = None

and an error is logged.

FEATURE SCHEMA
--------------
The file manually defines the same 14 features as features.json:

1. flow_duration
2. total_fwd_packets
3. total_bwd_packets
4. total_fwd_bytes
5. total_bwd_bytes
6. avg_fwd_pkt_len
7. avg_bwd_pkt_len
8. std_fwd_iat
9. mean_fwd_iat
10. pkt_rate
11. byte_rate
12. fwd_iat_total
13. min_pkt_size
14. tcp_flag_count_SYN

IMPORTANT:
----------
The list is manually duplicated here.

It is NOT loaded from features.json.

This creates a potential feature-schema synchronization problem.

FUNCTION: switch_features_handler()
------------------------------------
Triggered when a switch connects to the controller.

Input:

    EventOFPSwitchFeatures

The function receives the connected switch's datapath.

Process:

1. Obtain the switch's OpenFlow protocol object.
2. Obtain the OpenFlow parser.
3. Create an empty OFPMatch.
4. Create an action that sends unmatched packets to the controller.
5. Install the rule using add_flow().
6. Log the switch connection.

The installed table-miss rule effectively causes packets without a matching
switch rule to generate PacketIn events to the controller.

OUTPUT:
-------
An OpenFlow table-miss rule is installed on the switch.

FUNCTION: add_flow()
--------------------
A helper function used to construct and send an OpenFlow FlowMod message.

Inputs:

    datapath
    priority
    match
    actions
    buffer_id (optional)

Process:

1. Obtain OpenFlow protocol information.
2. Obtain the OpenFlow parser.
3. Create an APPLY_ACTIONS instruction.
4. Create an OFPFlowMod.
5. Send the FlowMod to the switch.

Output:

    OpenFlow flow rule installed on the switch.

FUNCTION: _packet_in_handler()
------------------------------
Triggered whenever the Ryu controller receives:

    EventOFPPacketIn

This is the primary runtime traffic-processing function.

INPUT
-----
OpenFlow PacketIn event containing:

- switch datapath
- incoming port
- packet bytes
- OpenFlow metadata

PROCESS
-------
1. Check whether the model loaded successfully.

2. Extract the PacketIn message and switch information.

3. Parse the packet using Ryu's packet parser.

4. Extract the Ethernet header.

5. Ignore IPv6 traffic.

6. Extract the IPv4 header.

7. Generate a placeholder 14-feature tensor:

       torch.randn(1, 1, 14)

8. Measure inference time.

9. Run the TorchScript model.

10. Select the class with maximum output logit.

11. Convert the numeric prediction into a traffic-class label.

12. Log the predicted flow and inference latency.

13. Construct the enforcement action.

14. Drop traffic if the predicted class is DDoS.

15. Otherwise flood/forward the traffic.

16. Install an IPv4 source/destination flow rule.

17. Forward the current packet.

MODEL INPUT
-----------
Current implementation:

    (1, 1, 14)

This matches the Tiny1DCNN's deployment input shape.

IMPORTANT:
----------
The values are random.

They are NOT extracted from the packet.

Therefore the model prediction is not a genuine classification of the
observed network flow.

MODEL OUTPUT
------------
The model output is expected to contain seven class logits.

The predicted class is:

    argmax(output, dim=1)

CLASS MAPPING
-------------
The current hardcoded mapping is:

    0 → BENIGN
    1 → Bot
    2 → DDoS
    3 → DoS
    4 → FTP
    5 → PortScan
    6 → BruteForce

This mapping is duplicated inside the SDN application rather than being
loaded from a shared configuration/metadata file.

INFERENCE LATENCY
-----------------
The application measures inference time using:

    time.time()

and converts the duration to milliseconds.

The result is logged as:

    [AI INFERENCE] ... Time: Xms

This is an operational measurement for the individual inference call.

It is NOT automatically equivalent to the paper's formal latency benchmark.

ENFORCEMENT LOGIC
-----------------
Default action:

    OFPP_FLOOD

If the prediction is:

    DDoS

the action list becomes empty:

    actions = []

In OpenFlow this represents dropping the packet because no output action is
specified.

The application also logs:

    BLOCKING DDoS FLOW

FLOW RULE INSTALLATION
----------------------
After classification, the application installs a rule matching:

    Ethernet type = IPv4
    IPv4 source = packet source
    IPv4 destination = packet destination

with priority:

    10

The selected actions are attached to this rule.

This is intended to prevent the same traffic from reaching the controller
again for every packet.

IMPORTANT SCALABILITY ISSUE
---------------------------
The current rule is based on:

    source IP + destination IP

and is installed reactively for each observed flow.

Under large-scale traffic or spoofed-source attacks, this strategy can create
many flow entries and increase switch TCAM consumption.

This is particularly important because the project's .clinerules and
blueprint identify scalable aggregation and TCAM conservation as major
architectural requirements.

CURRENT IMPLEMENTATION VS INTENDED ARCHITECTURE
-----------------------------------------------
The intended Nano-Stream architecture describes:

    real flow feature extraction
    concept-drift adaptation
    scalable aggregation
    QoS enforcement

The current nano_guard.py implementation actually provides:

    Ryu/OpenFlow integration
    packet parsing
    placeholder feature input
    model inference
    DDoS drop example
    reactive flow-rule installation

It does NOT currently implement:

    real flow-state feature extraction
    replay-buffer adaptation
    oracle labeling
    online fine-tuning
    drift detection
    CIDR aggregation
    Bloom-union synthesis
    derivative-based phase detection
    complete QoS policy enforcement

Therefore this file should be described as a PROTOTYPE SDN INTEGRATION rather
than a complete production implementation of the full Nano-Stream architecture.

EXECUTION ORDER
---------------
This component depends on the model deployment artifact.

Intended order:

    1. Prepare/train model
           ↓
    2. Produce quantized TorchScript model
           ↓
    3. Place deployment artifact under checkpoints/
           ↓
    4. Start Ryu with nano_guard.py
           ↓
    5. Connect an OpenFlow 1.3 switch
           ↓
    6. Receive PacketIn events
           ↓
    7. Run model inference
           ↓
    8. Install enforcement rule

CURRENT REPOSITORY BLOCKER
--------------------------
The code expects:

    checkpoints/quantized.pt

but the repository currently contains:

    checkpoints/cnn_quantized.pt

Therefore the application cannot reliably load the intended model without
resolving this filename mismatch.

CHECK 2 STATUS
--------------
Source inspection:

    PASS

Model interface:

    Input shape expected:
        (1, 1, 14)

Packet parsing path:

    Present

OpenFlow 1.3 configuration:

    Present

Table-miss installation:

    Present

Reactive flow installation:

    Present

Real feature extraction:

    NOT IMPLEMENTED

Concept-drift adaptation:

    NOT IMPLEMENTED

Full QoS policy engine:

    NOT IMPLEMENTED

Quantized model loading:

    BLOCKED by checkpoint filename mismatch in the current repository.

IMPORTANT FINDINGS
------------------
1. Model input is random rather than extracted from network traffic.

2. The expected checkpoint filename does not match the repository.

3. Feature names are duplicated instead of loaded from features.json.

4. Class labels are hardcoded instead of loaded from shared metadata.

5. IPv6 traffic is currently ignored.

6. DDoS is the only explicitly implemented classification-based mitigation.

7. Non-DDoS traffic is flooded.

8. Reactive per-source/destination rules may create scalability/TCAM issues.

9. No flow-state tracking exists.

10. No replay-buffer/oracle/fine-tuning implementation exists here.

11. The implementation is therefore an SDN inference prototype, not the
    complete adaptive Nano-Stream control plane described by the architecture.

V1 ACTION
---------
KEEP for historical/research reproducibility.

Do not rewrite the implementation during the documentation phase.

The confirmed issues should be addressed later during the optimization/V2
phase after the published paper has been audited against the actual code.

===============================================================================
"""

# ryu_app/nano_guard.py
import logging
import torch
import time
import numpy as np
from ryu.base import app_manager
from ryu.controller import ofp_event
from ryu.controller.handler import CONFIG_DISPATCHER, MAIN_DISPATCHER, set_ev_cls
from ryu.ofproto import ofproto_v1_3
from ryu.lib.packet import packet, ethernet, ipv4, tcp, udp

class NanoGuard(app_manager.RyuApp):
    OFP_VERSIONS = [ofproto_v1_3.OFP_VERSION]

    def __init__(self, *args, **kwargs):
        super(NanoGuard, self).__init__(*args, **kwargs)
        # Load the Quantized Model
        try:
            # NOTE: Path must be absolute in the VM, or relative to where you run ryu-manager
            self.model = torch.jit.load("checkpoints/quantized.pt", map_location='cpu')
            self.model.eval()
            self.logger.info("[NanoGuard] Quantized Model Loaded Successfully!")
        except Exception as e:
            self.logger.error(f"[NanoGuard] FAILED to load model: {e}")
            self.model = None

        # Feature Mapping (Must match features.json order)
        # In a real app, we extract these. For the demo, we use placeholders if raw packet extraction is complex.
        self.features = [
            "flow_duration", "total_fwd_packets", "total_bwd_packets", 
            "total_fwd_bytes", "total_bwd_bytes", "avg_fwd_pkt_len", 
            "avg_bwd_pkt_len", "std_fwd_iat", "mean_fwd_iat", "pkt_rate", 
            "byte_rate", "fwd_iat_total", "min_pkt_size", "tcp_flag_count_SYN"
        ]

    @set_ev_cls(ofp_event.EventOFPSwitchFeatures, CONFIG_DISPATCHER)
    def switch_features_handler(self, ev):
        datapath = ev.msg.datapath
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser
        
        # Install Table-Miss Flow Entry (Send unknown packets to Controller)
        match = parser.OFPMatch()
        actions = [parser.OFPActionOutput(ofproto.OFPP_CONTROLLER, ofproto.OFPCML_NO_BUFFER)]
        self.add_flow(datapath, 0, match, actions)
        self.logger.info(f"Switch {datapath.id} Connected. Default rule installed.")

    def add_flow(self, datapath, priority, match, actions, buffer_id=None):
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser
        inst = [parser.OFPInstructionActions(ofproto.OFPIT_APPLY_ACTIONS, actions)]
        mod = parser.OFPFlowMod(datapath=datapath, priority=priority, match=match, instructions=inst)
        datapath.send_msg(mod)

    @set_ev_cls(ofp_event.EventOFPPacketIn, MAIN_DISPATCHER)
    def _packet_in_handler(self, ev):
        if self.model is None: return

        msg = ev.msg
        datapath = msg.datapath
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser
        in_port = msg.match['in_port']

        pkt = packet.Packet(msg.data)
        eth = pkt.get_protocols(ethernet.ethernet)[0]

        if eth.ethertype == 34525: # IPv6 (Ignore for now)
            return

        # 1. Extract IP Info
        ip_pkt = pkt.get_protocol(ipv4.ipv4)
        if ip_pkt is None: return

        # 2. Inference Step (Simulated Feature Extraction)
        # In a real demo, we would calculate 'total_fwd_bytes' from the packet history.
        # Here, we generate a random valid input to prove the AI pipeline works in Ryu.
        input_tensor = torch.randn(1, 1, 14) 
        
        start_time = time.time()
        with torch.no_grad():
            output = self.model(input_tensor)
            prediction = output.argmax(dim=1).item()
        latency = (time.time() - start_time) * 1000

        # Map Prediction to Action
        # 0=BENIGN, 1=Bot, 2=DDoS, etc.
        labels = ["BENIGN", "Bot", "DDoS", "DoS", "FTP", "PortScan", "BruteForce"]
        result = labels[prediction] if prediction < len(labels) else "Unknown"

        self.logger.info(f"[AI INFERENCE] Flow: {ip_pkt.src}->{ip_pkt.dst} | Class: {result} | Time: {latency:.3f}ms")

        # 3. Take Action (QoS)
        actions = [parser.OFPActionOutput(ofproto.OFPP_FLOOD)]
        
        # Example: Drop DDoS packets
        if result == "DDoS":
            actions = [] # Empty actions = Drop
            self.logger.warning(f"!!! BLOCKING DDoS FLOW: {ip_pkt.src} !!!")
        
        # Install rule to avoid asking controller again for this flow
        match = parser.OFPMatch(eth_type=0x0800, ipv4_src=ip_pkt.src, ipv4_dst=ip_pkt.dst)
        self.add_flow(datapath, 10, match, actions)
        
        # Forward the current packet
        data = None
        if msg.buffer_id == ofproto.OFP_NO_BUFFER:
            data = msg.data
        out = parser.OFPPacketOut(datapath=datapath, buffer_id=msg.buffer_id,
                                  in_port=in_port, actions=actions, data=data)
        datapath.send_msg(out)
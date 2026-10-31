"""
===============================================================================
FILE: ryu_app/nano_guard.py
===============================================================================

PURPOSE
-------
Implements the IntentQoS SDN control and telemetry application using the Ryu
SDN controller framework and OpenFlow 1.3.

Observes packet header metadata from OpenFlow PacketIn events, feeds packets
into the stateful FlowExtractor over the early-flow observation window, evaluates
the canonical 14-feature vector using the quantized Tiny1DCNN residential model
via ModelLoader, and installs OpenFlow 1.3 QoS queue and meter rules based on
traffic classification and user intent.

ROLE IN NANOSTREAM
------------------
This file represents the OPENFLOW SDN CONTROL & QOS ENFORCEMENT PLANE.

It connects:

    OpenFlow 1.3 Switch (Mininet / Hardware OVS)
                 ↓
      PacketIn Events (Header metadata only)
                 ↓
     Stateful FlowExtractor (First 32 packets)
                 ↓
     ModelLoader (INT8 Tiny1DCNN Home Taxonomy)
                 ↓
     Confidence Gating (tau = 0.65 -> UNKNOWN if uncertain)
                 ↓
     OpenFlow 1.3 Queue / Meter QoS Rule Installation

RESIDENTIAL BROADBAND TAXONOMY
------------------------------
1. VIDEO_CALL               (Queue 1 - Low Latency, Prioritized)
2. GAMING                   (Queue 2 - Ultra-Low Latency, Expedited)
3. VIDEO_STREAMING          (Queue 3 - Sustained High Throughput)
4. INTERACTIVE_WEB_OTHER    (Queue 4 - Best Effort Interactive)
5. BULK_TRANSFER            (Queue 5 - Elastic / Shaped)
6. BACKGROUND_UPDATE_BACKUP (Queue 5 - Low Priority / Scavenger)
7. UNKNOWN                  (Queue 4 - Safe Best Effort Default)

SAFETY & PRIVACY INVARIANTS
---------------------------
1. Privacy-Preserving: Only packet header fields (IP, protocol, ports, length)
   are inspected; packet payloads are NEVER parsed, stored, or retained.
2. Safe Model Fallback: Unknown or low-confidence flows receive safe default
   best-effort forwarding without starvation.
3. Bounded Flow State: Leverages FlowExtractor maximum active flow limits and
   idle timeout to prevent controller memory exhaustion.
4. Graceful Import: Allows running in environments where Ryu is optional.

DEPENDENCIES
------------
PyTorch, Ryu (optional in host env), telemetry.flow_extractor, models.model_loader.

===============================================================================
"""

import logging
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

# Add parent directory to path for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.model_loader import ModelLoader
from telemetry.flow_extractor import FlowExtractor

logger = logging.getLogger("intentqos.ryu")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# Graceful Ryu import handling for diverse environments
try:
    from ryu.base import app_manager
    from ryu.controller import ofp_event
    from ryu.controller.handler import CONFIG_DISPATCHER, MAIN_DISPATCHER, set_ev_cls
    from ryu.lib.packet import ethernet, ipv4, ipv6, packet, tcp, udp, icmp
    from ryu.ofproto import ofproto_v1_3
    RYU_AVAILABLE = True
    BaseApp = app_manager.RyuApp
except ImportError:
    RYU_AVAILABLE = False
    class BaseApp:
        """Fallback base class when Ryu is not installed in the environment."""
        def __init__(self, *args, **kwargs):
            self.logger = logger

    def set_ev_cls(ev, dispatcher):
        def decorator(func):
            return func
        return decorator

    class _DummyModule:
        pass

    class _DummyEvent:
        EventOFPSwitchFeatures = "EventOFPSwitchFeatures"
        EventOFPPacketIn = "EventOFPPacketIn"

    ofp_event = _DummyEvent()
    ofproto_v1_3 = _DummyModule()
    ofproto_v1_3.OFP_VERSION = 4
    CONFIG_DISPATCHER = "config"
    MAIN_DISPATCHER = "main"


# Canonical 7-Class Residential Taxonomy
RESIDENTIAL_TAXONOMY = [
    "VIDEO_CALL",
    "GAMING",
    "VIDEO_STREAMING",
    "BULK_TRANSFER",
    "BACKGROUND_UPDATE_BACKUP",
    "INTERACTIVE_WEB_OTHER",
    "UNKNOWN",
]

# QoS Queue Mapping (Queue IDs configured on OpenFlow switch ports)
CLASS_TO_QUEUE_ID = {
    "VIDEO_CALL": 1,
    "GAMING": 2,
    "VIDEO_STREAMING": 3,
    "INTERACTIVE_WEB_OTHER": 4,
    "BULK_TRANSFER": 5,
    "BACKGROUND_UPDATE_BACKUP": 5,
    "UNKNOWN": 4,
}


class NanoGuard(BaseApp):
    """
    IntentQoS OpenFlow 1.3 controller application for residential QoS.
    """
    OFP_VERSIONS = [ofproto_v1_3.OFP_VERSION]

    def __init__(self, *args, **kwargs):
        super(NanoGuard, self).__init__(*args, **kwargs)
        self.logger = logger

        # 1. Initialize Flow Extractor
        self.flow_extractor = FlowExtractor(
            max_active_flows=5000,
            idle_timeout_sec=30.0,
            early_window_packets=32,
        )

        # 2. Locate and load model via safe ModelLoader
        model_candidate = os.path.join(os.path.dirname(__file__), "..", "checkpoints", "home_cnn_quantized.pt")
        if not os.path.exists(model_candidate):
            model_candidate = os.path.join(os.path.dirname(__file__), "..", "checkpoints", "cnn_quantized.pt")
        schema_path = os.path.join(os.path.dirname(__file__), "..", "docs", "data", "schema_manifest.json")

        self.model_loader = ModelLoader(
            model_path=model_candidate if os.path.exists(model_candidate) else None,
            schema_manifest_path=schema_path if os.path.exists(schema_path) else None,
            confidence_threshold=0.65,
        )

        self.logger.info(
            "[NanoGuard] Initialized with residential model: %s (Status: %s)",
            os.path.basename(model_candidate),
            self.model_loader.status,
        )

        # 3. Cache switch ports
        self.mac_to_port: Dict[int, Dict[str, int]] = {}

    @set_ev_cls(ofp_event.EventOFPSwitchFeatures, CONFIG_DISPATCHER)
    def switch_features_handler(self, ev):
        """
        Install table-miss flow entry to send unclassified packets to controller.
        """
        datapath = ev.msg.datapath
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser

        # Table-miss rule: send to controller
        match = parser.OFPMatch()
        actions = [parser.OFPActionOutput(ofproto.OFPP_CONTROLLER, ofproto.OFPCML_NO_BUFFER)]
        self.add_flow(datapath, priority=0, match=match, actions=actions)
        self.logger.info("[NanoGuard] Switch %s connected. Table-miss entry installed.", datapath.id)

    def add_flow(
        self,
        datapath,
        priority: int,
        match: Any,
        actions: List[Any],
        buffer_id: Optional[int] = None,
        idle_timeout: int = 60,
        hard_timeout: int = 300,
    ):
        """
        Helper to construct and install an OpenFlow 1.3 flow rule.
        """
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser
        inst = [parser.OFPInstructionActions(ofproto.OFPIT_APPLY_ACTIONS, actions)]
        if buffer_id:
            mod = parser.OFPFlowMod(
                datapath=datapath,
                buffer_id=buffer_id,
                priority=priority,
                match=match,
                instructions=inst,
                idle_timeout=idle_timeout,
                hard_timeout=hard_timeout,
            )
        else:
            mod = parser.OFPFlowMod(
                datapath=datapath,
                priority=priority,
                match=match,
                instructions=inst,
                idle_timeout=idle_timeout,
                hard_timeout=hard_timeout,
            )
        datapath.send_msg(mod)

    @set_ev_cls(ofp_event.EventOFPPacketIn, MAIN_DISPATCHER)
    def _packet_in_handler(self, ev):
        """
        Handle OpenFlow PacketIn: extract header metadata, update flow state,
        run residential early-flow model, and install QoS queue action.
        """
        msg = ev.msg
        datapath = msg.datapath
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser
        in_port = msg.match['in_port']

        # Parse packet headers
        pkt = packet.Packet(msg.data)
        eth = pkt.get_protocols(ethernet.ethernet)[0]

        # Ignore LLDP/STP control traffic
        if eth.ethertype == 0x88CC or eth.ethertype == 0x8942:
            return

        dpid = datapath.id
        self.mac_to_port.setdefault(dpid, {})
        self.mac_to_port[dpid][eth.src] = in_port

        out_port = self.mac_to_port[dpid].get(eth.dst, ofproto.OFPP_FLOOD)

        # Extract L3 / L4 metadata
        now = time.time()
        ip_version = "IPv4"
        protocol = "OTHER"
        src_ip = "0.0.0.0"
        dst_ip = "0.0.0.0"
        src_port = 0
        dst_port = 0
        tcp_flags = 0

        ip4_pkt = pkt.get_protocol(ipv4.ipv4)
        ip6_pkt = pkt.get_protocol(ipv6.ipv6)

        if ip4_pkt:
            ip_version = "IPv4"
            src_ip = ip4_pkt.src
            dst_ip = ip4_pkt.dst
            if ip4_pkt.proto == 6:
                protocol = "TCP"
                tcp_pkt = pkt.get_protocol(tcp.tcp)
                if tcp_pkt:
                    src_port = tcp_pkt.src_port
                    dst_port = tcp_pkt.dst_port
                    tcp_flags = tcp_pkt.bits
            elif ip4_pkt.proto == 17:
                protocol = "UDP"
                udp_pkt = pkt.get_protocol(udp.udp)
                if udp_pkt:
                    src_port = udp_pkt.src_port
                    dst_port = udp_pkt.dst_port
            elif ip4_pkt.proto == 1:
                protocol = "ICMP"
        elif ip6_pkt:
            ip_version = "IPv6"
            src_ip = ip6_pkt.src
            dst_ip = ip6_pkt.dst
            if ip6_pkt.nxt == 6:
                protocol = "TCP"
                tcp_pkt = pkt.get_protocol(tcp.tcp)
                if tcp_pkt:
                    src_port = tcp_pkt.src_port
                    dst_port = tcp_pkt.dst_port
                    tcp_flags = tcp_pkt.bits
            elif ip6_pkt.nxt == 17:
                protocol = "UDP"
                udp_pkt = pkt.get_protocol(udp.udp)
                if udp_pkt:
                    src_port = udp_pkt.src_port
                    dst_port = udp_pkt.dst_port
        else:
            # Non-IP packet (e.g. ARP) -> flood directly
            actions = [parser.OFPActionOutput(out_port)]
            data = msg.data if msg.buffer_id == ofproto.OFP_NO_BUFFER else None
            out = parser.OFPPacketOut(
                datapath=datapath, buffer_id=msg.buffer_id, in_port=in_port, actions=actions, data=data
            )
            datapath.send_msg(out)
            return

        # Process packet through FlowExtractor (NO payload bytes passed)
        pkt_len = len(msg.data)
        flow_record = self.flow_extractor.process_packet(
            ip_version=ip_version,
            protocol=protocol,
            src_ip=src_ip,
            dst_ip=dst_ip,
            src_port=src_port,
            dst_port=dst_port,
            length_bytes=pkt_len,
            timestamp=now,
            tcp_flags=tcp_flags,
        )

        if flow_record is None:
            return

        # Early-flow residential classification
        features = self.flow_extractor.extract_features(flow_record)
        pred = self.model_loader.predict(
            features,
            dest_port=dst_port,
            protocol=protocol,
        )

        flow_record.predicted_class = pred["predictedClass"]
        flow_record.confidence = pred["confidence"]
        flow_record.is_low_confidence = pred["isLowConfidence"]

        queue_id = CLASS_TO_QUEUE_ID.get(flow_record.predicted_class, 4)

        self.logger.info(
            "[NanoGuard] %s %s:%d -> %s:%d | Class: %s (conf: %.2f) -> Queue %d",
            protocol,
            src_ip,
            src_port,
            dst_ip,
            dst_port,
            flow_record.predicted_class,
            flow_record.confidence,
            queue_id,
        )

        # OpenFlow 1.3 QoS Enforcement Actions:
        # Set Queue ID action followed by output to destination port
        actions = [
            parser.OFPActionSetQueue(queue_id),
            parser.OFPActionOutput(out_port),
        ]

        # Install flow rule if destination port is known to reduce controller load
        if out_port != ofproto.OFPP_FLOOD:
            if ip_version == "IPv4":
                match = parser.OFPMatch(
                    eth_type=0x0800,
                    ipv4_src=src_ip,
                    ipv4_dst=dst_ip,
                    ip_proto=6 if protocol == "TCP" else (17 if protocol == "UDP" else 1),
                )
            else:
                match = parser.OFPMatch(
                    eth_type=0x86DD,
                    ipv6_src=src_ip,
                    ipv6_dst=dst_ip,
                )

            # Higher priority for interactive classes
            flow_prio = 20 if flow_record.predicted_class in ("VIDEO_CALL", "GAMING") else 10
            self.add_flow(
                datapath,
                priority=flow_prio,
                match=match,
                actions=actions,
                buffer_id=msg.buffer_id,
                idle_timeout=45,
            )

        # Send current packet out
        data = None
        if msg.buffer_id == ofproto.OFP_NO_BUFFER:
            data = msg.data
        out = parser.OFPPacketOut(
            datapath=datapath,
            buffer_id=msg.buffer_id,
            in_port=in_port,
            actions=actions,
            data=data,
        )
        datapath.send_msg(out)


if __name__ == "__main__":
    # Standalone smoke test verifying flow extraction and classification integration
    print("Testing NanoGuard residential classification and flow extractor integration...")
    app = NanoGuard()
    print("NanoGuard successfully initialized. Model status:", app.model_loader.status)
    print("Testing sample residential traffic flow...")

    # Video call simulation
    now = time.time()
    for i in range(16):
        flow = app.flow_extractor.process_packet(
            ip_version="IPv4",
            protocol="UDP",
            src_ip="192.168.1.100",
            dst_ip="203.0.113.5",
            src_port=50004,
            dst_port=50004,
            length_bytes=650,
            timestamp=now + i * 0.02,
        )

    feats = app.flow_extractor.extract_features(flow)
    pred = app.model_loader.predict(feats, dest_port=50004, protocol="UDP")
    print(f"Flow prediction: {pred['predictedClass']} (confidence: {pred['confidence']:.2f})")
    assert pred["predictedClass"] in RESIDENTIAL_TAXONOMY
    print("NanoGuard smoke test PASSED!")

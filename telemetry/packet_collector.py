"""
===============================================================================
FILE: telemetry/packet_collector.py
===============================================================================

PURPOSE
-------
Lightweight, privacy-preserving live packet metadata collector that captures
packet headers from a Linux network interface (or socket/PCAP source), parses
network and transport headers (IPv4, IPv6, TCP, UDP, ICMP), and dispatches
flow observations into the stateful FlowExtractor without inspecting or
persisting application payload bytes.

ROLE IN NANOSTREAM
------------------
This is the REAL TELEMETRY INGESTION LAYER.

It connects:

    Linux Network Interface (e.g. eth0, veth_wan, wlan0)
                 ↓
    Raw Packet Header Capture (AF_PACKET / Bounded Socket)
                 ↓
    Zero-Payload Header Parsing (Ethernet / IP / Transport)
                 ↓
    Bounded Ingestion Queue (Backpressure protection)
                 ↓
    FlowExtractor.process_packet()
                 ↓
    IntentQoS Policy Engine / REST API

SAFETY & PRIVACY INVARIANTS
---------------------------
1. Strict Privacy-by-Default: ONLY headers (timestamps, IP addresses, ports,
   packet lengths, TCP flags) are extracted; payload bytes are DISCARDED
   immediately and never stored, logged, or serialized.
2. Memory Safety & Backpressure: The ingestion queue has a hard maximum size
   (default: 5,000 packets); excess packets under contention are counted as
   dropped rather than causing unbounded memory growth.
3. Non-Root Graceful Degradation: If raw socket access (CAP_NET_RAW / root)
   is unavailable, the collector safely reports status DEGRADED or SIMULATED
   without crashing the runtime.
4. Clean Teardown: Threaded background worker stops cleanly on shutdown.

DEPENDENCIES
------------
Python standard library (socket, struct, threading, queue, time, dataclasses, typing).

===============================================================================
"""

from dataclasses import dataclass, field
import logging
import os
import socket
import struct
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from telemetry.flow_extractor import FlowExtractor

logger = logging.getLogger("intentqos.telemetry.collector")


@dataclass
class PacketMetadata:
    """Captured header metadata for a single packet (no payload bytes)."""
    timestamp: float
    ip_version: str  # 'IPv4' | 'IPv6'
    protocol: str    # 'TCP' | 'UDP' | 'ICMP' | 'OTHER'
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    length_bytes: int
    tcp_flags: int = 0


@dataclass
class CollectorHealth:
    """Operational health snapshot of the packet collector."""
    state: str  # 'RUNNING' | 'STOPPED' | 'DEGRADED' | 'NOT_CONNECTED'
    interface: str
    packets_captured: int
    bytes_captured: int
    packets_dropped: int
    queue_backlog: int
    last_packet_timestamp: Optional[float]
    error_message: Optional[str] = None
    provenance: str = "MEASURED_LIVE"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "state": self.state,
            "interface": self.interface,
            "packetsCaptured": self.packets_captured,
            "bytesCaptured": self.bytes_captured,
            "packetsDropped": self.packets_dropped,
            "queueBacklog": self.queue_backlog,
            "lastPacketTimestamp": self.last_packet_timestamp,
            "errorMessage": self.error_message,
            "provenance": self.provenance,
        }


class PacketMetadataCollector:
    """
    High-performance, privacy-conscious packet metadata capture worker.
    """
    def __init__(
        self,
        interface: str = "eth0",
        flow_extractor: Optional[FlowExtractor] = None,
        max_queue_size: int = 5000,
        enable_promiscuous: bool = False,
    ):
        self.interface = interface
        self.flow_extractor = flow_extractor or FlowExtractor()
        self.max_queue_size = max_queue_size
        self.enable_promiscuous = enable_promiscuous

        self._queue: List[PacketMetadata] = []
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None

        self.packets_captured = 0
        self.bytes_captured = 0
        self.packets_dropped = 0
        self.last_packet_timestamp: Optional[float] = None
        self.last_error: Optional[str] = None
        self.is_privileged = False

    def get_health(self) -> CollectorHealth:
        """Return component health probe snapshot."""
        state = "RUNNING" if self._running else "STOPPED"
        if self.last_error and not self._running:
            state = "DEGRADED"

        return CollectorHealth(
            state=state,
            interface=self.interface,
            packets_captured=self.packets_captured,
            bytes_captured=self.bytes_captured,
            packets_dropped=self.packets_dropped,
            queue_backlog=len(self._queue),
            last_packet_timestamp=self.last_packet_timestamp,
            error_message=self.last_error,
        )

    def parse_raw_ethernet_frame(self, raw_data: bytes, capture_time: float) -> Optional[PacketMetadata]:
        """
        Parse raw Ethernet frame, extract IP and transport headers, and return PacketMetadata.
        Payload bytes are discarded immediately.
        """
        if len(raw_data) < 14:
            return None

        # Ethernet header: Dest MAC (6), Src MAC (6), EtherType (2)
        eth_type = struct.unpack("!H", raw_data[12:14])[0]
        offset = 14

        # IPv4 Frame (0x0800)
        if eth_type == 0x0800:
            if len(raw_data) < offset + 20:
                return None
            iph = raw_data[offset:offset + 20]
            v_ihl = iph[0]
            ihl = (v_ihl & 0x0F) * 4
            total_len = struct.unpack("!H", iph[2:4])[0]
            proto_num = iph[9]
            src_ip = socket.inet_ntoa(iph[12:16])
            dst_ip = socket.inet_ntoa(iph[16:20])
            trans_offset = offset + ihl

            proto = "OTHER"
            src_port = 0
            dst_port = 0
            tcp_flags = 0

            if proto_num == 6:  # TCP
                proto = "TCP"
                if len(raw_data) >= trans_offset + 14:
                    tcph = raw_data[trans_offset:trans_offset + 14]
                    src_port, dst_port = struct.unpack("!HH", tcph[0:4])
                    tcp_flags = tcph[13]
            elif proto_num == 17:  # UDP
                proto = "UDP"
                if len(raw_data) >= trans_offset + 4:
                    udph = raw_data[trans_offset:trans_offset + 4]
                    src_port, dst_port = struct.unpack("!HH", udph[0:4])
            elif proto_num == 1:  # ICMP
                proto = "ICMP"

            return PacketMetadata(
                timestamp=capture_time,
                ip_version="IPv4",
                protocol=proto,
                src_ip=src_ip,
                dst_ip=dst_ip,
                src_port=src_port,
                dst_port=dst_port,
                length_bytes=total_len if total_len > 0 else len(raw_data),
                tcp_flags=tcp_flags,
            )

        # IPv6 Frame (0x86DD)
        elif eth_type == 0x86DD:
            if len(raw_data) < offset + 40:
                return None
            ip6h = raw_data[offset:offset + 40]
            payload_len = struct.unpack("!H", ip6h[4:6])[0]
            next_header = ip6h[6]
            src_ip = socket.inet_ntop(socket.AF_INET6, ip6h[8:24])
            dst_ip = socket.inet_ntop(socket.AF_INET6, ip6h[24:40])
            trans_offset = offset + 40

            proto = "OTHER"
            src_port = 0
            dst_port = 0
            tcp_flags = 0

            if next_header == 6:  # TCP
                proto = "TCP"
                if len(raw_data) >= trans_offset + 14:
                    tcph = raw_data[trans_offset:trans_offset + 14]
                    src_port, dst_port = struct.unpack("!HH", tcph[0:4])
                    tcp_flags = tcph[13]
            elif next_header == 17:  # UDP
                proto = "UDP"
                if len(raw_data) >= trans_offset + 4:
                    udph = raw_data[trans_offset:trans_offset + 4]
                    src_port, dst_port = struct.unpack("!HH", udph[0:4])
            elif next_header == 58:  # ICMPv6
                proto = "ICMP"

            return PacketMetadata(
                timestamp=capture_time,
                ip_version="IPv6",
                protocol=proto,
                src_ip=src_ip,
                dst_ip=dst_ip,
                src_port=src_port,
                dst_port=dst_port,
                length_bytes=payload_len + 40,
                tcp_flags=tcp_flags,
            )

        return None

    def ingest_metadata(self, meta: PacketMetadata):
        """
        Enqueue parsed metadata with backpressure and forward to FlowExtractor.
        """
        with self._lock:
            if len(self._queue) >= self.max_queue_size:
                self.packets_dropped += 1
                return

            self._queue.append(meta)
            self.packets_captured += 1
            self.bytes_captured += meta.length_bytes
            self.last_packet_timestamp = meta.timestamp

        # Dispatch to stateful FlowExtractor
        self.flow_extractor.process_packet(
            ip_version=meta.ip_version,
            protocol=meta.protocol,
            src_ip=meta.src_ip,
            dst_ip=meta.dst_ip,
            src_port=meta.src_port,
            dst_port=meta.dst_port,
            length_bytes=meta.length_bytes,
            timestamp=meta.timestamp,
            tcp_flags=meta.tcp_flags,
        )

    def start_capture(self) -> bool:
        """
        Start capture loop in background daemon thread.
        Returns True if socket bound successfully, False if unprivileged.
        """
        if self._running:
            return True

        # Check raw socket privileges
        sock = None
        try:
            # Try AF_PACKET raw socket on Linux
            if hasattr(socket, "AF_PACKET"):
                sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0003))  # ETH_P_ALL
                sock.bind((self.interface, 0))
                sock.settimeout(0.5)
                self.is_privileged = True
            else:
                self.last_error = "AF_PACKET not supported on non-Linux platform"
                return False
        except PermissionError:
            self.is_privileged = False
            self.last_error = f"Raw socket permission denied on {self.interface} (requires CAP_NET_RAW / root)"
            logger.warning("[PacketCollector] %s", self.last_error)
            return False
        except Exception as e:
            self.last_error = f"Failed to bind socket on {self.interface}: {e}"
            logger.warning("[PacketCollector] %s", self.last_error)
            if sock:
                sock.close()
            return False

        self._running = True
        self.last_error = None

        def _worker():
            logger.info("[PacketCollector] Started live capture on %s", self.interface)
            while self._running:
                try:
                    raw_data, _ = sock.recvfrom(2048)
                    now = time.time()
                    meta = self.parse_raw_ethernet_frame(raw_data, capture_time=now)
                    if meta:
                        self.ingest_metadata(meta)
                except socket.timeout:
                    continue
                except Exception as e:
                    if self._running:
                        logger.error("[PacketCollector] Read error: %s", e)
                        self.last_error = str(e)
                    break
            sock.close()
            logger.info("[PacketCollector] Stopped capture on %s", self.interface)

        self._thread = threading.Thread(target=_worker, daemon=True, name="PacketCollectorThread")
        self._thread.start()
        return True

    def stop_capture(self):
        """Stop background capture thread gracefully."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        self._thread = None

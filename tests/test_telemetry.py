"""
===============================================================================
FILE: tests/test_telemetry.py
===============================================================================

PURPOSE
-------
Unit tests verifying stateful flow extraction, bidirectional association,
packet statistics calculation over early-flow windows, capacity sampling,
EWMA filtering, and step-change adaptation.

===============================================================================
"""

import time
import pytest
from telemetry.flow_extractor import FlowExtractor
from telemetry.capacity_sampler import CapacitySampler


def test_flow_extractor_bidirectional_association():
    """Verify forward and backward packets are matched to the same flow state."""
    extractor = FlowExtractor(max_active_flows=100)
    t0 = time.time()

    # Forward packet
    extractor.process_packet("IPv4", "TCP", "10.0.0.1", "10.0.0.2", 45000, 443, 100, timestamp=t0)
    # Backward packet (reversed src/dst)
    extractor.process_packet("IPv4", "TCP", "10.0.0.2", "10.0.0.1", 443, 45000, 1400, timestamp=t0 + 0.01)

    assert len(extractor.flows) == 1
    flow = list(extractor.flows.values())[0]
    assert flow.total_fwd_packets == 1
    assert flow.total_bwd_packets == 1
    assert flow.total_fwd_bytes == 100
    assert flow.total_bwd_bytes == 1400

    features = extractor.extract_features(flow)
    assert len(features) == 14
    assert features[0] == 443.0  # destination port
    assert features[2] == 1.0    # fwd packets
    assert features[3] == 1.0    # bwd packets


def test_flow_extractor_idle_purge():
    """Verify idle flows are purged after timeout."""
    extractor = FlowExtractor(max_active_flows=50, idle_timeout_sec=0.1)
    t0 = time.time()
    extractor.process_packet("IPv4", "UDP", "10.0.0.1", "10.0.0.2", 5000, 5000, 200, timestamp=t0)
    assert len(extractor.flows) == 1

    time.sleep(0.15)
    purged = extractor.purge_idle_flows()
    assert purged == 1
    assert len(extractor.flows) == 0


def test_flow_extractor_malformed_packets():
    """Verify malformed/undersized packets are rejected without crashing."""
    extractor = FlowExtractor()
    bad_res = extractor.process_packet("IPv4", "UDP", "10.0.0.1", "10.0.0.2", 5000, 5000, length_bytes=5)
    assert bad_res is None
    assert extractor.malformed_packets_count == 1


def test_capacity_sampler_step_drop():
    """Verify capacity sampler detects abrupt capacity reduction (100 -> 20 Mbps)."""
    sampler = CapacitySampler(nominal_wan_mbps=100.0, cooldown_sec=0.05)
    cap1, _ = sampler.record_sample(100.0, 80.0, [15.0, 18.0])
    assert cap1.congestion_state == "NOMINAL"
    assert cap1.configured_shaping_mbps == 95.0  # 100 Mbps - 5% headroom

    time.sleep(0.06)
    # Abrupt drop to 20 Mbps
    cap2, _ = sampler.record_sample(20.0, 18.0, [60.0, 95.0, 140.0])
    assert cap2.congestion_state == "CAPACITY_DROP"
    assert cap2.configured_shaping_mbps == 19.0  # 20 Mbps - 5% headroom
    assert sampler.adaptation_count >= 1

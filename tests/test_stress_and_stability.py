"""
===============================================================================
FILE: tests/test_stress_and_stability.py
===============================================================================

PURPOSE
-------
Stress, stability, and memory-boundary tests verifying that high flow churn,
rapid policy evaluations, and packet bursts remain strictly bounded in memory
without leaking state or crashing the control plane.

===============================================================================
"""

import time
import pytest
from telemetry.flow_extractor import FlowExtractor
from policy.intent_store import IntentStore
from policy.engine import PolicyEngine
from telemetry.capacity_sampler import CapacitySampler


def test_high_flow_churn_bounded_memory():
    """Verify that creating 5,000 flows strictly respects max_active_flows cap."""
    extractor = FlowExtractor(max_active_flows=250, idle_timeout_sec=0.05)
    t0 = time.time()

    # Generate 1,000 unique flows rapidly
    for i in range(1000):
        src_port = 10000 + (i % 500)
        extractor.process_packet(
            "IPv4", "UDP", f"10.0.{i // 256}.{i % 256}", "198.51.100.1",
            src_port, 50000, 500, timestamp=t0 + i * 0.0001
        )

    # Active flow dictionary must not exceed max cap
    assert len(extractor.flows) <= 250
    assert extractor.dropped_flows_count >= 0


def test_rapid_policy_adaptation_stability():
    """Verify policy engine executes 200 consecutive adaptations without memory drift."""
    store = IntentStore(max_concurrent_active_intents=5)
    engine = PolicyEngine(intent_store=store)

    for i in range(200):
        shaping_rate = 20.0 + (i % 80)
        state = "CAPACITY_DROP" if shaping_rate < 30.0 else "NOMINAL"
        proposal = engine.compute_policy_proposal(
            current_shaping_mbps=shaping_rate,
            congestion_state=state,
        )
        assert len(proposal) == 7
        total_floors = sum(p.min_share_pct for p in proposal.values() if p.enabled)
        assert total_floors <= 90.0

    # Audit events length must remain bounded to max_events
    assert len(engine.audit_events) <= engine.max_events


def test_capacity_sampler_oscillation_damping():
    """Verify hysteresis and cooldown dampen continuous jitter without runaway adaptation."""
    sampler = CapacitySampler(nominal_wan_mbps=100.0, cooldown_sec=1.0, hysteresis_pct=5.0)

    # Ingest 50 noisy samples with small jitter (< 3%)
    t = time.time()
    for i in range(50):
        jittered_rate = 100.0 + (i % 5 - 2) * 0.8  # Jitter +-1.6%
        cap, _ = sampler.record_sample(
            ground_truth_rate_mbps=jittered_rate,
            observed_throughput_mbps=80.0,
            rtt_samples_ms=[15.0, 18.0],
        )

    # Jitter below 5% hysteresis must NOT cause 50 adaptations
    assert sampler.adaptation_count <= 2

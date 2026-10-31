"""
===============================================================================
FILE: tests/test_policy_and_intent.py
===============================================================================

PURPOSE
-------
Unit tests verifying temporary intent creation, server-owned expiration,
starvation protection, deterministic policy proposals, preview validation,
and safe baseline rollback.

===============================================================================
"""

import datetime
import pytest
from policy.intent_store import IntentStore
from policy.engine import PolicyEngine


def test_intent_store_lifecycle():
    """Verify intent creation, expiration check, and cancellation."""
    store = IntentStore(max_concurrent_active_intents=2)
    ok, intent, err = store.create_intent(
        name="Conference Call",
        traffic_class="Video Calls",
        duration_minutes=60,
        priority_tier=1,
    )
    assert ok is True
    assert intent is not None
    assert intent.status == "ACTIVE"
    assert intent.remaining_seconds() > 0

    # Cancel intent
    cancelled = store.cancel_intent(intent.id)
    assert cancelled is True
    assert intent.status == "EXPIRED"


def test_policy_engine_starvation_protection():
    """Verify total floors never exceed 90% and all classes maintain >= 5% floor."""
    store = IntentStore()
    engine = PolicyEngine(intent_store=store)

    proposal = engine.compute_policy_proposal(
        current_shaping_mbps=100.0,
        congestion_state="NOMINAL",
    )

    total_floors = sum(p.min_share_pct for p in proposal.values() if p.enabled)
    assert total_floors <= 90.0

    for pol in proposal.values():
        if pol.enabled:
            assert pol.min_share_pct >= 5.0, f"Class {pol.traffic_class} starved with floor < 5%"


def test_policy_engine_preview_and_apply():
    """Verify policy preview computes diffs without mutating state."""
    engine = PolicyEngine()
    initial_pols = engine.get_policies()

    preview = engine.preview_policy_change(
        proposed_policies={
            "pol-gaming": {"minSharePct": 25.0, "maxRateMbps": 80.0, "priorityTier": 1}
        },
        wan_capacity_mbps=100.0,
    )
    assert "previewId" in preview
    assert preview["constraintsChecked"]["fairnessGuard"] is True

    # Check state was not mutated by preview
    assert engine.current_policies["pol-gaming"].min_share_pct == 10.0

    # Apply change
    evt = engine.apply_policy(
        new_policies=engine.current_policies,
        reason="Test verified application",
    )
    assert evt.decision == "APPLY_ADAPTIVE_QOS"
    assert len(engine.get_events()) == 1


def test_policy_rollback():
    """Verify rollback restores safe baseline."""
    engine = PolicyEngine()
    evt = engine.rollback_to_baseline(reason="Emergency test rollback")
    assert evt.decision == "ROLLBACK_SAFE_BASELINE"
    assert "safe-baseline" in engine.state_version


def test_policy_transaction_lifecycle_and_fairness():
    """Verify atomic policy lifecycle and Jain's fairness calculation."""
    from enforcement.tc_adapter import LinuxTCAdapter
    from policy.engine import QoSPolicyRule

    engine = PolicyEngine()
    adapter = LinuxTCAdapter(interface="eth0", dry_run=True)

    # 1. Jain's fairness index
    equal_jfi = engine.compute_jains_fairness_index([20.0, 20.0, 20.0, 20.0])
    assert equal_jfi == 1.0
    skewed_jfi = engine.compute_jains_fairness_index([90.0, 5.0, 3.0, 2.0])
    assert skewed_jfi < 0.65

    # 2. Successful transaction
    pols = dict(engine.current_policies)
    ok, evt = engine.execute_policy_transaction(
        new_policies=pols,
        tc_adapter=adapter,
        wan_capacity_mbps=100.0,
        reason="Test transactional update",
    )
    assert ok is True
    assert engine.lifecycle_state in ("DRY_RUN", "VERIFIED")
    assert "APPLY_ADAPTIVE_QOS" in evt.decision

    # 3. Failed transaction due to starvation floor violation (< 5%)
    bad_pols = dict(pols)
    bad_pols["pol-bulk"] = QoSPolicyRule(
        id="pol-bulk",
        traffic_class="Bulk Downloads",
        priority_tier=5,
        min_share_pct=2.0,  # Violates 5% floor
        max_rate_mbps=50.0,
        target_latency_ms=200,
        queue_discipline="HTB-Priority",
    )
    fail_ok, fail_evt = engine.execute_policy_transaction(
        new_policies=bad_pols,
        tc_adapter=adapter,
        wan_capacity_mbps=100.0,
        reason="Starvation test update",
    )
    assert fail_ok is False
    assert engine.lifecycle_state == "FAILED"
    assert "REJECT_POLICY_MUTATION" in fail_evt.decision


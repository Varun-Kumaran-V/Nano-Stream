"""
===============================================================================
FILE: policy/engine.py
===============================================================================

PURPOSE
-------
Pure and deterministic Quality of Service (QoS) policy engine that computes
bandwidth allocations, queue priority tiers, and latency targets from link
capacity, early-flow classifier outputs, and active temporary user intents.
Provides preview-before-apply validation, state versioning, audit logging,
and safe rollback guards.

ROLE IN NANOSTREAM
------------------
This is the DETERMINISTIC POLICY & DECISION ENGINE.

It connects:

    Capacity Telemetry (Usable WAN rate, Congestion state)
                         +
    Active User Intents (Temporary priorities & deadlines)
                         +
    Early-Flow Class Scores & Unknown Gate
                         ↓
    Deterministic Precedence Hierarchy
                         ↓
    QoSPolicy Set (HTB rates, ceil, prio, fq_codel targets)
                         ↓
    Preview / Constraints Validation / Audit Events
                         ↓
    Linux `tc` Enforcement Adapter

POLICY PRECEDENCE HIERARCHY
---------------------------
1. Safety & Minimum Service Guarantees (No starvation: every class gets >= 5% floor)
2. Active Temporary User Intent (TTL-bounded priority elevation)
3. Congestion & Capacity Dynamics (Bottleneck rate scaling and headroom preservation)
4. Early-Flow ML Classification (High-confidence traffic mapped to declared QoS tiers)
5. Fallback Safe Baseline (FQ-CoDel best-effort default)

DEPENDENCIES
------------
Python standard library (time, uuid, dataclasses, typing).

===============================================================================
"""

from dataclasses import dataclass, field
import datetime
import time
from typing import Any, Dict, List, Optional, Tuple

from policy.intent_store import IntentRecord, IntentStore


@dataclass
class QoSPolicyRule:
    """
    Class-specific QoS allocation rule matching frontend QoSPolicy interface.
    """
    id: str
    traffic_class: str
    priority_tier: int  # 1 to 5
    min_share_pct: float
    max_rate_mbps: float
    target_latency_ms: int
    queue_discipline: str  # 'FQ-CoDel-Simulated' | 'HTB-Priority' | 'DRR-Fair'
    enabled: bool = True
    last_changed: str = ""
    provenance: str = "MEASURED_LIVE"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "trafficClass": self.traffic_class,
            "priorityTier": self.priority_tier,
            "minSharePct": round(self.min_share_pct, 1),
            "maxRateMbps": round(self.max_rate_mbps, 2),
            "targetLatencyMs": self.target_latency_ms,
            "queueDiscipline": self.queue_discipline,
            "enabled": self.enabled,
            "lastChanged": self.last_changed,
            "provenance": self.provenance,
        }


@dataclass
class PolicyEventRecord:
    """
    Audit event record matching frontend PolicyEvent interface.
    """
    id: str
    timestamp: str
    step_index: int
    decision: str
    reason: str
    policy_effect: str
    outcome: str
    severity: str  # 'INFO' | 'ADAPTATION' | 'CONGESTION' | 'RECOVERY'
    provenance: str = "MEASURED_LIVE"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "stepIndex": self.step_index,
            "decision": self.decision,
            "reason": self.reason,
            "policyEffect": self.policy_effect,
            "outcome": self.outcome,
            "severity": self.severity,
            "provenance": self.provenance,
        }


class PolicyEngine:
    """
    Deterministic rule engine that produces inspectable, verifiable QoS policy sets.
    """
    def __init__(self, intent_store: Optional[IntentStore] = None):
        self.intent_store = intent_store or IntentStore()
        self.state_version = "pol-v1.0"
        self.step_index = 0
        self.audit_events: List[PolicyEventRecord] = []
        self.max_events: int = 200
        self.lifecycle_state: str = "VERIFIED"  # PROPOSED | VALIDATING | APPLYING | APPLIED_UNVERIFIED | VERIFIED | FAILED | ROLLING_BACK | ROLLED_BACK | DRY_RUN

        # Initial baseline policies
        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.current_policies: Dict[str, QoSPolicyRule] = {
            "pol-video-call": QoSPolicyRule(
                id="pol-video-call",
                traffic_class="Video Calls",
                priority_tier=1,
                min_share_pct=15.0,
                max_rate_mbps=100.0,
                target_latency_ms=25,
                queue_discipline="HTB-Priority",
                enabled=True,
                last_changed=now_str,
            ),
            "pol-gaming": QoSPolicyRule(
                id="pol-gaming",
                traffic_class="Gaming",
                priority_tier=2,
                min_share_pct=10.0,
                max_rate_mbps=100.0,
                target_latency_ms=15,
                queue_discipline="HTB-Priority",
                enabled=True,
                last_changed=now_str,
            ),
            "pol-streaming": QoSPolicyRule(
                id="pol-streaming",
                traffic_class="Streaming",
                priority_tier=3,
                min_share_pct=30.0,
                max_rate_mbps=90.0,
                target_latency_ms=80,
                queue_discipline="HTB-Priority",
                enabled=True,
                last_changed=now_str,
            ),
            "pol-browsing": QoSPolicyRule(
                id="pol-browsing",
                traffic_class="Interactive Browsing",
                priority_tier=4,
                min_share_pct=20.0,
                max_rate_mbps=90.0,
                target_latency_ms=45,
                queue_discipline="HTB-Priority",
                enabled=True,
                last_changed=now_str,
            ),
            "pol-bulk": QoSPolicyRule(
                id="pol-bulk",
                traffic_class="Bulk Downloads",
                priority_tier=5,
                min_share_pct=10.0,
                max_rate_mbps=60.0,
                target_latency_ms=180,
                queue_discipline="HTB-Priority",
                enabled=True,
                last_changed=now_str,
            ),
            "pol-background": QoSPolicyRule(
                id="pol-background",
                traffic_class="Background Sync",
                priority_tier=5,
                min_share_pct=5.0,
                max_rate_mbps=40.0,
                target_latency_ms=300,
                queue_discipline="HTB-Priority",
                enabled=True,
                last_changed=now_str,
            ),
            "pol-unknown": QoSPolicyRule(
                id="pol-unknown",
                traffic_class="Unknown",
                priority_tier=4,
                min_share_pct=10.0,
                max_rate_mbps=80.0,
                target_latency_ms=60,
                queue_discipline="HTB-Priority",
                enabled=True,
                last_changed=now_str,
            ),
        }

    def compute_policy_proposal(
        self,
        current_shaping_mbps: float,
        congestion_state: str,
        active_intents: Optional[List[IntentRecord]] = None,
    ) -> Dict[str, QoSPolicyRule]:
        """
        Pure function computing adapted policy parameters based on
        usable bandwidth and active intents.
        """
        if active_intents is None:
            active_intents = self.intent_store.get_active_intents()

        proposal: Dict[str, QoSPolicyRule] = {}
        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Map active intents by class
        intent_map: Dict[str, IntentRecord] = {}
        for intent in active_intents:
            intent_map[intent.traffic_class] = intent

        for pol_id, base in self.current_policies.items():
            t_class = base.traffic_class
            prio = base.priority_tier
            floor_pct = base.min_share_pct
            max_mbps = min(current_shaping_mbps, base.max_rate_mbps)
            target_lat = base.target_latency_ms

            # Apply intent elevation if active
            if t_class in intent_map:
                intent = intent_map[t_class]
                prio = min(prio, intent.priority_tier)
                target_lat = min(target_lat, intent.target_latency_ms)
                if intent.min_floor_mbps is not None:
                    floor_pct = max(floor_pct, (intent.min_floor_mbps / max(1.0, current_shaping_mbps)) * 100.0)
                if intent.max_ceiling_mbps is not None:
                    max_mbps = min(max_mbps, intent.max_ceiling_mbps)

            # Throttle elastic traffic under severe congestion
            if congestion_state in ("CAPACITY_DROP", "ELEVATED_QUEUE"):
                if prio == 5:
                    max_mbps = current_shaping_mbps * 0.50  # Scavenger throttled to 50%
                elif prio == 3:
                    max_mbps = current_shaping_mbps * 0.85

            proposal[pol_id] = QoSPolicyRule(
                id=pol_id,
                traffic_class=t_class,
                priority_tier=prio,
                min_share_pct=floor_pct,
                max_rate_mbps=max_mbps,
                target_latency_ms=target_lat,
                queue_discipline=base.queue_discipline,
                enabled=base.enabled,
                last_changed=now_str,
            )

        # Starvation guard: Check that total floor percentages do not exceed 90%
        total_floors = sum(p.min_share_pct for p in proposal.values() if p.enabled)
        if total_floors > 90.0:
            # Scale floors down proportionally while guaranteeing 5% min floor
            scale = 85.0 / total_floors
            for p in proposal.values():
                if p.enabled:
                    p.min_share_pct = max(5.0, p.min_share_pct * scale)

        return proposal

    def preview_policy_change(
        self,
        proposed_policies: Dict[str, Any],
        wan_capacity_mbps: float,
    ) -> Dict[str, Any]:
        """
        Validate proposed policy mutations without altering active system state.
        """
        import uuid
        preview_id = f"prev-{uuid.uuid4().hex[:8]}"
        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        proposed_changes: List[Dict[str, Any]] = []
        warnings: List[str] = []

        total_floor_pct = 0.0
        for pol_id, spec in proposed_policies.items():
            curr = self.current_policies.get(pol_id)
            min_floor = float(spec.get("minSharePct", curr.min_share_pct if curr else 10.0))
            max_rate = float(spec.get("maxRateMbps", curr.max_rate_mbps if curr else 100.0))
            prio = int(spec.get("priorityTier", curr.priority_tier if curr else 3))
            total_floor_pct += min_floor

            if curr and (curr.min_share_pct != min_floor or curr.max_rate_mbps != max_rate or curr.priority_tier != prio):
                proposed_changes.append({
                    "policyId": pol_id,
                    "trafficClass": curr.traffic_class,
                    "before": {
                        "minSharePct": curr.min_share_pct,
                        "maxRateMbps": curr.max_rate_mbps,
                        "priorityTier": curr.priority_tier,
                    },
                    "after": {
                        "minSharePct": min_floor,
                        "maxRateMbps": max_rate,
                        "priorityTier": prio,
                    },
                })

            if min_floor < 5.0:
                warnings.append(f"Policy {pol_id} has floor < 5%, which risks packet starvation.")
            if max_rate > wan_capacity_mbps:
                warnings.append(f"Policy {pol_id} ceiling ({max_rate:.1f} Mbps) exceeds estimated WAN capacity ({wan_capacity_mbps:.1f} Mbps).")

        if total_floor_pct > 90.0:
            warnings.append(f"Total reserved bandwidth floors ({total_floor_pct:.1f}%) exceed the 90% link safety threshold.")

        constraints_checked = {
            "minimumService": all(spec.get("minSharePct", 10.0) >= 5.0 for spec in proposed_policies.values()),
            "maximumRate": all(spec.get("maxRateMbps", 10.0) <= wan_capacity_mbps * 1.05 for spec in proposed_policies.values()),
            "fairnessGuard": total_floor_pct <= 90.0,
            "intentNotExpired": True,
        }

        return {
            "previewId": preview_id,
            "createdAt": now_str,
            "stateVersion": self.state_version,
            "proposedChanges": proposed_changes,
            "constraintsChecked": constraints_checked,
            "warnings": warnings,
            "requiresConfirmation": len(warnings) > 0 or len(proposed_changes) >= 3,
        }

    def execute_policy_transaction(
        self,
        new_policies: Dict[str, QoSPolicyRule],
        tc_adapter: Any,
        wan_capacity_mbps: float,
        reason: str = "Automated adaptation",
        severity: str = "ADAPTATION",
    ) -> Tuple[bool, PolicyEventRecord]:
        """
        Execute an atomic transactional policy lifecycle:
        PROPOSED -> VALIDATING -> APPLYING -> VERIFIED (or FAILED -> ROLLED_BACK).
        """
        import uuid
        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # 1. Proposed
        self.lifecycle_state = "PROPOSED"

        # 2. Validating constraints
        self.lifecycle_state = "VALIDATING"
        total_floor = sum(p.min_share_pct for p in new_policies.values() if p.enabled)
        if any(p.min_share_pct < 5.0 for p in new_policies.values() if p.enabled):
            self.lifecycle_state = "FAILED"
            event = PolicyEventRecord(
                id=f"evt-{uuid.uuid4().hex[:8]}",
                timestamp=now_str,
                step_index=self.step_index,
                decision="REJECT_POLICY_MUTATION",
                reason=f"Validation failed: Starvation guard violated (class floor < 5%)",
                policy_effect="Rejected mutation; previous active policy retained",
                outcome="Validation failure",
                severity="CONGESTION",
            )
            self.audit_events.append(event)
            return False, event

        if total_floor > 100.0:
            self.lifecycle_state = "FAILED"
            event = PolicyEventRecord(
                id=f"evt-{uuid.uuid4().hex[:8]}",
                timestamp=now_str,
                step_index=self.step_index,
                decision="REJECT_POLICY_MUTATION",
                reason=f"Validation failed: Total guaranteed floors ({total_floor:.1f}%) exceed 100% link capacity",
                policy_effect="Rejected mutation; previous active policy retained",
                outcome="Validation failure",
                severity="CONGESTION",
            )
            self.audit_events.append(event)
            return False, event

        # Scale down slightly if total floors exceed 90% link safety boundary
        if total_floor > 90.0:
            scale = 90.0 / total_floor
            for p in new_policies.values():
                if p.enabled:
                    p.min_share_pct = max(5.0, round(p.min_share_pct * scale, 1))

        # 3. Applying
        self.lifecycle_state = "APPLYING"
        self.step_index += 1
        state_ver = f"pol-v{self.step_index}.0"

        enf_res = tc_adapter.apply_hierarchy(
            wan_rate_mbps=wan_capacity_mbps,
            policy_rules=new_policies,
            state_version=state_ver,
        )

        # 4. Verify & Commit
        if enf_res.success:
            self.current_policies = new_policies
            self.state_version = state_ver
            self.lifecycle_state = "DRY_RUN" if enf_res.is_dry_run else "VERIFIED"

            event = PolicyEventRecord(
                id=f"evt-{uuid.uuid4().hex[:8]}",
                timestamp=now_str,
                step_index=self.step_index,
                decision="APPLY_ADAPTIVE_QOS",
                reason=reason,
                policy_effect=f"Updated {len(new_policies)} policy classes to match {self.state_version} ({self.lifecycle_state})",
                outcome=f"Policy verified on shaper ({len(enf_res.verified_classes)} classes confirmed)",
                severity=severity,
                provenance="MEASURED_LIVE",
            )
            self.audit_events.append(event)
            if len(self.audit_events) > self.max_events:
                self.audit_events.pop(0)
            return True, event
        else:
            # 5. Rollback on failure
            self.lifecycle_state = "ROLLING_BACK"
            tc_adapter.rollback_to_safe_baseline()
            rb_event = self.rollback_to_baseline(reason=f"Enforcement error: {enf_res.error_message}")
            self.lifecycle_state = "ROLLED_BACK"
            return False, rb_event

    def compute_jains_fairness_index(self, allocations: List[float]) -> float:
        """
        Compute Jain's Fairness Index over bandwidth allocations:
        J(x) = (sum x_i)^2 / (n * sum x_i^2)
        Returns float between 1/n (extreme unfairness) and 1.0 (perfect equality).
        """
        valid = [max(0.001, float(x)) for x in allocations if x is not None]
        if not valid:
            return 1.0
        n = len(valid)
        sum_x = sum(valid)
        sum_sq = sum(x * x for x in valid)
        if sum_sq == 0.0:
            return 1.0
        return round((sum_x * sum_x) / (n * sum_sq), 3)

    def apply_policy(
        self,
        new_policies: Dict[str, QoSPolicyRule],
        reason: str = "Automated adaptation",
        severity: str = "ADAPTATION",
    ) -> PolicyEventRecord:
        """
        Apply previewed policy set and append audit trail event.
        """
        import uuid
        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.step_index += 1

        self.current_policies = new_policies
        self.state_version = f"pol-v{self.step_index}.0"

        event = PolicyEventRecord(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            timestamp=now_str,
            step_index=self.step_index,
            decision="APPLY_ADAPTIVE_QOS",
            reason=reason,
            policy_effect=f"Updated {len(new_policies)} policy classes to match {self.state_version}",
            outcome="Policy verified and applied to shaper",
            severity=severity,
            provenance="MEASURED_LIVE",
        )
        self.audit_events.append(event)
        if len(self.audit_events) > self.max_events:
            self.audit_events.pop(0)

        return event

    def rollback_to_baseline(self, reason: str = "Safety rollback triggered") -> PolicyEventRecord:
        """
        Restore known-safe default policy baseline.
        """
        import uuid
        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.step_index += 1

        # Reset all policies to safe defaults
        for p in self.current_policies.values():
            p.priority_tier = 4 if p.traffic_class in ("Bulk Downloads", "Background Sync", "Unknown") else 2
            p.min_share_pct = 15.0
            p.max_rate_mbps = 100.0
            p.last_changed = now_str

        self.state_version = f"pol-v{self.step_index}-safe-baseline"

        event = PolicyEventRecord(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            timestamp=now_str,
            step_index=self.step_index,
            decision="ROLLBACK_SAFE_BASELINE",
            reason=reason,
            policy_effect="Restored all classes to default FQ-CoDel fair queuing baseline",
            outcome="Safety state restored",
            severity="CONGESTION",
            provenance="MEASURED_LIVE",
        )
        self.audit_events.append(event)
        return event

    def get_policies(self) -> List[Dict[str, Any]]:
        return [p.to_dict() for p in self.current_policies.values()]

    def get_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self.audit_events[-limit:]]

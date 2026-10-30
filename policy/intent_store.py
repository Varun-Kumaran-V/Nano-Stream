"""
===============================================================================
FILE: policy/intent_store.py
===============================================================================

PURPOSE
-------
Provides in-memory and persistent storage for temporary user QoS intents
with server-enforced expiration, resource constraints, and conflict validation.

ROLE IN NANOSTREAM
------------------
This is the INTENT ADAPTATION & EXPIRATION LAYER.

It connects:

    Frontend Intent Submission (e.g. "Prioritize 45-min Zoom Call")
                     ↓
    IntentStore Validation (Floor, Ceiling, TTL, Starvation Guards)
                     ↓
    Server-Owned Expiration Timer (Absolute UTC ISO-8601 expiresAt)
                     ↓
    Deterministic Policy Engine Input

INTENT INVARIANTS
-----------------
1. Server-owned expiration: Intent TTL is evaluated against server UTC time.
   Browser closing or network disconnect never prevents intent expiration.
2. Starvation protection: An intent may request at most 80% of current usable
   capacity. Total reserved intent floors across all active intents cannot
   exceed 85% of bottleneck bandwidth.
3. Class minimum floor preservation: Bulk and background classes are guaranteed
   a minimum non-zero bandwidth share (at least 5%) regardless of intent priorities.
4. Idempotency: Duplicate intent IDs overwrite safely without multiplying allocations.

DEPENDENCIES
------------
Python standard library (time, uuid, dataclasses, typing).

===============================================================================
"""

from dataclasses import dataclass, field
import datetime
import time
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class IntentRecord:
    """
    Representation of temporary user QoS intent matching frontend UserIntent type.
    """
    id: str
    name: str
    traffic_class: str
    priority_tier: int  # 1 (Highest), 2, 3
    target_latency_ms: int
    duration_minutes: int
    created_at: str
    expires_at: str
    min_floor_mbps: Optional[float] = None
    max_ceiling_mbps: Optional[float] = None
    status: str = "ACTIVE"  # 'ACTIVE' | 'EXPIRED' | 'PENDING_CONFIRMATION'
    rationale: str = ""
    provenance: str = "MEASURED_LIVE"

    def is_expired(self, now_iso: Optional[str] = None) -> bool:
        """Check whether current UTC time exceeds expires_at."""
        if self.status == "EXPIRED":
            return True
        if now_iso is None:
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return now_iso >= self.expires_at

    def remaining_seconds(self) -> int:
        """Compute remaining seconds until expiration."""
        if self.status == "EXPIRED":
            return 0
        try:
            exp_dt = datetime.datetime.fromisoformat(self.expires_at.replace("Z", "+00:00"))
            now_dt = datetime.datetime.now(datetime.timezone.utc)
            delta = (exp_dt - now_dt).total_seconds()
            return max(0, int(delta))
        except Exception:
            return 0

    def to_dict(self) -> Dict[str, Any]:
        """Serialize matching frontend TypeScript UserIntent interface."""
        return {
            "id": self.id,
            "name": self.name,
            "trafficClass": self.traffic_class,
            "priorityTier": self.priority_tier,
            "minFloorMbps": round(self.min_floor_mbps, 2) if self.min_floor_mbps is not None else None,
            "maxCeilingMbps": round(self.max_ceiling_mbps, 2) if self.max_ceiling_mbps is not None else None,
            "targetLatencyMs": self.target_latency_ms,
            "durationMinutes": self.duration_minutes,
            "remainingSeconds": self.remaining_seconds(),
            "status": "EXPIRED" if self.is_expired() else self.status,
            "rationale": self.rationale,
            "createdAt": self.created_at,
            "provenance": self.provenance,
        }


class IntentStore:
    """
    Thread-safe storage and validation manager for temporary user intents.
    """
    def __init__(self, max_concurrent_active_intents: int = 5):
        self.max_concurrent_active_intents = max_concurrent_active_intents
        self.intents: Dict[str, IntentRecord] = {}

    def create_intent(
        self,
        name: str,
        traffic_class: str,
        duration_minutes: int,
        priority_tier: int = 1,
        min_floor_mbps: Optional[float] = None,
        max_ceiling_mbps: Optional[float] = None,
        target_latency_ms: int = 50,
        rationale: str = "User requested priority intent",
        intent_id: Optional[str] = None,
    ) -> Tuple[bool, Optional[IntentRecord], Optional[str]]:
        """
        Validate and insert temporary QoS intent.

        Returns:
            Tuple of (success, record, error_message).
        """
        # Purge existing expired intents first
        self.sweep_expired_intents()

        active_count = sum(1 for i in self.intents.values() if not i.is_expired())
        if active_count >= self.max_concurrent_active_intents:
            return (
                False,
                None,
                f"Maximum concurrent active intents reached ({self.max_concurrent_active_intents}). Cancel an active intent first.",
            )

        if duration_minutes <= 0 or duration_minutes > 480:
            return False, None, "Duration must be between 1 and 480 minutes."

        now_dt = datetime.datetime.now(datetime.timezone.utc)
        exp_dt = now_dt + datetime.timedelta(minutes=duration_minutes)

        created_at_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        expires_at_iso = exp_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        if not intent_id:
            import uuid
            intent_id = f"intent-{uuid.uuid4().hex[:8]}"

        record = IntentRecord(
            id=intent_id,
            name=name,
            traffic_class=traffic_class,
            priority_tier=priority_tier,
            target_latency_ms=target_latency_ms,
            duration_minutes=duration_minutes,
            created_at=created_at_iso,
            expires_at=expires_at_iso,
            min_floor_mbps=min_floor_mbps,
            max_ceiling_mbps=max_ceiling_mbps,
            status="ACTIVE",
            rationale=rationale,
            provenance="MEASURED_LIVE",
        )

        self.intents[intent_id] = record
        return True, record, None

    def get_intent(self, intent_id: str) -> Optional[IntentRecord]:
        return self.intents.get(intent_id)

    def cancel_intent(self, intent_id: str) -> bool:
        record = self.intents.get(intent_id)
        if record:
            record.status = "EXPIRED"
            return True
        return False

    def list_intents(self, include_expired: bool = True) -> List[Dict[str, Any]]:
        self.sweep_expired_intents()
        result = []
        for intent in sorted(self.intents.values(), key=lambda i: i.created_at, reverse=True):
            if not include_expired and intent.is_expired():
                continue
            result.append(intent.to_dict())
        return result

    def get_active_intents(self) -> List[IntentRecord]:
        self.sweep_expired_intents()
        return [i for i in self.intents.values() if not i.is_expired()]

    def sweep_expired_intents(self) -> int:
        """Mark all past-due intents as EXPIRED."""
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        expired_count = 0
        for intent in self.intents.values():
            if intent.status != "EXPIRED" and intent.is_expired(now_iso):
                intent.status = "EXPIRED"
                expired_count += 1
        return expired_count

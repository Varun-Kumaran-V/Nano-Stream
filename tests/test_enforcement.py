"""
===============================================================================
FILE: tests/test_enforcement.py
===============================================================================

PURPOSE
-------
Unit tests verifying Linux tc enforcement adapter argument allowlisting,
command list synthesis, dry-run execution, and rollback restoration.

===============================================================================
"""

import pytest
from enforcement.tc_adapter import LinuxTCAdapter


def test_tc_adapter_allowlisting():
    """Verify malicious or invalid interface names are rejected."""
    adapter = LinuxTCAdapter(interface="eth0; rm -rf /", dry_run=True)
    res = adapter.apply_hierarchy(wan_rate_mbps=100.0, policy_rules={})
    assert res.success is False
    assert "Invalid interface name" in res.error_message


def test_tc_adapter_dry_run_execution():
    """Verify valid interface produces complete set of allowlisted tc commands."""
    adapter = LinuxTCAdapter(interface="eth0", dry_run=True)
    res = adapter.apply_hierarchy(wan_rate_mbps=100.0, policy_rules={}, state_version="v1.0")

    assert res.success is True
    assert res.is_dry_run is True
    assert len(res.commands_executed) >= 12
    assert "htb rate 100.0mbit" in " ".join(res.commands_executed)
    assert len(res.verified_classes) >= 5


def test_tc_adapter_rollback():
    """Verify rollback restores known-safe baseline."""
    adapter = LinuxTCAdapter(interface="eth0", dry_run=True)
    rb = adapter.rollback_to_safe_baseline()
    assert rb.success is True
    assert rb.state_version == "safe-baseline"

"""
===============================================================================
FILE: enforcement/tc_adapter.py
===============================================================================

PURPOSE
-------
Manages Linux Traffic Control (tc) hierarchical token bucket (HTB) shaping,
Fair Queueing Controlled Delay (FQ-CoDel) leaf queueing disciplines, and
DSCP / class filters on the WAN egress bottleneck interface.
Provides typed allowlisted command synthesis, read-back verification,
idempotent application, and safe rollback guards.

ROLE IN NANOSTREAM
------------------
This is the LINUX ENFORCEMENT & DATA-PLANE ADAPTER.

It connects:

    QoSPolicy Set from PolicyEngine
                 ↓
    Typed Argument Allowlisting (no arbitrary shell injection)
                 ↓
    Linux `tc` Command Execution (or dry-run / simulation if unprivileged)
                 ↓
    Read-back Verification (`tc -s class show dev <iface>`)
                 ↓
    Rollback Guard on Failure / Disconnect

TC QDISC HIERARCHY
------------------
Root qdisc:
    htb 1:0 default 1:40 (shapes to total WAN capacity)
          |
    class htb 1:1 rate $WAN_RATE ceil $WAN_RATE
          |
    +-----+-----+-----+-----+-----+
    |     |     |     |     |     |
   1:10  1:20  1:30  1:40  1:50  ...
  (Video (Game (Stream(Web  (Bulk
   prio1 prio2 prio3  prio4  prio5)
    |     |     |     |     |
  fq_codel on each leaf class for internal flow isolation

SAFETY INVARIANTS
-----------------
1. Command Injection Prevention: All parameters (rates, classes, interfaces) are
   strictly validated against typed numeric ranges and regex allowlists.
2. Read-Back Verification: After mutation, the adapter queries kernel state and
   verifies that configured class rates match requested parameters.
3. Automated Safe Rollback: If any `tc` command exits with non-zero status or
   read-back verification fails, the adapter immediately restores the default
   unshaped or safe-baseline state.
4. Non-Root Graceful Degradation: If executed without root/CAP_NET_ADMIN privileges,
   the adapter operates in verifiable DRY_RUN / SIMULATED mode without crashing.

DEPENDENCIES
------------
Python standard library (subprocess, shutil, re, logging, dataclasses, typing).

===============================================================================
"""

from dataclasses import dataclass, field
import logging
import os
import re
import shutil
import subprocess
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("intentqos.enforcement")

INTERFACE_NAME_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.]{2,16}$")


@dataclass
class TCClassStats:
    """Parsed statistics for an active tc class."""
    class_id: str
    rate_mbps: float
    ceil_mbps: float
    bytes_sent: int = 0
    packets_sent: int = 0
    drops: int = 0
    overlimits: int = 0


@dataclass
class EnforcementResult:
    """Result of an enforcement mutation with verification status."""
    success: bool
    is_dry_run: bool
    state_version: str
    commands_executed: List[str]
    verified_classes: List[str]
    error_message: Optional[str] = None
    rollback_applied: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "isDryRun": self.is_dry_run,
            "stateVersion": self.state_version,
            "commandsExecuted": self.commands_executed,
            "verifiedClasses": self.verified_classes,
            "errorMessage": self.error_message,
            "rollbackApplied": self.rollback_applied,
        }


class LinuxTCAdapter:
    """
    Safe Linux Traffic Control adapter with typed argument allowlisting.
    """
    def __init__(self, interface: str = "eth0", dry_run: Optional[bool] = None):
        self.interface = interface
        self.tc_binary = shutil.which("tc")
        # If not running as root (euid != 0), force dry-run
        is_root = (os.geteuid() == 0) if hasattr(os, "geteuid") else False
        if dry_run is None:
            self.dry_run = not (is_root and self.tc_binary is not None)
        else:
            self.dry_run = dry_run

        self.last_applied_config: Dict[str, Any] = {}
        self.known_safe_baseline: Dict[str, Any] = {
            "wan_rate_mbps": 100.0,
            "classes": {
                "1:10": {"rate": 15.0, "ceil": 100.0, "prio": 1},
                "1:20": {"rate": 10.0, "ceil": 100.0, "prio": 2},
                "1:30": {"rate": 30.0, "ceil": 90.0, "prio": 3},
                "1:40": {"rate": 20.0, "ceil": 90.0, "prio": 4},
                "1:50": {"rate": 10.0, "ceil": 60.0, "prio": 5},
            },
        }

    def _validate_interface(self, iface: str) -> bool:
        return bool(INTERFACE_NAME_REGEX.match(iface))

    def _execute_command(self, cmd_args: List[str]) -> Tuple[int, str, str]:
        """
        Execute command via subprocess.run with typed argument list.
        """
        if self.dry_run:
            logger.debug("[DRY-RUN] tc command: %s", " ".join(cmd_args))
            return 0, "", ""

        try:
            res = subprocess.run(cmd_args, capture_output=True, text=True, timeout=5)
            return res.returncode, res.stdout, res.stderr
        except Exception as e:
            logger.error("Failed to execute tc command: %s", str(e))
            return -1, "", str(e)

    def read_back_classes(self) -> Dict[str, TCClassStats]:
        """
        Query current kernel tc class statistics and parse rates/drops.
        """
        if self.dry_run or not self.tc_binary:
            # Return synthetic verified state matching last applied or baseline
            mock_rates = self.last_applied_config.get("classes", self.known_safe_baseline["classes"])
            result = {}
            for cid, spec in mock_rates.items():
                result[cid] = TCClassStats(
                    class_id=cid,
                    rate_mbps=spec["rate"],
                    ceil_mbps=spec["ceil"],
                    bytes_sent=100000,
                    packets_sent=120,
                    drops=0,
                )
            return result

        cmd = [self.tc_binary, "-s", "class", "show", "dev", self.interface]
        code, stdout, _ = self._execute_command(cmd)
        if code != 0:
            return {}

        stats: Dict[str, TCClassStats] = {}
        current_class_id = None
        for line in stdout.splitlines():
            class_match = re.search(r"class htb (\d+:\d+)", line)
            if class_match:
                current_class_id = class_match.group(1)
                rate_match = re.search(r"rate (\d+[KMGkmg]?bit)", line)
                ceil_match = re.search(r"ceil (\d+[KMGkmg]?bit)", line)
                r_mbps = self._parse_rate_to_mbps(rate_match.group(1)) if rate_match else 0.0
                c_mbps = self._parse_rate_to_mbps(ceil_match.group(1)) if ceil_match else 0.0
                stats[current_class_id] = TCClassStats(class_id=current_class_id, rate_mbps=r_mbps, ceil_mbps=c_mbps)

            if current_class_id and "Sent" in line:
                bytes_match = re.search(r"Sent (\d+) bytes", line)
                pkts_match = re.search(r"(\d+) pkt", line)
                drops_match = re.search(r"dropped (\d+)", line)
                if bytes_match:
                    stats[current_class_id].bytes_sent = int(bytes_match.group(1))
                if pkts_match:
                    stats[current_class_id].packets_sent = int(pkts_match.group(1))
                if drops_match:
                    stats[current_class_id].drops = int(drops_match.group(1))

        return stats

    def _parse_rate_to_mbps(self, rate_str: str) -> float:
        rate_str = rate_str.lower()
        if "gbit" in rate_str:
            return float(rate_str.replace("gbit", "")) * 1000.0
        if "mbit" in rate_str:
            return float(rate_str.replace("mbit", ""))
        if "kbit" in rate_str:
            return float(rate_str.replace("kbit", "")) / 1000.0
        return 0.0

    def apply_hierarchy(
        self,
        wan_rate_mbps: float,
        policy_rules: Dict[str, Any],
        state_version: str = "v1",
    ) -> EnforcementResult:
        """
        Apply complete HTB + FQ-CoDel class hierarchy on the bottleneck interface.
        """
        if not self._validate_interface(self.interface):
            return EnforcementResult(
                success=False,
                is_dry_run=self.dry_run,
                state_version=state_version,
                commands_executed=[],
                verified_classes=[],
                error_message=f"Invalid interface name: {self.interface}",
            )

        wan_rate_mbps = max(1.0, min(10000.0, wan_rate_mbps))
        commands: List[List[str]] = []

        tc = self.tc_binary or "/sbin/tc"

        # 1. Clean existing root qdisc (ignore errors if none exists)
        commands.append([tc, "qdisc", "del", "dev", self.interface, "root"])

        # 2. Add root HTB qdisc
        commands.append([tc, "qdisc", "add", "dev", self.interface, "root", "handle", "1:", "htb", "default", "40"])

        # 3. Add root class shaping to WAN rate
        commands.append([
            tc, "class", "add", "dev", self.interface, "parent", "1:", "classid", "1:1",
            "htb", "rate", f"{wan_rate_mbps:.1f}mbit", "ceil", f"{wan_rate_mbps:.1f}mbit",
        ])

        # 4. Add leaf classes
        class_mapping = {
            "pol-video-call": ("1:10", 1, 0.15, 1.00),
            "pol-gaming": ("1:20", 2, 0.10, 1.00),
            "pol-streaming": ("1:30", 3, 0.30, 0.90),
            "pol-browsing": ("1:40", 4, 0.20, 0.90),
            "pol-bulk": ("1:50", 5, 0.10, 0.60),
            "pol-background": ("1:50", 5, 0.05, 0.40),
            "pol-unknown": ("1:40", 4, 0.10, 0.80),
        }

        executed_cmds_str: List[str] = []
        class_specs: Dict[str, Dict[str, float]] = {}

        for pol_id, (cid, prio, def_floor, def_ceil) in class_mapping.items():
            rule = policy_rules.get(pol_id)
            if rule:
                floor_share = getattr(rule, "min_share_pct", def_floor * 100.0) / 100.0
                max_rate = getattr(rule, "max_rate_mbps", wan_rate_mbps * def_ceil)
                class_prio = getattr(rule, "priority_tier", prio)
            else:
                floor_share = def_floor
                max_rate = wan_rate_mbps * def_ceil
                class_prio = prio

            rate_val = max(0.5, wan_rate_mbps * floor_share)
            ceil_val = min(wan_rate_mbps, max(rate_val, max_rate))

            if cid not in class_specs:
                class_specs[cid] = {"rate": rate_val, "ceil": ceil_val, "prio": class_prio}
                commands.append([
                    tc, "class", "add", "dev", self.interface, "parent", "1:1", "classid", cid,
                    "htb", "rate", f"{rate_val:.1f}mbit", "ceil", f"{ceil_val:.1f}mbit", "prio", str(class_prio),
                ])
                # Attach leaf fq_codel qdisc
                commands.append([
                    tc, "qdisc", "add", "dev", self.interface, "parent", cid, "handle", f"{cid.split(':')[1]}:",
                    "fq_codel",
                ])

        # Execute commands sequentially
        for cmd in commands:
            cmd_str = " ".join(cmd)
            executed_cmds_str.append(cmd_str)
            code, out, err = self._execute_command(cmd)
            # Allow failure only on the first delete command
            if code != 0 and "qdisc del" not in cmd_str:
                logger.error("tc command failed: %s | Error: %s", cmd_str, err)
                # Apply rollback immediately
                self.rollback_to_safe_baseline()
                return EnforcementResult(
                    success=False,
                    is_dry_run=self.dry_run,
                    state_version=state_version,
                    commands_executed=executed_cmds_str,
                    verified_classes=[],
                    error_message=f"tc command failed: {err}",
                    rollback_applied=True,
                )

        self.last_applied_config = {
            "wan_rate_mbps": wan_rate_mbps,
            "classes": class_specs,
            "state_version": state_version,
        }

        # Read-back verification against requested policy
        verified = self.read_back_classes()
        verified_class_ids = list(verified.keys())

        if not self.dry_run:
            verified_ok, missing_or_mismatched = self.verify_classes(class_specs, verified)
            if not verified_ok:
                logger.error(
                    "Kernel read-back verification failed on %s: %s",
                    self.interface,
                    missing_or_mismatched,
                )
                self.rollback_to_safe_baseline()
                return EnforcementResult(
                    success=False,
                    is_dry_run=False,
                    state_version=state_version,
                    commands_executed=executed_cmds_str,
                    verified_classes=verified_class_ids,
                    error_message=f"Read-back verification failed: {missing_or_mismatched}",
                    rollback_applied=True,
                )

        return EnforcementResult(
            success=True,
            is_dry_run=self.dry_run,
            state_version=state_version,
            commands_executed=executed_cmds_str,
            verified_classes=verified_class_ids,
        )

    def verify_classes(
        self,
        expected_classes: Dict[str, Dict[str, float]],
        actual_classes: Optional[Dict[str, TCClassStats]] = None,
        tolerance_pct: float = 20.0,
    ) -> Tuple[bool, Optional[str]]:
        """
        Verify that actual kernel read-back classes match expected rates within tolerance.
        """
        if actual_classes is None:
            actual_classes = self.read_back_classes()

        for cid, spec in expected_classes.items():
            if cid not in actual_classes:
                return False, f"Missing expected class {cid} in kernel read-back"
            actual = actual_classes[cid]
            expected_rate = spec["rate"]
            delta = abs(actual.rate_mbps - expected_rate)
            max_allowed = max(0.5, expected_rate * (tolerance_pct / 100.0))
            if delta > max_allowed:
                return False, f"Class {cid} rate mismatch: expected ~{expected_rate:.1f}Mbps, got {actual.rate_mbps:.1f}Mbps"

        return True, None

    def reset_interface(self) -> bool:
        """
        Remove all root traffic-control queuing disciplines and restore unshaped kernel default.
        """
        tc = self.tc_binary or "/sbin/tc"
        cmd = [tc, "qdisc", "del", "dev", self.interface, "root"]
        code, _, err = self._execute_command(cmd)
        if code != 0 and "No such file or directory" not in err and "Cannot find" not in err:
            logger.warning("Failed to reset interface %s: %s", self.interface, err)
            return False
        return True

    def rollback_to_safe_baseline(self) -> EnforcementResult:
        """
        Immediately restore known-safe baseline configuration.
        """
        logger.warning("Initiating enforcement rollback to safe baseline on %s", self.interface)
        return self.apply_hierarchy(
            wan_rate_mbps=self.known_safe_baseline["wan_rate_mbps"],
            policy_rules={},
            state_version="safe-baseline",
        )

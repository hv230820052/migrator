"""
Gates Agent - Phase 3
Four gates: PLAN, MAPPINGS, SECRETS, CUTOVER
State machine physically cannot advance without approval record
"""
from typing import List, Dict, Any, Optional
from enum import Enum
from app.models import Run, Approval, Repo, Finding, Mapping
from app.cascade.router import get_router

class GateType(Enum):
    PLAN = "PLAN"
    MAPPINGS = "MAPPINGS"
    SECRETS = "SECRETS"
    CUTOVER = "CUTOVER"

class GateStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    ADJUSTED = "adjusted"
    HELD = "held"

class GatesAgent:
    """Manages the four approval gates"""
    
    GATE_ORDER = [GateType.PLAN, GateType.MAPPINGS, GateType.SECRETS, GateType.CUTOVER]
    
    def __init__(self, db_session, event_emitter=None, run_id: int = None):
        self.db = db_session
        self.event_emitter = event_emitter
        self.run_id = run_id
        self.router = get_router(run_id) if run_id else None
    
    def get_gate_status(self, run_id: int, gate: GateType) -> Dict:
        """Get current status of a gate"""
        approval = self._get_approval(run_id, gate)
        if not approval:
            return {"gate": gate.value, "status": GateStatus.PENDING.value, "can_proceed": False}
        
        return {
            "gate": gate.value,
            "status": "approved" if approval.decision in ["approved", "approve"] else approval.decision,
            "actor": approval.actor,
            "reason": approval.reason,
            "timestamp": approval.timestamp.isoformat() if approval.timestamp else None,
            "can_proceed": approval.decision in ["approved", "approve"]
        }
    
    def get_all_gates(self, run_id: int) -> List[Dict]:
        """Get status of all gates for a run"""
        statuses = []
        for gate in self.GATE_ORDER:
            status = self.get_gate_status(run_id, gate)
            # Can only proceed to next gate if current is approved
            if gate != GateType.PLAN:
                prev_gate = self.GATE_ORDER[self.GATE_ORDER.index(gate) - 1]
                prev_status = self.get_gate_status(run_id, prev_gate)
                can_proceed = prev_status.get("can_proceed", False)
            else:
                can_proceed = True
            
            status["can_proceed"] = can_proceed
            statuses.append(status)
        return statuses
    
    def approve_gate(self, run_id: int, gate: GateType, actor: str, decision: str, reason: str = "") -> Approval:
        """Record gate approval (APPROVE, ADJUST, HOLD)"""
        # Validate gate order
        if not self._can_approve_gate(run_id, gate):
            raise ValueError(f"Cannot approve {gate.value} - previous gates not approved")
        
        # Validate decision
        if decision not in ["approve", "adjust", "hold"]:
            raise ValueError(f"Invalid decision: {decision}")
        
        # Create approval record
        approval = Approval(
            gate=gate.value,
            run_id=run_id,
            actor=actor,
            decision=decision,
            reason=reason
        )
        self.db.add(approval)
        self.db.commit()
        
        # Emit event
        if self.event_emitter:
            import asyncio
            asyncio.create_task(self.event_emitter(run_id, {
                "agent": "Gates",
                "action": f"Gate {gate.value} {decision}",
                "reason": f"{reason} by {actor}",
                "tier": "T3"
            }))
        
        # Update run status
        self._update_run_status(run_id)
        
        return self._get_approval(run_id, gate)
    
    def _can_approve_gate(self, run_id: int, gate: GateType) -> bool:
        """Check if all previous gates are approved"""
        gate_idx = self.GATE_ORDER.index(gate)
        for i in range(gate_idx):
            prev_gate = self.GATE_ORDER[i]
            approval = self._get_approval(run_id, prev_gate)
            if not approval or approval.decision not in ["approve", "approved"]:
                return False
        return True
    
    def _get_approval(self, run_id: int, gate: GateType):
        return self.db.query(Approval).filter(
            Approval.run_id == run_id, Approval.gate == gate.value
        ).first()
    
    def _update_run_status(self, run_id: int):
        """Update run status based on gate approvals"""
        # Check if all gates approved
        all_approved = all(
            self._get_approval(run_id, g) and self._get_approval(run_id, g).decision == "approve"
            for g in self.GATE_ORDER
        )
        
        if all_approved:
            # All gates approved - ready for migration
            pass
        elif any(self._get_approval(run_id, g) and self._get_approval(run_id, g).decision == "hold" 
                 for g in self.GATE_ORDER):
            # Any gate held - pause
            pass
    
    def get_next_action(self, run_id: int) -> Dict:
        """Get the next required action for the run"""
        for gate in self.GATE_ORDER:
            status = self.get_gate_status(run_id, gate)
            if status["status"] == "pending":
                return {
                    "next_gate": gate.value,
                    "action": f"Approve {gate.value} gate",
                    "description": self._get_gate_description(gate),
                    "can_proceed": True
                }
            elif status["status"] in ["adjusted", "held"]:
                return {
                    "next_gate": gate.value,
                    "action": f"Resolve {gate.value} gate ({status['status']})",
                    "description": self._get_gate_description(gate),
                    "can_proceed": True
                }
        return {"next_gate": "COMPLETE", "action": "All gates approved - ready for migration"}
    
    def _get_gate_description(self, gate: GateType) -> str:
        descriptions = {
            GateType.PLAN: "Review and approve migration plan (waves, mappings, remediation approach)",
            GateType.MAPPINGS: "Confirm author identity mappings and layout conversions",
            GateType.SECRETS: "Acknowledge secret findings and approve remediation approach",
            GateType.CUTOVER: "Final go/no-go for migration execution and cutover"
        }
        return descriptions.get(gate, "")
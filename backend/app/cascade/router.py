"""
Cascade Router - Phase 3
T0 rules → T2 LLM (evidence packets, sha256 memo) → T3 human
Token budget circuit breaker, sha256 memoization
"""
import hashlib
import json
import time
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from app.models import SessionLocal
from app.cascade.tiers import T0Rules, T2LLM, T3Human

class DecisionTier(Enum):
    T0 = "T0"
    T2 = "T2"
    T3 = "T3"

@dataclass
class EvidencePacket:
    """Compact evidence for T2 LLM - max 5 signals, sha256 memo key"""
    entity_type: str  # "author", "secret", "layout", "failure"
    entity_id: str
    signals: List[Dict]  # max 5
    sha256_key: str
    
    def to_dict(self) -> Dict:
        return {
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "signals": self.signals,
            "sha256_key": self.sha256_key
        }

@dataclass
class Decision:
    outcome: Any
    tier: DecisionTier
    confidence: float
    reason: str
    tokens_used: int = 0
    evidence_packet: Optional[EvidencePacket] = None
    sha256_memo: Optional[str] = None

class TokenBudget:
    """Per-run token budget with circuit breaker"""
    
    def __init__(self, limit: int = 100000):
        self.limit = limit
        self.used = 0
        self.tripped = False
    
    def consume(self, tokens: int) -> bool:
        """Returns True if consumption successful, False if budget exceeded"""
        if self.tripped:
            return False
        if self.used + tokens > self.limit:
            self.tripped = True
            return False
        self.used += tokens
        return True
    
    def remaining(self) -> int:
        return max(0, self.limit - self.used)
    
    def is_tripped(self) -> bool:
        return self.tripped

class DecisionRouter:
    """Routes decisions through T0 → T2 → T3 cascade with memoization and budget"""
    
    def __init__(self, run_id: Optional[int] = None, token_budget: int = 100000):
        self.run_id = run_id
        self.budget = TokenBudget(token_budget)
        self.memo_cache: Dict[str, Decision] = {}  # sha256_key -> Decision
        
        # Initialize tiers
        self.t0 = T0Rules()
        self.t2 = T2LLM()
        self.t3 = T3Human(run_id)
    
    def _make_evidence_packet(self, entity_type: str, entity_id: str, signals: List[Dict]) -> EvidencePacket:
        """Create evidence packet with sha256 memo key"""
        # Limit to 5 signals
        limited_signals = signals[:5]
        
        # Create deterministic key for memoization
        key_data = json.dumps({
            "entity_type": entity_type,
            "entity_id": entity_id,
            "signals": limited_signals
        }, sort_keys=True)
        sha256_key = hashlib.sha256(key_data.encode()).hexdigest()
        
        return EvidencePacket(
            entity_type=entity_type,
            entity_id=entity_id,
            signals=limited_signals,
            sha256_key=sha256_key
        )
    
    def resolve(self, question: str, context: Dict) -> Decision:
        """Resolve a decision through T0 → T2 → T3 cascade"""
        
        # Create evidence packet
        entity_type = context.get("entity_type", "unknown")
        entity_id = context.get("entity_id", "unknown")
        signals = context.get("signals", [])
        
        packet = self._make_evidence_packet(entity_type, entity_id, signals)
        
        # Check memo cache first
        if packet.sha256_key in self.memo_cache:
            cached = self.memo_cache[packet.sha256_key]
            return Decision(
                outcome=cached.outcome,
                tier=DecisionTier.T0,  # Cached counts as T0
                confidence=1.0,
                reason=f"Memoized from {cached.tier.value}",
                tokens_used=0,
                evidence_packet=packet,
                sha256_memo=packet.sha256_key
            )
        
        # TIER 0: Deterministic rules
        t0_result = self.t0.evaluate(question, context, packet.signals)
        if t0_result.confident:
            decision = Decision(
                outcome=t0_result.outcome,
                tier=DecisionTier.T0,
                confidence=t0_result.confidence,
                reason=t0_result.reason,
                tokens_used=0,
                evidence_packet=packet,
                sha256_memo=packet.sha256_key
            )
            self.memo_cache[packet.sha256_key] = decision
            return decision
        
        # TIER 2: LLM with evidence packet (check budget)
        estimated_tokens = self._estimate_tokens(question, packet)
        if not self.budget.consume(estimated_tokens):
            # Budget tripped → degrade to T3
            return self._escalate_to_t3(question, context, packet, "Budget exhausted")
        
        t2_result = self.t2.evaluate(question, context, packet)
        if t2_result.confident:
            decision = Decision(
                outcome=t2_result.outcome,
                tier=DecisionTier.T2,
                confidence=t2_result.confidence,
                reason=t2_result.reason,
                tokens_used=estimated_tokens,
                evidence_packet=packet,
                sha256_memo=packet.sha256_key
            )
            self.memo_cache[packet.sha256_key] = decision
            return decision
        
        # TIER 3: Human approval
        return self._escalate_to_t3(question, context, packet, t2_result.reason or "Low confidence")
    
    def _escalate_to_t3(self, question: str, context: Dict, packet: EvidencePacket, reason: str) -> Decision:
        """Escalate to human (T3)"""
        t3_result = self.t3.request_approval(question, context, packet, reason)
        decision = Decision(
            outcome=t3_result.outcome,
            tier=DecisionTier.T3,
            confidence=t3_result.confidence,
            reason=f"Human approval: {t3_result.reason}",
            tokens_used=0,
            evidence_packet=packet,
            sha256_memo=packet.sha256_key
        )
        self.memo_cache[packet.sha256_key] = decision
        return decision
    
    def _estimate_tokens(self, question: str, packet: EvidencePacket) -> int:
        """Rough token estimate for T2 call"""
        # Rough heuristic: question + evidence packet ≈ 500-2000 tokens
        base = len(question) // 4  # ~4 chars per token
        evidence = len(json.dumps(packet.to_dict())) // 4
        return min(2000, max(500, base + evidence))
    
    def get_stats(self) -> Dict:
        return {
            "budget_limit": self.budget.limit,
            "budget_used": self.budget.used,
            "budget_remaining": self.budget.remaining(),
            "budget_tripped": self.budget.is_tripped(),
            "memo_hits": len(self.memo_cache),
            "memo_keys": list(self.memo_cache.keys())
        }

# Global router instance (per run)
_router_instances: Dict[int, DecisionRouter] = {}

def get_router(run_id: int, token_budget: int = 100000) -> DecisionRouter:
    """Get or create router for a run"""
    if run_id not in _router_instances:
        _router_instances[run_id] = DecisionRouter(run_id)
    return _router_instances[run_id]

def clear_router(run_id: int):
    """Clear router for a run"""
    if run_id in _router_instances:
        del _router_instances[run_id]
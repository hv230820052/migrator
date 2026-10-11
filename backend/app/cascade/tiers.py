"""
Cascade Tiers - Phase 3
T0: Deterministic rules
T2: LLM with evidence packets
T3: Human approval
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from abc import ABC, abstractmethod
import json
import os

@dataclass
class TierResult:
    outcome: Any
    confident: bool
    confidence: float
    reason: str

class BaseTier(ABC):
    @abstractmethod
    def evaluate(self, question: str, context: Dict, signals: List[Dict]) -> "TierResult":
        pass

class T0Rules:
    """Tier 0: Deterministic rules - zero LLM calls"""
    
    def evaluate(self, question: str, context: Dict, signals: List[Dict]) -> "TierResult":
        """Evaluate using deterministic rules only"""
        entity_type = question.get("entity_type", "") if isinstance(question, dict) else ""
        
        # Author mapping rules
        if "author" in str(question).lower() or "mapping" in str(question).lower():
            return self._author_rules(context, signals)
        
        # Secret triage rules
        if "secret" in str(question).lower():
            return self._secret_rules(context, signals)
        
        # Layout mapping rules
        if "layout" in str(question).lower() or "branch" in str(question).lower():
            return self._layout_rules(context, signals)
        
        # Failure diagnosis rules
        if "failure" in str(question).lower() or "error" in str(question).lower():
            return self._failure_rules(context, signals)
        
        # Default: not confident at T0
        return TierResult(
            outcome=None,
            confident=False,
            confidence=0.0,
            reason="No deterministic rule matches"
        )
    
    def _author_rules(self, context: Dict, signals: List[Dict]) -> "TierResult":
        """Author mapping: exact match → auto, else escalate"""
        signals_dict = {s.get("key"): s.get("value") for s in context.get("signals", [])}
        
        # Check for exact match in directory
        email = signals_dict.get("email", "")
        username = signals_dict.get("username", "")
        
        # Exact email match in directory
        if email and self._exact_directory_match(email):
            return TierResult(
                outcome={"action": "auto_map", "github_login": self._lookup_github(email)},
                confident=True,
                confidence=1.0,
                reason=f"Exact directory match for {email}"
            )
        
        # Exact username match
        if username and self._exact_username_match(username):
            return TierResult(
                outcome={"action": "auto_map", "github_login": username},
                confident=True,
                confidence=1.0,
                reason=f"Exact username match for {username}"
            )
        
        # Check for strong fuzzy match (high confidence threshold)
        best_match = self._best_fuzzy_match(username, email)
        if best_match and best_match["confidence"] >= 0.95:
            return TierResult(
                outcome={"action": "auto_map", "github_login": best_match["login"]},
                confident=True,
                confidence=best_match["confidence"],
                reason=f"High-confidence fuzzy match: {best_match['reason']}"
            )
        
        # Escalate to T2 for ambiguous cases
        return TierResult(
            outcome=None,
            confident=False,
            confidence=0.0,
            reason="Ambiguous author - requires evidence packet"
        )
    
    def _secret_rules(self, context: Dict, signals: List[Dict]) -> "TierResult":
        """Secret triage: known patterns → auto, ambiguous → escalate"""
        secret_type = context.get("secret_type", "")
        
        # Known malicious patterns → auto flag
        malicious_patterns = ["AKIA", "ghp_", "ghs_", "-----BEGIN"]
        for pattern in malicious_patterns:
            if pattern in str(signals):
                return TierResult(
                    outcome={"action": "flag", "severity": "high", "action_required": "rotate"},
                    confident=True,
                    confidence=0.95,
                    reason=f"Known malicious pattern detected"
                )
        
        # Test/example patterns → auto dismiss
        test_indicators = ["test", "dummy", "example", "fake", "placeholder"]
        signal_str = str(signals).lower()
        if any(ind in signal_str for ind in ["test", "dummy", "fake", "placeholder"]):
            return TierResult(
                outcome={"action": "dismiss", "severity": "low", "action_required": "none"},
                confident=True,
                confidence=0.9,
                reason="Test/example pattern detected"
            )
        
        # Ambiguous → escalate to T2
        return TierResult(
            outcome=None,
            confident=False,
            confidence=0.0,
            reason="Ambiguous secret - requires T2 triage"
        )
    
    def _layout_rules(self, context: Dict, signals: List[Dict]) -> "TierResult":
        """Layout mapping: standard layouts → auto, custom → escalate"""
        layout_type = context.get("layout_type", "standard")
        
        if layout_type == "standard_svn":
            return TierResult(
                outcome={"trunk": "main", "branches": "branches/*", "tags": "tags/*"},
                confident=True,
                confidence=1.0,
                reason="Standard SVN layout detected"
            )
        
        if layout_type == "github_flow":
            return TierResult(
                outcome={"main": "main", "feature": "feature/*"},
                confident=True,
                confidence=1.0,
                reason="GitHub flow layout"
            )
        
        return TierResult(
            outcome=None,
            confident=False,
            confidence=0.0,
            reason="Non-standard layout - requires T2 interpretation"
        )
    
    def _failure_rules(self, context: Dict, signals: List[Dict]) -> "TierResult":
        """Failure diagnosis: known signatures → auto fix"""
        error_sig = context.get("error_signature", "")
        
        known_fixes = {
            "file exceeds 100MB": {"fix": "convert_to_lfs", "auto_apply": True},
            "non-fast-forward": {"fix": "rebase_retry", "auto_apply": False},
            "auth failure": {"fix": "halt_manual", "auto_apply": False},
            "permission denied": {"fix": "check_creds", "auto_apply": False},
        }
        
        for sig, fix in known_fixes.items():
            if sig in error_sig:
                return TierResult(
                    outcome=fix,
                    confident=True,
                    confidence=0.9,
                    reason=f"Known error signature: {sig}"
                )
        
        return TierResult(
            outcome=None,
            confident=False,
            confidence=0.0,
            reason="Unknown error signature - requires T2 diagnosis"
        )
    
    # Helper methods (stubs - would integrate with directory/LDAP in production)
    def _exact_directory_match(self, email: str) -> bool:
        # Would query corporate directory
        return False
    
    def _exact_username_match(self, username: str) -> bool:
        return False
    
    def _lookup_github(self, email: str) -> str:
        return email.split("@")[0]
    
    def _best_fuzzy_match(self, username: str, email: str) -> Optional[Dict]:
        return None


class T2LLM:
    """Tier 2: LLM with evidence packets (max 5 signals, sha256 memo)"""
    
    def __init__(self):
        self.api_key = os.environ.get("LLM_API_KEY")
        self.model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
        self.enabled = bool(self.api_key)
    
    def evaluate(self, question: str, context: Dict, packet: "EvidencePacket") -> "TierResult":
        if not self.enabled:
            return TierResult(
                outcome=None,
                confident=False,
                confidence=0.0,
                reason="LLM not configured - template fallback"
            )
        
        # Build prompt with evidence packet
        prompt = self._build_prompt(question, packet)
        
        # Call LLM (placeholder - would use OpenAI/Anthropic SDK)
        # For now, return template fallback
        return TierResult(
            outcome=None,
            confident=False,
            confidence=0.0,
            reason="LLM call not implemented - template fallback"
        )
    
    def _build_prompt(self, question: str, packet: "EvidencePacket") -> str:
        return f"""
Question: {question}

Evidence Packet (max 5 signals):
Entity: {packet.entity_type} ({packet.entity_id})
Signals: {json.dumps(packet.signals, indent=2)}
Memo Key: {packet.sha256_key}

Provide: outcome, confidence (0-1), reason.
Respond in JSON: {{"outcome": ..., "confidence": 0.0-1.0, "reason": "..."}}
"""


class T3Human:
    """Tier 3: Human approval via approval cards"""
    
    def __init__(self, run_id: Optional[int] = None):
        self.run_id = run_id
    
    def request_approval(self, question: str, context: Dict, packet: "EvidencePacket", reason: str) -> "TierResult":
        """Create approval card for human"""
        # In production, this would create a UI card and wait for human response
        # For now, simulate with a deterministic outcome based on context
        
        # Simulate human decision based on context
        # In real implementation, this would block until human responds
        return TierResult(
            outcome={"action": "pending_human", "card_id": f"card_{packet.sha256_key[:8]}"},
            confident=True,  # Human decision is definitive
            confidence=1.0,
            reason=f"Human approval required: {reason}"
        )
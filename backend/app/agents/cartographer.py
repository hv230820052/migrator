"""
Cartographer Agent - Phase 3
Author identity mapping: T0 exact match → T2 evidence packets → T3 approval cards
"""
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from app.models import Repo, Mapping, Source
from app.cascade.router import DecisionRouter, get_router, EvidencePacket

@dataclass
class MappingProposal:
    legacy_id: str
    proposed_login: str
    proposed_email: str
    confidence: float
    evidence: List[Dict]
    status: str  # "pending", "auto", "confirmed", "edited"
    tier: str  # "T0", "T2", "T3"
    sha256_memo: str

class CartographerAgent:
    """Maps legacy identities to GitHub identities via cascade"""
    
    # Org directory fixture - T0 exact matches (loaded from fixture file)
    def _load_org_directory(self) -> Dict[str, str]:
        fixture_path = Path("/app/samples/fixtures/org-directory.json")
        if fixture_path.exists():
            with open(fixture_path) as f:
                return json.load(f).get("authors", {})
        # Fallback
        return {
            "dev.ninja99@example.com": "hv230820052",
            "john.doe@company.com": "HarshitVerma0005",
            "alice.smith@company.com": "asmith",
        }
    
    @property
    def ORG_DIRECTORY(self) -> Dict[str, str]:
        if not hasattr(self, '_org_directory'):
            self._org_directory = self._load_org_directory()
        return self._org_directory
    
    def __init__(self, db_session, event_emitter=None, run_id: int = None):
        self.db = db_session
        self.event_emitter = event_emitter
        self.run_id = run_id
        self.router = get_router(run_id) if run_id else DecisionRouter(run_id=run_id or 1)
    
    def map_authors(self, repo_id: int) -> List["MappingProposal"]:
        """Map all authors for a repo via cascade"""
        legacy_authors = self._get_legacy_authors(repo_id)
        
        proposals = []
        for author in legacy_authors:
            proposal = self._map_single_author(author, repo_id)
            proposals.append(proposal)
        
        return proposals
    
    def _get_legacy_authors(self, repo_id: int) -> List[Dict]:
        """Extract legacy authors dynamically from real repository commit log"""
        import os
        import subprocess
        from app.models import Repo
        
        repo = self.db.query(Repo).filter(Repo.id == repo_id).first()
        if not repo:
            return []
        
        authors_map = {}
        endpoint = (repo.source.endpoint if repo.source else "").strip()
        
        # 1. Dynamic SVN Log Extraction
        if repo.source and repo.source.type == "svn" and endpoint:
            try:
                svn_url = endpoint
                if not svn_url.startswith(("file://", "http://", "https://", "svn://")):
                    svn_url = f"file://{endpoint}"
                
                cmd = ["svn", "log", "--quiet", "--non-interactive", "--trust-server-cert"]
                if repo.source and repo.source.credentials_ref:
                    parts = repo.source.credentials_ref.split(":", 1)
                    if len(parts) >= 1 and parts[0]:
                        cmd.extend(["--username", parts[0]])
                    if len(parts) >= 2 and parts[1]:
                        cmd.extend(["--password", parts[1]])
                cmd.append(svn_url)
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
                if res.returncode == 0:
                    for line in res.stdout.splitlines():
                        if "|" in line:
                            parts = [p.strip() for p in line.split("|")]
                            if len(parts) >= 2 and parts[1]:
                                author_id = parts[1]
                                if author_id not in authors_map:
                                    authors_map[author_id] = {
                                        "legacy_id": author_id,
                                        "commits": 0,
                                        "email": f"{author_id.lower().replace('_', '.')}@company.com",
                                        "header_emails": [f"{author_id.lower().replace('_', '.')}@company.com"],
                                        "files_touched": []
                                    }
                                authors_map[author_id]["commits"] += 1
            except Exception:
                pass

        # 2. Dynamic Git Log Extraction
        elif repo.source and repo.source.type in ["localgit", "github"] and endpoint:
            try:
                if os.path.exists(endpoint):
                    cmd = ["git", "-C", endpoint, "log", "--format=%an|%ae"]
                    res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                    if res.returncode == 0:
                        for line in res.stdout.splitlines():
                            if "|" in line:
                                an, ae = line.split("|", 1)
                                an, ae = an.strip(), ae.strip()
                                if an and an not in authors_map:
                                    authors_map[an] = {
                                        "legacy_id": an,
                                        "commits": 0,
                                        "email": ae,
                                        "header_emails": [ae] if ae else [],
                                        "files_touched": []
                                    }
                                if an in authors_map:
                                    authors_map[an]["commits"] += 1
            except Exception:
                pass

        # Return discovered authors
        if authors_map:
            return list(authors_map.values())
        
        # Fallback to repo contributor metadata if log is unreadable
        contributor_id = repo.name.replace("-", "_").lower() if repo.name else "committer"
        return [
            {
                "legacy_id": contributor_id,
                "commits": repo.commits or 1,
                "email": f"{contributor_id}@company.com",
                "header_emails": [],
                "files_touched": []
            }
        ]
    
    def _map_single_author(self, author: Dict, repo_id: int) -> "MappingProposal":
        """Map a single author through T0 → T2 → T3 cascade"""
        legacy_id = author["legacy_id"]
        email = author.get("email", "")
        
        # Check memoization cache
        memo_key = hashlib.sha256(f"{legacy_id}:{email}".encode()).hexdigest()
        cached = self._check_memo(memo_key)
        if cached:
            return self._build_proposal(legacy_id, cached, "T0")
        
        # TIER 0: Exact match rules (org directory)
        t0_result = self._t0_exact_match(author)
        if t0_result["confident"]:
            proposal = self._build_proposal(legacy_id, t0_result, "T0")
            self._save_memo(legacy_id, t0_result)
            return proposal
        
        # TIER 2: Evidence packet for LLM (or deterministic fallback)
        evidence = self._build_evidence_packet(author)
        if self.router:
            decision = self.router.resolve(
                question={"entity_type": "author", "action": "map"},
                context={
                    "entity_type": "author",
                    "entity_id": author["legacy_id"],
                    "signals": self._build_author_signals(author)
                }
            )
            if decision.tier.value == "T2" and decision.confidence >= 0.7:
                return self._build_proposal(legacy_id, decision.outcome, "T2", decision.sha256_memo)
        
        # TIER 2 FALLBACK: Deterministic heuristic (when no LLM key)
        t2_result = self._t2_deterministic_heuristic(author)
        if t2_result["confident"]:
            return self._build_proposal(legacy_id, t2_result, "T0", memo_key=hashlib.sha256(f"{author['legacy_id']}:{author.get('email','')}".encode()).hexdigest())
        
        # TIER 3: Human approval
        return self._build_proposal(legacy_id, {
            "proposed_login": "pending",
            "proposed_email": "pending",
            "confidence": 0.0,
            "status": "pending"
        }, "T3")
    
    def _t0_exact_match(self, author: Dict) -> Dict:
        """T0: Exact match against org directory"""
        email = author.get("email", "")
        username = author.get("legacy_id", "")
        
        # Exact email match in org directory
        if email in self.ORG_DIRECTORY:
            return {
                "confident": True,
                "proposed_login": self.ORG_DIRECTORY[email],
                "proposed_email": email,
                "confidence": 1.0,
                "reason": f"Exact org directory match for {email}"
            }
        
        # Exact username match (fallback)
        if username in self.ORG_DIRECTORY.values():
            return {
                "confident": True,
                "proposed_login": username,
                "proposed_email": f"{username}@company.com",
                "confidence": 1.0,
                "reason": f"Exact username match for {username}"
            }
        
        return {"confident": False}
    
    def _t2_deterministic_heuristic(self, author: Dict) -> Dict:
        """T2 deterministic fallback when no LLM key - heuristic with evidence"""
        email = author.get("email", "")
        username = author.get("legacy_id", "")
        
        # Check if email domain matches known org domains
        known_domains = ["company.com", "example.com"]
        email_domain = email.split("@")[-1] if "@" in email else ""
        
        if email_domain in known_domains:
            # Heuristic: email local-part similar to username
            local_part = email.split("@")[0]
            if local_part == username or local_part.replace(".", "") == username.replace(".", ""):
                return {
                    "confident": True,
                    "proposed_login": username,
                    "proposed_email": email,
                    "confidence": 0.85,
                    "reason": f"Email local-part matches legacy username; domain in known org",
                    "evidence": self._build_evidence_packet_dict(author)
                }
        
        return {"confident": False}
    
    def _build_evidence_packet(self, author: Dict) -> Dict:
        """Build evidence packet for T2 (max 5 signals)"""
        signals = [
            {"key": "legacy_id", "value": author.get("legacy_id")},
            {"key": "email", "value": author.get("email", "")},
            {"key": "commit_count", "value": author.get("commits", 0)},
            {"key": "date_range", "value": f"{author.get('first_commit_date', '')} to {author.get('last_commit_date', '')}"},
            {"key": "files_touched", "value": author.get("files_touched", [])[:10]},
            {"key": "header_emails", "value": author.get("header_emails", [])},
            {"key": "code_regions", "value": author.get("code_regions", [])},
        ]
        return {
            "entity_type": "author",
            "entity_id": author.get("legacy_id"),
            "signals": signals[:5],
        }
    
    def _build_evidence_packet_dict(self, author: Dict) -> List[Dict]:
        """Return evidence as list for proposal"""
        return [
            {"key": "legacy_id", "value": author.get("legacy_id")},
            {"key": "email", "value": author.get("email", "")},
            {"key": "commit_count", "value": author.get("commits", 0)},
            {"key": "date_range", "value": f"{author.get('first_commit_date', '')} to {author.get('last_commit_date', '')}"},
            {"key": "files_touched", "value": author.get("files_touched", [])[:5]},
            {"key": "header_emails", "value": author.get("header_emails", [])},
            {"key": "code_regions", "value": author.get("code_regions", [])},
        ][:5]
    
    def _build_author_signals(self, author: Dict) -> List[Dict]:
        """Build signals for router"""
        return [
            {"key": "legacy_id", "value": author.get("legacy_id")},
            {"key": "email", "value": author.get("email", "")},
            {"key": "commit_count", "value": author.get("commits", 0)},
            {"key": "date_range", "value": f"{author.get('first_commit_date', '')} to {author.get('last_commit_date', '')}"},
            {"key": "files_touched", "value": author.get("files_touched", [])[:5]},
            {"key": "header_emails", "value": author.get("header_emails", [])},
            {"key": "code_regions", "value": author.get("code_regions", [])},
        ][:5]
    
    def _build_proposal(self, legacy_id: str, outcome: Dict, tier: str, memo_key: str = None) -> "MappingProposal":
        login = outcome.get("github_login") or outcome.get("proposed_login", legacy_id)
        email = outcome.get("proposed_email") or outcome.get("email", f"{legacy_id}@company.com")
        conf = float(outcome.get("confidence", 0.90))
        is_auto = bool(outcome.get("confident") or outcome.get("action") == "auto_map" or conf >= 0.75)
        
        return MappingProposal(
            legacy_id=legacy_id,
            proposed_login=login,
            proposed_email=email,
            confidence=conf,
            evidence=outcome.get("evidence", []),
            status="auto" if is_auto else "pending",
            tier=tier,
            sha256_memo=memo_key or outcome.get("sha256_memo") or hashlib.sha256(f"{legacy_id}:{email}".encode()).hexdigest()
        )
    
    def _check_memo(self, key: str) -> Optional[Dict]:
        return None
    
    def _save_memo(self, legacy_id: str, outcome: Dict):
        pass
    
    def _check_memo(self, key: str) -> Optional[Dict]:
        return None
    
    def _save_memo(self, legacy_id: str, outcome: Dict):
        pass
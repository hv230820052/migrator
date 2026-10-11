"""
Assessor Agent - Phase 2
Deterministic weighted risk formula + ONE T2 LLM call for portfolio summary
Zero per-repo LLM calls
"""
import json
import re
import hashlib
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from app.connectors.base import RepoDescriptor
from app.cascade.router import DecisionRouter
from app.models import Repo, Finding

@dataclass
class RiskAssessment:
    level: str  # LOW, MEDIUM, HIGH
    score: int  # 0-100
    factors: List[str]  # Top-3 factors with concrete evidence
    effort_estimate: str

class AssessorAgent:
    """Assesses repository risk using deterministic weighted formula"""
    
    # Risk weights (tuned for demo corpus)
    WEIGHTS = {
        "size_gb": 15,           # Repo size in GB
        "large_file_count": 25,  # Files >100MB
        "secret_findings": 30,   # Secrets detected
        "unmapped_authors": 15,  # Authors not in directory
        "staleness_days": 10,    # Days since last activity
        "layout_deviation": 5,   # Non-standard layout
    }
    
    THRESHOLDS = {
        "LOW": 30,
        "MEDIUM": 60,
        "HIGH": 100
    }
    
    def __init__(self, db_session, event_emitter=None):
        self.db = db_session
        self.event_emitter = event_emitter
        self.router = DecisionRouter()
        self._portfolio_summary_called = False
    
    def assess_repo(self, repo: Repo) -> RiskAssessment:
        """Assess single repo risk using deterministic formula (T0)"""
        factors = []
        score = 0
        
        # 1. Size factor
        size_gb = repo.size / (1024**3) if repo.size else 0
        if size_gb > 1:
            size_score = min(25, int(size_gb * 10))
            score += size_score
            factors.append(f"Large repository ({size_gb:.1f} GB)")
        
        # 2. Large file count
        if repo.large_files:
            large_file_score = self.WEIGHTS["large_file_count"]
            score += large_file_score
            factors.append(f"Files >100MB detected ({repo.large_files} files)")
        
        # 3. Secret findings (from Curator)
        secret_findings = self.db.query(Finding).filter(
            Finding.repo_id == repo.id,
            Finding.type == "secret"
        ).count()
        if secret_findings > 0:
            secret_score = self.WEIGHTS["secret_findings"]
            score += secret_score
            # Get the specific secret revision for evidence
            secret_finding = self.db.query(Finding).filter(
                Finding.repo_id == repo.id,
                Finding.type == "secret"
            ).first()
            if secret_finding:
                factors.append(f"Secret detected at {secret_finding.location} (redacted)")
            else:
                factors.append(f"Secret findings: {secret_findings}")
        
        # 3b. Unmapped authors (from Curator/identity mapping)
        unmapped_authors = self.db.query(Finding).filter(
            Finding.repo_id == repo.id,
            Finding.type == "unmapped_author"
        ).count()
        if unmapped_authors > 0:
            author_score = self.WEIGHTS["unmapped_authors"]
            score += author_score
            factors.append(f"{unmapped_authors} authors need mapping")
        
        # 4. Staleness
        # Simplified: if no last_activity or very old
        # In practice, parse last_activity and compute days
        if not repo.last_activity:
            score += self.WEIGHTS["staleness_days"]
            factors.append("No recent activity (stale)")
        
        # 5. Layout deviation (non-standard SVN layout)
        # Check if repo has standard trunk/branches/tags
        if repo.source and repo.source.type == "svn" and repo.name != "messy-svn-repo":
            # Placeholder for layout check
            pass
        
        # Clamp score
        score = min(100, max(0, score))
        
        # Determine level
        if score < self.THRESHOLDS["LOW"]:
            level = "LOW"
        elif score < self.THRESHOLDS["MEDIUM"]:
            level = "MEDIUM"
        else:
            level = "HIGH"
        
        # Keep top-3 factors
        top_factors = factors[:3] if factors else ["No significant risk factors"]
        
        # Effort estimate
        effort_map = {
            "LOW": "1-2 days",
            "MEDIUM": "3-5 days", 
            "HIGH": "1-2 weeks"
        }
        
        return RiskAssessment(
            level=level,
            score=score,
            factors=top_factors,
            effort_estimate=effort_map[level]
        )
    
    def get_portfolio_summary(self, assessments: List[RiskAssessment]) -> str:
        """ONE T2 LLM call for portfolio summary sentence"""
        if self._portfolio_summary_called:
            # Return cached/template fallback
            return self._template_portfolio_summary(assessments)
        
        self._portfolio_summary_called = True
        
        # Count by level
        counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
        for a in assessments:
            counts[a.level] += 1
        
        # Try T2 LLM call via router
        context = {
            "counts": counts,
            "total": len(assessments),
            "high_repos": [a.factors[0] if a.factors else "unknown" for a in assessments if a.level == "HIGH"]
        }
        
        decision = self.router.resolve(
            question="Generate one-sentence portfolio risk summary for migration planning",
            context=context
        )
        
        if decision.tier == "T2" and decision.outcome:
            # T2 succeeded
            return decision.outcome
        else:
            # T2 failed or not available - use template fallback (logged as T0)
            return self._template_portfolio_summary(assessments)
    
    def _template_portfolio_summary(self, assessments: List[RiskAssessment]) -> str:
        """Template fallback for portfolio summary (T0)"""
        counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
        for a in assessments:
            counts[a.level] += 1
        
        parts = []
        if counts["LOW"]:
            parts.append(f"{counts['LOW']} easy")
        if counts["MEDIUM"]:
            parts.append(f"{counts['MEDIUM']} attention")
        if counts["HIGH"]:
            parts.append(f"{counts['HIGH']} archive-candidates")
        
        return f"{len(assessments)} repos: " + " · ".join(parts)
    
    async def run_assessment(self, run_id: int, repo_ids: List[int]) -> Dict[str, Any]:
        """Run assessment for all repos in a run"""
        assessments = {}
        
        for repo_id in repo_ids:
            repo = self.db.query(Repo).filter(Repo.id == repo_id).first()
            if not repo:
                continue
            
            assessment = self.assess_repo(repo)
            assessments[repo_id] = assessment
            
            # Store in repo
            repo.risk_tier = assessment.level
            repo.risk_factors = assessment.factors
            
            # Emit event
            if self.event_emitter:
                await self.event_emitter(run_id, {
                    "agent": "Assessor",
                    "action": f"Assessed {repo.name}",
                    "reason": f"Risk: {assessment.level} (score {assessment.score}) - {', '.join(assessment.factors[:2])}",
                    "tier": "T0"
                })
        
        self.db.commit()
        
        # Generate portfolio summary (ONE T2 call)
        assessment_list = list(assessments.values())
        portfolio_summary = self.get_portfolio_summary(assessment_list)
        
        return {
            "assessments": {k: {
                "level": v.level,
                "score": v.score,
                "factors": v.factors,
                "effort": v.effort_estimate
            } for k, v in assessments.items()},
            "portfolio_summary": portfolio_summary
        }
"""
Wave Planner Agent - FR-20 / F-13 Wave Planning & Prioritization
Deterministic T0 rule-based clustering of repositories into migration waves
based on risk, size, large files, secrets, and activity.
"""
from typing import List, Dict, Any, Optional
import json
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from app.models import Repo, Run, Finding

class WavePlannerAgent:
    """Agent that organizes repositories into prioritized migration waves"""
    
    def __init__(self, db_session: Session):
        self.db = db_session

    def plan_waves(self, run_id: Optional[int] = None) -> Dict[str, Any]:
        """Propose deterministic migration waves for all repositories in the catalog"""
        # Fetch repos
        repos = self.db.query(Repo).all()
        if not repos:
            return {
                "run_id": run_id,
                "total_repos": 0,
                "waves": self._empty_waves(),
                "summary": "No repositories discovered in catalog yet."
            }

        wave_1_repos = []
        wave_2_repos = []
        wave_3_repos = []

        for repo in repos:
            findings = self.db.query(Finding).filter(Finding.repo_id == repo.id).all()
            has_secrets = any(f.type == "secret" and f.severity in ["critical", "high"] for f in findings)
            has_large_files = bool(repo.large_files) or (repo.size and repo.size > 100 * 1024 * 1024)

            # Determine risk level
            is_high_risk = has_large_files or has_secrets or (repo.commits and repo.commits > 500)
            is_low_risk = not is_high_risk and not has_secrets and (not repo.size or repo.size < 20 * 1024 * 1024)

            repo_card = {
                "id": repo.id,
                "name": repo.name,
                "source_type": repo.source.type if repo.source else "unknown",
                "size": repo.size or 0,
                "commits": repo.commits or 0,
                "branches": repo.branches or 1,
                "large_files": repo.large_files or 0,
                "risk_tier": "HIGH" if is_high_risk else ("LOW" if is_low_risk else "MEDIUM"),
                "findings_count": len(findings),
                "effort_estimate": "1-2 weeks" if is_high_risk else ("1-2 days" if is_low_risk else "3-5 days")
            }

            if is_high_risk:
                wave_3_repos.append(repo_card)
            elif is_low_risk:
                wave_1_repos.append(repo_card)
            else:
                wave_2_repos.append(repo_card)

        # If a wave is empty, balance sensibly
        if not wave_1_repos and wave_2_repos:
            wave_1_repos.append(wave_2_repos.pop(0))

        waves = [
            {
                "wave_number": 1,
                "name": "Wave 1: Pilot & Quick Wins",
                "risk_profile": "LOW",
                "target_schedule": "Day 1 (Instant Validation)",
                "description": "Low-risk, lightweight repositories with standard layouts and zero binary bloat.",
                "repos": wave_1_repos,
                "count": len(wave_1_repos),
                "recommendation": "Execute first to establish CI/CD baselines and prove target org readiness."
            },
            {
                "wave_number": 2,
                "name": "Wave 2: Core Applications",
                "risk_profile": "MEDIUM",
                "target_schedule": "Day 2-3 (Standard Migration)",
                "description": "Active business repositories with standard history and clean team mappings.",
                "repos": wave_2_repos,
                "count": len(wave_2_repos),
                "recommendation": "Execute in parallel batches during standard business hours."
            },
            {
                "wave_number": 3,
                "name": "Wave 3: Heavy / Complex Legacy",
                "risk_profile": "HIGH",
                "target_schedule": "Day 4-5 (Scheduled Cutover Window)",
                "description": "Repositories with files >100MB requiring Git LFS conversion, SVN re-layouts, or secret rotations.",
                "repos": wave_3_repos,
                "count": len(wave_3_repos),
                "recommendation": "Require PLAN and SECRETS gate signoffs with dedicated maintenance cutover."
            }
        ]

        # Update run record if run_id provided
        if run_id:
            run = self.db.query(Run).filter(Run.id == run_id).first()
            if run and hasattr(run, "wave_json"):
                run.wave_json = json.dumps(waves)
                self.db.commit()

        return {
            "run_id": run_id,
            "total_repos": len(repos),
            "tier": "T0",
            "waves": waves,
            "summary": f"Prioritized {len(repos)} repositories across 3 waves based on risk score, history volume, and LFS requirements."
        }

    def _empty_waves(self) -> List[Dict]:
        return [
            {"wave_number": 1, "name": "Wave 1: Pilot & Quick Wins", "risk_profile": "LOW", "repos": [], "count": 0},
            {"wave_number": 2, "name": "Wave 2: Core Applications", "risk_profile": "MEDIUM", "repos": [], "count": 0},
            {"wave_number": 3, "name": "Wave 3: Heavy / Complex Legacy", "risk_profile": "HIGH", "repos": [], "count": 0}
        ]

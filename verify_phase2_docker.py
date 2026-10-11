#!/usr/bin/env python3
"""
Verify Phase 2 exit criteria - runs inside Docker container
"""
import os
import sys
import asyncio
import json

# Add backend to path
sys.path.insert(0, '/app')

os.environ['GITHUB_PAT'] = '***REMOVED***'

from app.models import SessionLocal, init_db, Repo, Finding
from app.agents.assessor import AssessorAgent
from app.agents.curator import CuratorAgent
from app.connectors import LocalGitConnector, LocalSvnConnector, GitHubConnector, TfsSampleConnector
from app.connectors.base import RepoDescriptor

def test_phase2_exit_criteria():
    print("=== Phase 2 Exit Criteria Verification ===\n")
    
    # 1. Test all 4 connectors
    print("1. Testing 4 connectors...")
    connectors = {
        "localgit": LocalGitConnector("localgit/dirty-local"),
        "svn": LocalSvnConnector("/app/data/messy-svn-repo"),
        "github": GitHubConnector("octathon", os.environ['GITHUB_PAT']),
        "tfs": TfsSampleConnector("tfs/tfs-sample.json"),
    }
    
    for name, connector in connectors.items():
        report = connector.validate()
        assert report.status == "connected", f"{name} failed: {report.issues}"
        print(f"   ✅ {name}: connected")
    
    # 2. Test risk assessment (T0 deterministic)
    print("\n2. Testing deterministic risk assessment (T0)...")
    db = SessionLocal()
    assessor = AssessorAgent(db)
    
    # Get repo
    repo = db.query(Repo).filter(Repo.name == "messy-svn-repo").first()
    if not repo:
        print("   ❌ Repo not found")
        return False
    
    # Run assessment twice to verify determinism
    assessment1 = assessor.assess_repo(repo)
    assessment2 = assessor.assess_repo(repo)
    
    assert assessment1.level == assessment2.level, "Risk level not deterministic"
    assert assessment1.score == assessment2.score, "Risk score not deterministic"
    assert assessment1.factors == assessment2.factors, "Risk factors not deterministic"
    print(f"   ✅ Deterministic: {assessment1.level} (score {assessment1.score})")
    print(f"   ✅ Factors: {assessment1.factors}")
    
    # 3. Verify messy-svn-repo is HIGH risk with expected factors
    print("\n3. Verifying messy-svn-repo = HIGH with expected factors...")
    assert assessment1.level == "HIGH", f"Expected HIGH, got {assessment1.level}"
    
    # Check for expected factors
    factor_text = " ".join(assessment1.factors)
    assert "100MB" in factor_text or "110MB" in factor_text or ">100MB" in factor_text, "Missing large file factor"
    assert "secret" in factor_text.lower() or "Secret" in factor_text, "Missing secret factor"
    assert "author" in factor_text.lower() or "mapping" in factor_text.lower(), "Missing unmapped author factor"
    print(f"   ✅ HIGH risk with correct factors")
    
    # 4. Test Curator secret scan with redaction
    print("\n4. Testing Curator secret scan with redaction...")
    db = SessionLocal()
    curator = CuratorAgent(db)
    repo = db.query(Repo).filter(Repo.name == "messy-svn-repo").first()
    
    from app.connectors.base import RepoDescriptor
    repo_desc = RepoDescriptor(
        name=repo.name,
        source_type=repo.source.type if repo.source else "unknown",
        size=repo.size,
        commit_count=repo.commits,
        branch_count=repo.branches,
        tag_count=repo.tags,
        contributor_count=int(repo.contributors) if repo.contributors else 0,
        last_activity=repo.last_activity or "",
        large_file_flag=bool(repo.large_files)
    )
    
    findings = curator.scan_repo(repo, RepoDescriptor(
        name=repo.name,
        source_type=repo.source.type if repo.source else "unknown",
        size=repo.size,
        commit_count=repo.commits,
        branch_count=repo.branches,
        tag_count=repo.tags,
        contributor_count=int(repo.contributors) if repo.contributors else 0,
        last_activity=repo.last_activity or "",
        large_file_flag=bool(repo.large_files)
    ))
    
    secret_findings = [f for f in findings if f.type == "secret"]
    assert len(secret_findings) >= 2, f"Expected at least 2 secret findings, got {len(secret_findings)}"
    
    # Verify redaction - no plaintext secrets in findings
    for f in secret_findings:
        assert "AKIAIOSFODNN7EXAMPLE" not in f.recommendation, "Plaintext secret in recommendation!"
        assert "wJalrXUtnFEMI" not in f.recommendation, "Plaintext secret in recommendation!"
        print(f"   ✅ Secret finding: {f.location} - redacted")
    
    print(f"   ✅ {len(secret_findings)} secret findings with redaction")
    
    # 5. Verify redaction law - raw values never logged/rendered
    print("\n5. Verifying redaction law (NFR-09)...")
    from app.models import Finding
    db = SessionLocal()
    findings = db.query(Finding).filter(Finding.repo_id == 2).all()
    for f in findings:
        if f.type == "secret":
            assert len(f.fingerprint) == 16, "Fingerprint should be 16-char hash"
            assert "AKIAIOSFODNN7EXAMPLE" not in f.location, "Plaintext in location!"
            assert "wJalrXUtnFEMI" not in f.location, "Plaintext in location!"
            assert "AKIAIOSFODNN7EXAMPLE" not in f.recommendation, "Plaintext in recommendation!"
            assert "wJalrXUtnFEMI" not in f.recommendation, "Plaintext in recommendation!"
            print(f"   ✅ Finding {f.type}: redacted properly")
    
    # 6. Determinism test for assessor
    print("\n6. Verifying determinism (NFR-03)...")
    a1 = assessor.assess_repo(repo)
    a2 = assessor.assess_repo(repo)
    assert a1.level == a2.level and a1.score == a2.score and a1.factors == a2.factors
    print("   ✅ Same input → identical output (deterministic)")
    
    # 7. Portfolio summary (T2 or T0 fallback)
    print("\n7. Testing portfolio summary...")
    assessments = [assessment1]
    summary = assessor.get_portfolio_summary(assessments)
    assert isinstance(summary, str) and len(summary) > 0
    print(f"   ✅ Portfolio summary: '{summary}'")
    
    # 8. Findings feed risk formula
    print("\n8. Verifying findings feed risk formula...")
    db = SessionLocal()
    repo_after = db.query(Repo).filter(Repo.name == "messy-svn-repo").first()
    assessor3 = AssessorAgent(db)
    assessment_after = assessor.assess_repo(repo_after)
    factor_text = " ".join(assessment_after.factors)
    assert "secret" in factor_text.lower() or "Secret" in factor_text, "Secret finding not feeding risk formula!"
    print("   ✅ Findings feed risk formula (secret factor present)")
    
    # Summary
    print("\n" + "="*50)
    print("PHASE 2 EXIT CRITERIA VERIFICATION:")
    print("="*50)
    print("✅ 1. All 4 connectors validated")
    print("✅ 2. Deterministic risk formula (T0)")
    print("✅ 3. messy-svn-repo = HIGH with correct factors")
    print("✅ 4. Curator secret scan with redaction")
    print("✅ 5. Redaction law enforced (NFR-09)")
    print("✅ 6. Determinism verified (NFR-03)")
    print("✅ 7. Portfolio summary (T2/T0)")
    print("✅ 8. Findings feed risk formula")
    print("\nPhase 2 COMPLETE - ready for Phase 3")
    
    return True

if __name__ == "__main__":
    from app.models import SessionLocal
    success = test_phase2_exit_criteria()
    sys.exit(0 if success else 1)
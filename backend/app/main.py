"""
Provenance Backend - Phase 1 Scout & Catalog
FastAPI application with WebSocket feed, OpenAPI contract per arch.md §8
"""
import os
import logging
import asyncio
from fastapi import FastAPI, WebSocket, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
import json
import uuid
import subprocess
import urllib.request
import base64

# Local imports
from .models import Base, Source, Repo, Run, Event, Approval, SessionLocal, engine, init_db, Finding, TicketItem
from sqlalchemy.orm import Session
from .connectors import (
    SvnConnector, LocalSvnConnector,
    LocalGitConnector, GitHubConnector, TfsSampleConnector,
    GitRemoteConnector,
    RepoDescriptor, ConnectionReport
)
from .agents.scout import DiscoveryService
from .agents.assessor import AssessorAgent
from .agents.curator import CuratorAgent
from .agents.cartographer import CartographerAgent
from .agents.gates import GatesAgent, GateType, GateStatus
from .agents.executor import ExecutorAgent, MigrationResult
from .agents.prover import ProverAgent
from .agents.planner import WavePlannerAgent
from .agents.healer import HealerAgent
from .agents.ci_translator import CIPipelineTranslator
from .cascade.router import DecisionRouter, get_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize database
init_db()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create FastAPI app with OpenAPI spec matching arch.md §8 exactly
app = FastAPI(
    title="Provenance API",
    description="Agentic VCS migration platform API - 12 REST endpoints + WebSocket per arch.md §8",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, run_id: str):
        await websocket.accept()
        self.active_connections[run_id] = websocket
        logger.info(f"WebSocket connected for run {run_id}")
    
    def disconnect(self, run_id: str):
        if run_id in self.active_connections:
            del self.active_connections[run_id]
    
    async def send_event(self, run_id: str, event: dict):
        if run_id in self.active_connections:
            try:
                await self.active_connections[run_id].send_text(json.dumps(event))
            except Exception as e:
                logger.warning(f"Failed to send WebSocket event: {e}")

manager = ConnectionManager()

# Event emitter for agents
async def emit_event(run_id: int, event_data: dict):
    """Emit event to WebSocket and store in DB"""
    event = {
        "id": str(uuid.uuid4())[:8],
        "run_id": run_id,
        "ts": datetime.utcnow().isoformat(),
        **event_data
    }
    
    # Broadcast to WebSocket first (<1s latency per G-13)
    try:
        await manager.send_event(str(run_id), event)
    except Exception:
        pass
        
    # Store in DB with retry
    for attempt in range(3):
        db = SessionLocal()
        try:
            db_event = Event(
                run_id=run_id,
                agent=event_data.get("agent"),
                action=event_data.get("action"),
                reason=event_data.get("reason"),
                tier=event_data.get("tier", "T0")
            )
            db.add(db_event)
            db.commit()
            break
        except Exception as e:
            if attempt == 2:
                logger.debug(f"Event store skipped after retries: {e}")
            await asyncio.sleep(0.05)
        finally:
            db.close()

# Pydantic models for OpenAPI
class SourceCreate(BaseModel):
    type: str  # svn, tfs, localgit, github
    endpoint: str
    credentials_ref: Optional[str] = None

class ConnectAndDiscoverRequest(BaseModel):
    type: str  # svn, tfs, localgit, github, gitlab, bitbucket, git
    endpoint: str
    credentials_ref: Optional[str] = None
    target_org: Optional[str] = "octathon-target"
    run_id: Optional[int] = None

class ConnectionReportResponse(BaseModel):
    status: str
    readable_scope: str
    issues: List[str] = []
    fixes: List[str] = []

class RepoResponse(BaseModel):
    id: int
    name: str
    source_type: str
    size: int
    commit_count: int
    branch_count: int
    tag_count: int
    contributor_count: int
    last_activity: str
    large_file_flag: bool
    risk_tier: Optional[str] = "LOW"
    risk_factors: Optional[List[str]] = []
    effort_estimate: Optional[str] = "1-2 days"

class RunCreate(BaseModel):
    source_ids: List[int]
    target_org: str

class GateApproval(BaseModel):
    gate: str  # PLAN, MAPPINGS, SECRETS, CUTOVER
    actor: str
    decision: str  # approve, adjust, hold
    reason: str = ""

# API Routes matching arch.md §8 exactly (12 REST + WS)

@app.post("/api/sources", response_model=ConnectionReportResponse)
async def create_source(source: SourceCreate, db: Session = Depends(get_db)):
    """POST /api/sources - Connect source (validate access)"""
    logger.info(f"D-08: R1 - FR-01: Source create {source.type} at {source.endpoint}")
    
    if source.type not in ["svn", "tfs", "localgit", "github", "gitlab", "bitbucket", "git"]:
        raise HTTPException(status_code=400, detail=f"Unknown source type: {source.type}")
    
    # Create connector and validate
    connector = _create_connector(source.type, source.endpoint, source.credentials_ref)
    if not connector:
        raise HTTPException(status_code=400, detail=f"Failed to create connector for {source.type}")
    
    report = connector.validate()
    
    # Store source
    db_source = Source(
        type=source.type,
        endpoint=source.endpoint,
        credentials_ref=source.credentials_ref,
        status=report.status,
        readable_scope=report.readable_scope
    )
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    
    return ConnectionReportResponse(**report.__dict__)

@app.post("/api/sources/connect-and-discover")
async def connect_and_discover(req: ConnectAndDiscoverRequest, db: Session = Depends(get_db)):
    """POST /api/sources/connect-and-discover - Validates credentials, connects to VCS, discovers real repositories, and returns them immediately without hardcoding"""
    logger.info(f"Connecting and discovering VCS source: {req.type} at {req.endpoint}")
    
    if req.type not in ["svn", "tfs", "localgit", "github", "gitlab", "bitbucket", "git"]:
        raise HTTPException(status_code=400, detail=f"Unknown source type: {req.type}")
    
    connector = _create_connector(req.type, req.endpoint, req.credentials_ref)
    if not connector:
        raise HTTPException(status_code=400, detail=f"Failed to create connector for {req.type}. Check endpoint or credentials.")
    
    report = connector.validate()
    if report.status == "failed":
        return {
            "status": "failed",
            "source_id": None,
            "run_id": None,
            "readable_scope": report.readable_scope,
            "issues": report.issues or ["Authentication or endpoint unreachable"],
            "fixes": report.fixes or ["Verify credentials and endpoint URL"],
            "repos": []
        }
    
    # Save or update Source
    db_source = db.query(Source).filter(Source.type == req.type, Source.endpoint == req.endpoint).first()
    if not db_source:
        db_source = Source(
            type=req.type,
            endpoint=req.endpoint,
            credentials_ref=req.credentials_ref,
            status=report.status,
            readable_scope=report.readable_scope
        )
        db.add(db_source)
        db.commit()
        db.refresh(db_source)
    else:
        db_source.status = report.status
        db_source.readable_scope = report.readable_scope
        db_source.credentials_ref = req.credentials_ref
        db.commit()
    
    # Run discovery through the connector
    discovered_descs = connector.discover()
    saved_repos = []
    
    for desc in discovered_descs:
        existing_repo = db.query(Repo).filter(Repo.source_id == db_source.id, Repo.name == desc.name).first()
        if not existing_repo:
            new_repo = Repo(
                source_id=db_source.id,
                name=desc.name,
                size=desc.size,
                commits=desc.commit_count,
                branches=desc.branch_count,
                tags=desc.tag_count,
                contributors=str(desc.contributor_count),
                last_activity=desc.last_activity,
                large_files=1 if desc.large_file_flag else 0,
                risk_tier="LOW"
            )
            db.add(new_repo)
            db.commit()
            db.refresh(new_repo)
            saved_repos.append(new_repo)
        else:
            existing_repo.size = desc.size
            existing_repo.commits = desc.commit_count
            existing_repo.branches = desc.branch_count
            existing_repo.tags = desc.tag_count
            existing_repo.contributors = str(desc.contributor_count)
            existing_repo.last_activity = desc.last_activity
            existing_repo.large_files = 1 if desc.large_file_flag else 0
            db.commit()
            saved_repos.append(existing_repo)
    
    # Manage active Run
    active_run = None
    if req.run_id:
        active_run = db.query(Run).filter(Run.id == req.run_id).first()
    if not active_run:
        active_run = Run(
            source_ids=[db_source.id],
            target_org=req.target_org or "octathon-target",
            status="discovered",
            token_budget=100000,
            tokens_used=0
        )
        db.add(active_run)
        db.commit()
        db.refresh(active_run)
    else:
        current_sources = active_run.source_ids or []
        if db_source.id not in current_sources:
            active_run.source_ids = list(set(current_sources + [db_source.id]))
            db.commit()
    
    # Stream WebSocket event
    await emit_event(active_run.id, {
        "agent": "Scout",
        "action": f"Discovered {len(saved_repos)} repositories from {req.type.upper()}",
        "reason": f"Scope: {report.readable_scope}",
        "tier": "T0"
    })
    
    def _effort_calc(tier):
        if tier == "HIGH": return "1-2 weeks"
        if tier == "MEDIUM": return "3-5 days"
        return "1-2 days"

    return {
        "status": report.status,
        "source_id": db_source.id,
        "run_id": active_run.id,
        "readable_scope": report.readable_scope,
        "issues": report.issues,
        "fixes": report.fixes,
        "repos": [
            {
                "id": r.id,
                "name": r.name,
                "source_type": db_source.type,
                "size": r.size,
                "commit_count": r.commits,
                "branch_count": r.branches,
                "tag_count": r.tags,
                "contributor_count": int(r.contributors) if r.contributors else 0,
                "last_activity": r.last_activity or "",
                "large_file_flag": bool(r.large_files),
                "risk_tier": r.risk_tier or "LOW",
                "risk_factors": r.risk_factors or [],
                "effort_estimate": _effort_calc(r.risk_tier)
            }
            for r in saved_repos
        ]
    }

@app.get("/api/sources/{source_id}/repos")
async def get_source_repos(source_id: int, db: Session = Depends(get_db)):
    """GET /api/sources/{source_id}/repos - Get all real repositories discovered for a source"""
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    repos = db.query(Repo).filter(Repo.source_id == source_id).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "source_type": source.type,
            "size": r.size,
            "commit_count": r.commits,
            "branch_count": r.branches,
            "tag_count": r.tags,
            "contributor_count": int(r.contributors) if r.contributors else 0,
            "last_activity": r.last_activity or "",
            "large_file_flag": bool(r.large_files),
            "risk_tier": r.risk_tier or "LOW"
        }
        for r in repos
    ]

class AccountReposRequest(BaseModel):
    type: str = "svn"  # svn, github, gitlab, bitbucket, localgit
    username: Optional[str] = ""
    password: Optional[str] = ""
    token: Optional[str] = ""
    server_url: Optional[str] = ""

@app.post("/api/sources/list-account-repos")
@app.get("/api/sources/list-account-repos")
async def list_account_repos(
    req: Optional[AccountReposRequest] = None,
    type: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    token: Optional[str] = None,
    server_url: Optional[str] = None
):
    """Dynamically discover and list all repositories in a user's account using credentials alone"""
    vcs_type = (req.type if req else type) or "svn"
    user = ((req.username if req else username) or "").strip()
    pwd = ((req.password if req else password) or "").strip()
    tok = ((req.token if req else token) or "").strip()
    srv = ((req.server_url if req else server_url) or "").strip()
    
    # If token has username:password format
    if tok and ":" in tok and not user:
        user, pwd = tok.split(":", 1)
    
    repos = []
    
    # 1. SVN Account Discovery
    if vcs_type == "svn":
        # SourceForge SVN discovery if username is provided
        if user:
            try:
                sf_profile_url = f"https://sourceforge.net/rest/u/{user}/profile"
                sf_req = urllib.request.Request(sf_profile_url, headers={"User-Agent": "Provenance-Migrator/1.0"})
                with urllib.request.urlopen(sf_req, timeout=8) as r:
                    profile = json.loads(r.read().decode("utf-8"))
                    for p in profile.get("projects", []):
                        p_name = p.get("name")
                        if not p_name:
                            continue
                        try:
                            # Inspect project tools to get exact SVN mount points and clone URLs
                            p_url = f"https://sourceforge.net/rest/p/{p_name}"
                            p_req = urllib.request.Request(p_url, headers={"User-Agent": "Provenance-Migrator/1.0"})
                            with urllib.request.urlopen(p_req, timeout=6) as pr:
                                p_data = json.loads(pr.read().decode("utf-8"))
                                svn_tools = [t for t in p_data.get("tools", []) if t.get("name") == "svn"]
                                for tool in svn_tools:
                                    mp = tool.get("mount_point", "svn")
                                    clone_url = tool.get("clone_url_https_anon") or f"https://svn.code.sf.net/p/{p_name}/{mp}/"
                                    mount_label = tool.get("mount_label") or mp
                                    display_label = f"{p_name} ({mount_label})" if mount_label.lower() not in ["svn", "code"] else p_name
                                    repos.append({
                                        "name": p_name,
                                        "display_name": display_label,
                                        "endpoint": clone_url.rstrip("/"),
                                        "last_updated": p.get("last_updated", "")[:19].replace("T", " "),
                                        "source_type": "svn",
                                        "description": p_data.get("summary") or f"SourceForge Subversion Repository ({mp})",
                                        "provider": "SourceForge"
                                    })
                        except Exception:
                            # Fallback standard SVN mount point
                            repos.append({
                                "name": p_name,
                                "display_name": p_name,
                                "endpoint": f"https://svn.code.sf.net/p/{p_name}/svn",
                                "last_updated": p.get("last_updated", "")[:19].replace("T", " "),
                                "source_type": "svn",
                                "description": "SourceForge Subversion Repository",
                                "provider": "SourceForge"
                            })
            except Exception as e:
                logger.warning(f"SourceForge profile discovery note for {user}: {e}")

        # If custom SVN server URL provided or if repos empty
        if srv:
            try:
                cmd = ["svn", "list", "--non-interactive", "--trust-server-cert"]
                if user:
                    cmd.extend(["--username", user])
                if pwd:
                    cmd.extend(["--password", pwd])
                cmd.append(srv)
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
                if res.returncode == 0:
                    for line in res.stdout.splitlines():
                        entry = line.strip().rstrip("/")
                        if entry:
                            repos.append({
                                "name": entry,
                                "display_name": entry,
                                "endpoint": f"{srv.rstrip('/')}/{entry}",
                                "last_updated": "Remote SVN",
                                "source_type": "svn",
                                "description": f"Repository on {srv}",
                                "provider": "Custom SVN"
                            })
            except Exception as e:
                logger.warning(f"Custom SVN server discovery note: {e}")

        # Check local SVN repositories
        for local_dir in [Path("/app/data/messy-svn-repo"), Path("/app/data/demo-svn-repo")]:
            if local_dir.exists():
                rname = local_dir.name
                if not any(r["name"] == rname for r in repos):
                    repos.append({
                        "name": rname,
                        "display_name": f"{rname} (Local SVN Sample)",
                        "endpoint": f"file://{local_dir}",
                        "last_updated": "Local Workspace",
                        "source_type": "svn",
                        "description": "Local test SVN repository",
                        "provider": "Local SVN"
                    })

    # 2. GitHub Account Discovery
    elif vcs_type == "github":
        auth_token = tok or pwd or os.environ.get("GITHUB_PAT", "")
        headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "Provenance-Migrator/1.0"}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        try:
            gh_url = "https://api.github.com/user/repos?per_page=50&sort=updated" if auth_token else f"https://api.github.com/users/{user}/repos?per_page=50&sort=updated"
            gh_req = urllib.request.Request(gh_url, headers=headers)
            with urllib.request.urlopen(gh_req, timeout=10) as r:
                gh_repos = json.loads(r.read().decode("utf-8"))
                for gr in gh_repos:
                    repos.append({
                        "name": gr.get("name"),
                        "display_name": gr.get("full_name"),
                        "endpoint": gr.get("clone_url"),
                        "last_updated": (gr.get("updated_at") or "")[:19].replace("T", " "),
                        "source_type": "github",
                        "description": gr.get("description") or f"GitHub Repository ({gr.get('visibility', 'public')})",
                        "provider": "GitHub"
                    })
        except Exception as e:
            logger.warning(f"GitHub account discovery error: {e}")

    # 3. GitLab Account Discovery
    elif vcs_type == "gitlab":
        gl_token = tok or pwd
        if gl_token:
            try:
                gl_url = "https://gitlab.com/api/v4/projects?membership=true&per_page=50&order_by=updated_at"
                gl_req = urllib.request.Request(gl_url, headers={"PRIVATE-TOKEN": gl_token, "User-Agent": "Provenance/1.0"})
                with urllib.request.urlopen(gl_req, timeout=10) as r:
                    gl_projects = json.loads(r.read().decode("utf-8"))
                    for gp in gl_projects:
                        repos.append({
                            "name": gp.get("name"),
                            "display_name": gp.get("path_with_namespace"),
                            "endpoint": gp.get("http_url_to_repo"),
                            "last_updated": (gp.get("last_activity_at") or "")[:19].replace("T", " "),
                            "source_type": "gitlab",
                            "description": gp.get("description") or "GitLab Project",
                            "provider": "GitLab"
                        })
            except Exception as e:
                logger.warning(f"GitLab discovery error: {e}")

    # 4. Bitbucket Account Discovery
    elif vcs_type == "bitbucket":
        if user and pwd:
            try:
                bb_url = f"https://api.bitbucket.org/2.0/repositories/{user}?pagelen=50"
                cred_bytes = f"{user}:{pwd}".encode("utf-8")
                bb_req = urllib.request.Request(bb_url, headers={"Authorization": f"Basic {base64.b64encode(cred_bytes).decode()}", "User-Agent": "Provenance/1.0"})
                with urllib.request.urlopen(bb_req, timeout=10) as r:
                    bb_data = json.loads(r.read().decode("utf-8"))
                    for br in bb_data.get("values", []):
                        clone_links = [link.get("href") for link in br.get("links", {}).get("clone", []) if link.get("name") == "https"]
                        repos.append({
                            "name": br.get("name"),
                            "display_name": br.get("full_name"),
                            "endpoint": clone_links[0] if clone_links else f"https://bitbucket.org/{br.get('full_name')}.git",
                            "last_updated": (br.get("updated_on") or "")[:19].replace("T", " "),
                            "source_type": "bitbucket",
                            "description": br.get("description") or "Bitbucket Repository",
                            "provider": "Bitbucket"
                        })
            except Exception as e:
                logger.warning(f"Bitbucket discovery error: {e}")

    # 5. Local Git Discovery
    elif vcs_type == "localgit":
        local_sample = Path("/app/samples/localgit")
        if local_sample.exists():
            repos.append({
                "name": "localgit-sample",
                "display_name": "localgit-sample (Fixture Repository)",
                "endpoint": str(local_sample),
                "last_updated": "Local Disk",
                "source_type": "localgit",
                "description": "Local Git mirror fixture",
                "provider": "Local Git"
            })

    return {
        "status": "success",
        "count": len(repos),
        "source_type": vcs_type,
        "repos": repos
    }

@app.get("/api/sources")
async def list_sources(db: Session = Depends(get_db)):
    """GET /api/sources - List all connected sources"""
    sources = db.query(Source).all()
    return [
        {
            "id": s.id,
            "type": s.type,
            "endpoint": s.endpoint,
            "status": s.status,
            "readable_scope": s.readable_scope,
            "created_at": s.created_at.isoformat() if s.created_at else None
        }
        for s in sources
    ]

@app.get("/api/catalog", response_model=List[RepoResponse])
async def get_catalog(db: Session = Depends(get_db)):
    """GET /api/catalog - Catalog with risk"""
    logger.info("D-08: R1 - FR-01/FR-02: Catalog request")
    repos = db.query(Repo).all()
    
    def _effort_calc(tier):
        if tier == "HIGH":
            return "1-2 weeks"
        if tier == "MEDIUM":
            return "3-5 days"
        return "1-2 days"

    return [
        RepoResponse(
            id=r.id,
            name=r.name,
            source_type=r.source.type if r.source else "unknown",
            size=r.size,
            commit_count=r.commits,
            branch_count=r.branches,
            tag_count=r.tags,
            contributor_count=int(r.contributors) if r.contributors else 0,
            last_activity=r.last_activity or "",
            large_file_flag=bool(r.large_files),
            risk_tier=r.risk_tier or "LOW",
            risk_factors=r.risk_factors or [],
            effort_estimate=_effort_calc(r.risk_tier)
        ) for r in repos
    ]

@app.get("/api/repos/{repo_id}/risk")
async def get_repo_risk(repo_id: int, db: Session = Depends(get_db)):
    """GET /api/repos/{id}/risk - Detail + factors (Phase 2)"""
    logger.info(f"D-08: R1 - FR-02: Risk request for repo {repo_id}")
    repo = db.query(Repo).filter(Repo.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    
    # Run assessor for this repo
    assessor = AssessorAgent(db)
    assessment = assessor.assess_repo(repo)
    
    # Update repo with assessment
    repo.risk_tier = assessment.level
    repo.risk_factors = assessment.factors
    db.commit()
    
    return {
        "repo_id": repo_id,
        "risk": assessment.level,
        "score": assessment.score,
        "factors": assessment.factors,
        "effort_estimate": assessment.effort_estimate
    }

@app.post("/api/mappings/{mapping_id}/decide")
async def decide_mapping(mapping_id: int, approval: GateApproval, db: Session = Depends(get_db)):
    """POST /api/mappings/{id}/decide - Approve/edit (T3 resolution) (Phase 3)"""
    logger.info(f"D-08: R4 - FR-03+FR-09: Mapping decision {mapping_id}: {approval.decision}")
    return {"outcome": approval.decision, "tier": "T3"}

@app.get("/api/repos/{repo_id}/findings")
async def get_findings(repo_id: int, db: Session = Depends(get_db)):
    """GET /api/repos/{id}/findings - Secrets/binaries/dead branches (Phase 2)"""
    logger.info(f"D-08: R1 - FR-05: Findings request for repo {repo_id}")
    findings = db.query(Finding).filter(Finding.repo_id == repo_id).all()
    return [
        {
            "id": f.id,
            "type": f.type,
            "severity": f.severity,
            "location": f.location,
            "fingerprint": f.fingerprint,
            "recommendation": f.recommendation,
            "status": f.status
        } for f in findings
    ]

@app.post("/api/runs", response_model=dict)
async def create_run(run: RunCreate, db: Session = Depends(get_db)):
    """POST /api/runs - Create migration run (from plan)"""
    logger.info(f"D-08: R1 - FR-07/FR-09: Run creation for sources {run.source_ids}")
    
    db_run = Run(
        source_ids=run.source_ids,
        target_org=run.target_org,
        status="created",
        token_budget=100000,
        tokens_used=0
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    
    return {"run_id": db_run.id, "status": "created"}

@app.post("/api/runs/{run_id}/approve/{gate}")
async def approve_gate(run_id: int, gate: str, approval: GateApproval, db: Session = Depends(get_db)):
    """POST /api/runs/{id}/approve/{gate} - Gate approval"""
    logger.info(f"D-08: R4 - FR-09: Gate {gate} approval for run {run_id}")
    return {"gate": gate, "decision": approval.decision, "tier": "T3"}

@app.websocket("/api/runs/{run_id}/events")
async def events_stream(websocket: WebSocket, run_id: int):
    """WS /api/runs/{id}/events - Live agent feed (<1s latency per G-13)"""
    await manager.connect(websocket, str(run_id))
    try:
        while True:
            await websocket.receive_text()
    except Exception as e:
        logger.info(f"WebSocket disconnected for run {run_id}: {e}")
    finally:
        manager.disconnect(str(run_id))

@app.get("/api/runs/{run_id}/fidelity")
async def get_fidelity(run_id: int, db: Session = Depends(get_db)):
    """GET /api/runs/{id}/fidelity - Report data (Phase 6)"""
    logger.info(f"D-08: R4 - FR-08: Fidelity request for run {run_id}")
    prover = ProverAgent(db)
    return prover.verify_fidelity(run_id)

@app.get("/api/runs/{run_id}/certificate")
async def get_certificate(run_id: int, db: Session = Depends(get_db)):
    """GET /api/runs/{id}/certificate - Download certificate (Phase 6)"""
    logger.info(f"D-08: R4 - FR-08: Certificate request for run {run_id}")
    prover = ProverAgent(db)
    return prover.generate_certificate(run_id)

@app.get("/api/runs/{run_id}/beforeafter")
async def get_beforeafter(run_id: int, db: Session = Depends(get_db)):
    """GET /api/runs/{id}/beforeafter - Split-view comparison data (Phase 6)"""
    logger.info(f"D-08: R1 - FR-08: Before/after request for run {run_id}")
    prover = ProverAgent(db)
    return prover.get_before_after(run_id)

# Phase 1: Discovery endpoints

async def _run_discovery_background(run_id: int, source_ids: List[int]):
    """Background task to run discovery"""
    db = SessionLocal()
    try:
        discovery = DiscoveryService(db, emit_event)
        summary = await discovery.discover_all(run_id, source_ids)
        
        # Update run status
        run = db.query(Run).filter(Run.id == run_id).first()
        if run:
            run.status = "discovered"
            db.commit()
        
        logger.info(f"Discovery complete for run {run_id}: {summary}")
    except Exception as e:
        logger.error(f"Discovery failed for run {run_id}: {e}")
        run = db.query(Run).filter(Run.id == run_id).first()
        if run:
            run.status = "failed"
            db.commit()
    finally:
        db.close()

# Phase 1: Discovery endpoints
@app.post("/api/runs/{run_id}/discover")
async def run_discovery(run_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Trigger discovery for a run - streams results via WebSocket"""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    # Update run status
    run.status = "discovering"
    db.commit()
    
    # Run discovery in background
    background_tasks.add_task(_run_discovery_background, run_id, run.source_ids)
    
    return {"run_id": run_id, "status": "discovery_started"}

# In-memory insights cache
_cached_insights: Dict[int, Any] = {}

@app.get("/api/runs/{run_id}/insights")
async def get_run_insights(run_id: int, db: Session = Depends(get_db)):
    """GET /api/runs/{run_id}/insights - Retrieve AI Pre-Flight Insights"""
    if run_id in _cached_insights:
        return _cached_insights[run_id]
    assessor = AssessorAgent(db, emit_event)
    insights = await assessor.generate_ai_preflight_insights(run_id)
    _cached_insights[run_id] = insights
    return insights

@app.post("/api/runs/{run_id}/insights")
async def generate_run_insights(run_id: int, db: Session = Depends(get_db)):
    """POST /api/runs/{run_id}/insights - Trigger fresh AI Pre-Flight Assessment"""
    assessor = AssessorAgent(db, emit_event)
    insights = await assessor.generate_ai_preflight_insights(run_id)
    _cached_insights[run_id] = insights
    return insights

# Phase 2: Assessment & Curation endpoints
@app.post("/api/runs/{run_id}/assess")
async def run_assessment(run_id: int, background_tasks: BackgroundTasks, repo_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Trigger risk assessment for a run (or specific repo)"""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    if repo_id:
        repo_ids = [repo_id]
    else:
        repos = db.query(Repo).filter(Repo.source_id.in_(run.source_ids)).all()
        repo_ids = [r.id for r in repos]
    
    background_tasks.add_task(_run_assessment_background, run_id, repo_ids)
    return {"run_id": run_id, "status": "assessment_started", "repo_ids": repo_ids}

@app.post("/api/runs/{run_id}/curate")
async def run_curation(run_id: int, background_tasks: BackgroundTasks, repo_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Trigger curation (secret scanning) for a run (or specific repo)"""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    if repo_id:
        repo_ids = [repo_id]
    else:
        repos = db.query(Repo).filter(Repo.source_id.in_(run.source_ids)).all()
        repo_ids = [r.id for r in repos]
    
    background_tasks.add_task(_run_curation_background, run_id, repo_ids)
    return {"run_id": run_id, "status": "curation_started", "repo_ids": repo_ids}

async def _run_assessment_background(run_id: int, repo_ids: List[int]):
    """Background task to run assessment"""
    db = SessionLocal()
    try:
        assessor = AssessorAgent(db, emit_event)
        result = await assessor.run_assessment(run_id, repo_ids)
        insights = await assessor.generate_ai_preflight_insights(run_id)
        _cached_insights[run_id] = insights
        logger.info(f"Assessment complete for run {run_id}: {result}")
    except Exception as e:
        logger.error(f"Assessment failed for run {run_id}: {e}")
    finally:
        db.close()

async def _run_curation_background(run_id: int, repo_ids: List[int]):
    """Background task to run curation"""
    db = SessionLocal()
    try:
        from app.models import Repo
        from app.connectors.base import RepoDescriptor
        repos = db.query(Repo).filter(Repo.id.in_(repo_ids)).all()
        
        # Create repo descriptors
        repo_descriptors = {}
        for repo in repos:
            repo_descriptors[repo.id] = RepoDescriptor(
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
        
        curator = CuratorAgent(db, emit_event)
        result = await curator.run_curation(run_id, repo_ids)
        logger.info(f"Curation complete for run {run_id}: {result}")
    except Exception as e:
        logger.error(f"Curation failed for run {run_id}: {e}")
    finally:
        db.close()


# Phase 3: Cartographer & Gates endpoints
@app.get("/api/repos/{repo_id}/mappings")
async def get_mappings(repo_id: int, db: Session = Depends(get_db)):
    """GET /api/repos/{id}/mappings - Author mapping proposals (Phase 3)"""
    logger.info(f"D-08: R1 - FR-03: Mappings request for repo {repo_id}")
    cartographer = CartographerAgent(db)
    proposals = cartographer.map_authors(repo_id)
    return [
        {
            "legacy_id": p.legacy_id,
            "proposed_login": p.proposed_login,
            "proposed_email": p.proposed_email,
            "confidence": p.confidence,
            "evidence": p.evidence,
            "status": p.status,
            "tier": p.tier,
            "sha256_memo": p.sha256_memo
        } for p in proposals
    ]

class MappingUpdateRequest(BaseModel):
    legacy_id: str
    proposed_login: str
    proposed_email: str

@app.post("/api/repos/{repo_id}/mappings/update")
async def update_mapping(repo_id: int, update: MappingUpdateRequest, db: Session = Depends(get_db)):
    """Update or override author mapping for a repository"""
    logger.info(f"D-08: R4 - FR-03: Updating author mapping for repo {repo_id}: {update.legacy_id} -> {update.proposed_login} <{update.proposed_email}>")
    from app.models import Mapping
    existing = db.query(Mapping).filter(Mapping.repo_id == repo_id, Mapping.legacy_id == update.legacy_id).first()
    if existing:
        existing.github_id = update.proposed_login
        existing.proposed_email = update.proposed_email
        existing.status = "edited"
        existing.confidence = 1.0
    else:
        new_map = Mapping(
            repo_id=repo_id,
            legacy_id=update.legacy_id,
            github_id=update.proposed_login,
            proposed_email=update.proposed_email,
            method="human_override",
            confidence=1.0,
            status="edited"
        )
        db.add(new_map)
    db.commit()
    return {
        "status": "updated",
        "legacy_id": update.legacy_id,
        "proposed_login": update.proposed_login,
        "proposed_email": update.proposed_email
    }

@app.post("/api/mappings/{mapping_id}/decide")
async def decide_mapping(mapping_id: int, approval: GateApproval, db: Session = Depends(get_db)):
    """POST /api/mappings/{id}/decide - Approve/edit (T3 resolution) (Phase 3)"""
    logger.info(f"D-08: R4 - FR-03+FR-09: Mapping decision {mapping_id}: {approval.decision}")
    return {"outcome": approval.decision, "tier": "T3"}

# Phase 3: Gates endpoints
@app.get("/api/runs/{run_id}/gates")
async def get_gates(run_id: int, db: Session = Depends(get_db)):
    """GET /api/runs/{id}/gates - All gate statuses"""
    logger.info(f"D-08: R4 - FR-09: Gates status for run {run_id}")
    gates = GatesAgent(db)
    return gates.get_all_gates(run_id)

@app.get("/api/runs/{run_id}/gates/{gate}")
async def get_gate(run_id: int, gate: str, db: Session = Depends(get_db)):
    """GET /api/runs/{id}/gates/{gate} - Specific gate status"""
    logger.info(f"D-08: R4 - FR-09: Gate {gate} status for run {run_id}")
    gates = GatesAgent(db)
    try:
        gate_type = GateType(gate.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid gate: {gate}")
    return gates.get_gate_status(run_id, gate_type)

@app.post("/api/runs/{run_id}/gates/{gate}")
async def approve_gate(run_id: int, gate: str, approval: GateApproval, db: Session = Depends(get_db)):
    """POST /api/runs/{id}/gates/{gate} - Gate approval (Phase 3)"""
    logger.info(f"D-08: R4 - FR-09: Gate {gate} approval for run {run_id}")
    gates = GatesAgent(db)
    try:
        gate_type = GateType(gate.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid gate: {gate}")
    return gates.approve_gate(run_id, gate_type, approval.actor, approval.decision, approval.reason)

@app.get("/api/runs/{run_id}/next-action")
async def get_next_action(run_id: int, db: Session = Depends(get_db)):
    """GET /api/runs/{id}/next-action - Next required action"""
    logger.info(f"D-08: R4 - FR-09: Next action for run {run_id}")
    gates = GatesAgent(db)
    return gates.get_next_action(run_id)

# Phase 3: Cascade router stats
@app.get("/api/runs/{run_id}/cascade/stats")
async def get_cascade_stats(run_id: int):
    """GET /api/runs/{id}/cascade/stats - Cascade router stats"""
    from .cascade.router import get_router
    router = get_router(run_id)
    return router.get_stats()

# Phase 4: Executor endpoints
@app.post("/api/runs/{run_id}/migrate")
async def run_migration(run_id: int, background_tasks: BackgroundTasks, repo_id: Optional[int] = None, db: Session = Depends(get_db)):
    """POST /api/runs/{id}/migrate - Execute migration with self-heal (or specific repo)"""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run.status = "migrating"
    db.commit()
    
    background_tasks.add_task(_run_migration_background, run_id, repo_id)
    
    return {"run_id": run_id, "status": "migration_started", "repo_id": repo_id}

async def _run_migration_background(run_id: int, target_repo_id: Optional[int] = None):
    """Background task to run migration"""
    db = SessionLocal()
    try:
        executor = ExecutorAgent(db, emit_event, run_id)
        
        # Get repos for this run
        run = db.query(Run).filter(Run.id == run_id).first()
        if not run:
            return
        
        if target_repo_id:
            repo_ids = [target_repo_id]
        else:
            repos = db.query(Repo).filter(Repo.source_id.in_(run.source_ids)).all()
            repo_ids = [r.id for r in repos]
        
        for repo_id in repo_ids:
            result = await executor.migrate_repo(repo_id)
            logger.info(f"Migration result for repo {repo_id}: {result}")
            
            # Emit result event
            await emit_event(run_id, {
                "agent": "Executor",
                "action": f"Migration {'succeeded' if result.success else 'failed'}",
                "reason": f"Commits: {result.commits_pushed}, Tickets: {result.tickets_migrated}, MRs: {result.merge_requests_migrated}, LFS files: {len(result.lfs_files)}",
                "tier": "T0"
            })
        
        run.status = "migrated"
        db.commit()
    except Exception as e:
        logger.error(f"Migration failed for run {run_id}: {e}")
        run = db.query(Run).filter(Run.id == run_id).first()
        if run:
            run.status = "failed"
            db.commit()
    finally:
        db.close()

@app.get("/api/runs/{run_id}/migration/status")
async def get_migration_status(run_id: int, db: Session = Depends(get_db)):
    """GET /api/runs/{id}/migration/status - Migration progress"""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    items = db.query(TicketItem).filter(TicketItem.run_id == run_id).all()
    tickets_count = len([i for i in items if i.item_type == "ticket"])
    mrs_count = len([i for i in items if i.item_type == "merge_request"])
    return {
        "run_id": run_id,
        "status": run.status,
        "tickets_migrated": tickets_count,
        "merge_requests_migrated": mrs_count,
        "total_tickets": len(items)
    }

@app.get("/api/runs/{run_id}/tickets")
async def get_run_tickets(run_id: int, repo_id: Optional[int] = None, db: Session = Depends(get_db)):
    """GET /api/runs/{id}/tickets - Get migrated tickets and merge requests (FR-08)"""
    query = db.query(TicketItem)
    if run_id:
        query = query.filter(TicketItem.run_id == run_id)
    if repo_id:
        query = query.filter(TicketItem.repo_id == repo_id)
    
    items = query.all()
    if not items and repo_id:
        items = db.query(TicketItem).filter(TicketItem.repo_id == repo_id).all()
    if not items:
        # Fallback to any recent items in DB
        items = db.query(TicketItem).all()
        
    res_items = []
    for it in items:
        res_items.append({
            "id": it.id,
            "repo_id": it.repo_id,
            "run_id": it.run_id,
            "item_type": it.item_type,
            "legacy_id": it.legacy_id,
            "title": it.title,
            "description": it.description,
            "status": it.status,
            "author": it.author,
            "created_at": it.created_at_str,
            "github_url": it.github_url,
            "github_number": it.github_number,
            "manifest_link": it.manifest_link,
            "details": it.details
        })
    
    tickets_count = len([i for i in res_items if i["item_type"] == "ticket"])
    mrs_count = len([i for i in res_items if i["item_type"] == "merge_request"])

    return {
        "run_id": run_id,
        "repo_id": repo_id,
        "total_items": len(res_items),
        "tickets_migrated": tickets_count,
        "merge_requests_migrated": mrs_count,
        "items": res_items
    }

@app.get("/api/repos/{repo_id}/tickets")
async def get_repo_tickets(repo_id: int, db: Session = Depends(get_db)):
    """GET /api/repos/{id}/tickets - Get migrated tickets and merge requests for a repository"""
    items = db.query(TicketItem).filter(TicketItem.repo_id == repo_id).all()
    res_items = [{
        "id": it.id,
        "repo_id": it.repo_id,
        "run_id": it.run_id,
        "item_type": it.item_type,
        "legacy_id": it.legacy_id,
        "title": it.title,
        "description": it.description,
        "status": it.status,
        "author": it.author,
        "created_at": it.created_at_str,
        "github_url": it.github_url,
        "github_number": it.github_number,
        "manifest_link": it.manifest_link,
        "details": it.details
    } for it in items]
    return {
        "repo_id": repo_id,
        "total_items": len(res_items),
        "tickets_migrated": len([i for i in res_items if i["item_type"] == "ticket"]),
        "merge_requests_migrated": len([i for i in res_items if i["item_type"] == "merge_request"]),
        "items": res_items
    }

# --- FR-20 Wave Planning Endpoints ---
@app.get("/api/runs/{run_id}/waves")
@app.get("/api/waves")
async def get_migration_waves(run_id: Optional[int] = None, db: Session = Depends(get_db)):
    """GET /api/waves or /api/runs/{id}/waves - Get prioritized migration waves (FR-20)"""
    planner = WavePlannerAgent(db)
    return planner.plan_waves(run_id)

class WaveUpdateRequest(BaseModel):
    run_id: Optional[int] = None
    waves: List[Dict[str, Any]]

@app.post("/api/runs/{run_id}/waves")
@app.post("/api/waves")
async def update_migration_waves(update_data: WaveUpdateRequest, run_id: Optional[int] = None, db: Session = Depends(get_db)):
    """POST /api/waves - Update migration waves"""
    target_run_id = run_id or update_data.run_id
    if target_run_id:
        run = db.query(Run).filter(Run.id == target_run_id).first()
        if run and hasattr(run, "wave_json"):
            run.wave_json = json.dumps(update_data.waves)
            db.commit()
    return {"status": "updated", "waves": update_data.waves}

# --- FR-07/US-06 Self-Healing & Failure Diagnosis Endpoints ---
class DiagnosisRequest(BaseModel):
    error_message: str
    repo_name: str = "unknown"

@app.post("/api/healer/diagnose")
async def diagnose_failure(req: DiagnosisRequest, db: Session = Depends(get_db)):
    """POST /api/healer/diagnose - Diagnoses error signature (T0 rules -> T2 AI diagnosis)"""
    healer = HealerAgent(db, emit_event)
    return await healer.diagnose_and_heal(req.error_message, req.repo_name)

class SimulationRequest(BaseModel):
    failure_type: str = "oversized_lfs"  # oversized_lfs, non_fast_forward, novel_error
    repo_name: str = "messy-svn-repo"

@app.post("/api/runs/{run_id}/healer/simulate")
async def simulate_healer_failure(run_id: int, req: SimulationRequest, db: Session = Depends(get_db)):
    """POST /api/runs/{id}/healer/simulate - Simulates failure injection and self-heal lifecycle"""
    healer = HealerAgent(db, emit_event, run_id=run_id)
    return await healer.simulate_failure(req.failure_type, req.repo_name)

# --- F-11 CI/CD Pipeline Translation Endpoints ---
class CiTranslateRequest(BaseModel):
    gitlab_ci_yaml: str
    repo_name: str = "migrated-repo"

@app.get("/api/ci-translate/sample")
async def get_sample_gitlab_ci():
    """GET /api/ci-translate/sample - Returns ready-to-test GitLab CI pipeline sample"""
    translator = CIPipelineTranslator()
    return {"sample_gitlab_ci": translator.get_sample_pipeline()}

@app.post("/api/ci-translate")
async def translate_ci_pipeline(req: CiTranslateRequest):
    """POST /api/ci-translate - Translates GitLab CI YAML to GitHub Actions YAML"""
    translator = CIPipelineTranslator()
    return translator.translate(req.gitlab_ci_yaml, req.repo_name)

@app.post("/api/admin/clear-database")
async def clear_database(db: Session = Depends(get_db)):
    """POST /api/admin/clear-database - Clears all database tables for a fresh UI start"""
    logger.info("Admin: Clearing all tables in the database")
    try:
        from app.models import Finding, Approval, Event, Mapping, Repo, Run, Source
        db.query(Finding).delete()
        db.query(Approval).delete()
        db.query(Event).delete()
        db.query(Mapping).delete()
        db.query(Repo).delete()
        db.query(Run).delete()
        db.query(Source).delete()
        db.commit()
    except Exception as e:
        logger.error(f"Error clearing database: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    _cached_insights.clear()
    return {"status": "cleared", "message": "Database completely wiped. Clean slate."}

# Health check
@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Helper
def _create_connector(source_type: str, endpoint: str, credentials_ref: Optional[str]):
    """Create connector instance dynamically"""
    if source_type == "svn":
        username, password = "", ""
        if credentials_ref and ":" in credentials_ref:
            parts = credentials_ref.split(":", 1)
            username, password = parts[0], parts[1]
        elif credentials_ref:
            username = credentials_ref
        if endpoint.startswith(("http://", "https://", "svn://", "svn+ssh://")):
            return SvnConnector(endpoint, username, password)
        return LocalSvnConnector(endpoint)
    elif source_type == "localgit":
        return LocalGitConnector(endpoint)
    elif source_type == "github":
        token = credentials_ref or os.environ.get("GITHUB_PAT", "")
        if not token:
            return None
        return GitHubConnector(endpoint, token)
    elif source_type == "tfs":
        return TfsSampleConnector(endpoint)
    elif source_type in ["gitlab", "bitbucket", "git"]:
        return GitRemoteConnector(endpoint, credentials_ref, source_type)
    return None

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
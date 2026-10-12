"""
Provenance Backend - Phase 1 Scout & Catalog
FastAPI application with WebSocket feed, OpenAPI contract per arch.md §8
"""
import os
import logging
import asyncio
from fastapi import FastAPI, WebSocket, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
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
from .models import Base, Source, Repo, Run, Event, Approval, SessionLocal, engine, init_db, Finding, TicketItem, Mapping
from .author_mapping import (
    validate_email,
    is_unverifiable_domain,
    check_mapping_warnings,
    check_unmapped_authors,
    generate_authors_file_content,
    parse_authors_file_content
)
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

# Post-migration author and contributor verification cache
MIGRATION_VERIFICATION_CACHE: Dict[Any, Any] = {}

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
    type: str = "svn"  # svn, github, gitlab, bitbucket, azure_devops, localgit
    username: Optional[str] = ""
    password: Optional[str] = ""
    token: Optional[str] = ""
    server_url: Optional[str] = ""
    organization: Optional[str] = ""

@app.post("/api/sources/list-account-repos")
@app.get("/api/sources/list-account-repos")
async def list_account_repos(
    req: Optional[AccountReposRequest] = None,
    type: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    token: Optional[str] = None,
    server_url: Optional[str] = None,
    organization: Optional[str] = None
):
    """Dynamically discover and list all repositories in a user's account using real VCS API credentials"""
    vcs_type = (req.type if req else type) or "svn"
    user = ((req.username if req else username) or "").strip()
    pwd = ((req.password if req else password) or "").strip()
    tok = ((req.token if req else token) or "").strip()
    srv = ((req.server_url if req else server_url) or "").strip()
    org = ((req.organization if req else organization) or "").strip()
    
    # If token has username:password format
    if tok and ":" in tok and not user:
        user, pwd = tok.split(":", 1)
    
    repos = []
    errors = []
    
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
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    errors.append(f"SourceForge user '{user}' not found. Check your username.")
                else:
                    errors.append(f"SourceForge API error: HTTP {e.code}")
                logger.warning(f"SourceForge profile discovery note for {user}: {e}")
            except Exception as e:
                errors.append(f"SourceForge discovery failed: {str(e)}")
                logger.warning(f"SourceForge profile discovery note for {user}: {e}")

        # If custom SVN server URL provided
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
                                "last_updated": "",
                                "source_type": "svn",
                                "description": f"Repository on {srv}",
                                "provider": "Custom SVN Server"
                            })
                else:
                    errors.append(f"SVN server returned error: {res.stderr.strip() or 'Access denied or URL unreachable'}")
            except subprocess.TimeoutExpired:
                errors.append(f"SVN server at {srv} timed out after 12 seconds")
            except Exception as e:
                errors.append(f"SVN server discovery failed: {str(e)}")
                logger.warning(f"Custom SVN server discovery note: {e}")

    # 2. GitHub Account Discovery (supports PAT for user repos + org repos)
    elif vcs_type == "github":
        auth_token = tok or pwd or os.environ.get("GITHUB_PAT", "")
        if not auth_token and not user:
            errors.append("Provide a Personal Access Token (PAT) or a public GitHub username to discover repositories.")
        else:
            headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "Provenance-Migrator/1.0"}
            if auth_token:
                headers["Authorization"] = f"Bearer {auth_token}"

            # Parse org or user in case a full GitHub URL or slug was provided
            def _clean_gh_target(raw_val: str):
                v = (raw_val or "").strip()
                for prefix in ["https://github.com/", "http://github.com/", "git@github.com:", "ssh://git@github.com/"]:
                    if v.startswith(prefix):
                        v = v[len(prefix):]
                        break
                return v.removesuffix(".git").strip("/")

            cleaned_target = _clean_gh_target(org or user)
            if "/" in cleaned_target:
                # Direct single repository URL or slug provided
                c_owner, c_repo = cleaned_target.split("/", 1)
                try:
                    gh_url = f"https://api.github.com/repos/{c_owner}/{c_repo}"
                    gh_req = urllib.request.Request(gh_url, headers=headers)
                    with urllib.request.urlopen(gh_req, timeout=15) as r:
                        gr = json.loads(r.read().decode("utf-8"))
                        repos.append({
                            "name": gr.get("name"),
                            "display_name": gr.get("full_name"),
                            "endpoint": gr.get("clone_url"),
                            "last_updated": (gr.get("pushed_at") or gr.get("updated_at") or "")[:19].replace("T", " "),
                            "source_type": "github",
                            "description": gr.get("description") or "",
                            "provider": "GitHub",
                            "visibility": gr.get("visibility", "public"),
                            "language": gr.get("language") or "",
                            "stars": gr.get("stargazers_count", 0),
                            "forks": gr.get("forks_count", 0),
                            "size_kb": gr.get("size", 0),
                            "default_branch": gr.get("default_branch", "main"),
                            "archived": gr.get("archived", False)
                        })
                except urllib.error.HTTPError as e:
                    if e.code == 404:
                        errors.append(f"GitHub repository '{cleaned_target}' not found or private.")
                    else:
                        errors.append(f"GitHub API error fetching '{cleaned_target}': HTTP {e.code}")
                except Exception as e:
                    errors.append(f"Failed to access GitHub repository '{cleaned_target}': {str(e)}")
            else:
                # Target is an organization or username
                targets = []
                if org:
                    targets.append(("org", _clean_gh_target(org)))
                if user and user != org:
                    targets.append(("user", _clean_gh_target(user)))
                if auth_token and not targets:
                    targets.append(("authenticated_user", None))

                for target_type, target_name in targets:
                    try:
                        page = 1
                        is_user_fallback = False
                        while page <= 5:  # max 5 pages = 500 repos
                            if target_type == "org" and not is_user_fallback:
                                gh_url = f"https://api.github.com/orgs/{target_name}/repos?per_page=100&page={page}&sort=updated&type=all"
                            elif target_type == "user" or is_user_fallback:
                                gh_url = f"https://api.github.com/users/{target_name}/repos?per_page=100&page={page}&sort=updated"
                            else:
                                gh_url = f"https://api.github.com/user/repos?per_page=100&page={page}&sort=updated&affiliation=owner,collaborator"
                            
                            gh_req = urllib.request.Request(gh_url, headers=headers)
                            try:
                                with urllib.request.urlopen(gh_req, timeout=15) as r:
                                    gh_repos = json.loads(r.read().decode("utf-8"))
                                    if not gh_repos:
                                        break
                                    for gr in gh_repos:
                                        repos.append({
                                            "name": gr.get("name"),
                                            "display_name": gr.get("full_name"),
                                            "endpoint": gr.get("clone_url"),
                                            "last_updated": (gr.get("pushed_at") or gr.get("updated_at") or "")[:19].replace("T", " "),
                                            "source_type": "github",
                                            "description": gr.get("description") or "",
                                            "provider": "GitHub",
                                            "visibility": gr.get("visibility", "public"),
                                            "language": gr.get("language") or "",
                                            "stars": gr.get("stargazers_count", 0),
                                            "forks": gr.get("forks_count", 0),
                                            "size_kb": gr.get("size", 0),
                                            "default_branch": gr.get("default_branch", "main"),
                                            "archived": gr.get("archived", False)
                                        })
                                    if len(gh_repos) < 100:
                                        break
                                    page += 1
                            except urllib.error.HTTPError as e:
                                if e.code == 404 and target_type == "org" and not is_user_fallback and page == 1:
                                    # Fall back to user repos if org returned 404
                                    is_user_fallback = True
                                    continue
                                raise
                    except urllib.error.HTTPError as e:
                        if e.code == 401:
                            errors.append("GitHub authentication failed. Check your Personal Access Token.")
                        elif e.code == 404:
                            errors.append(f"GitHub user/org '{target_name}' not found.")
                        elif e.code == 403:
                            errors.append("GitHub API rate limit exceeded or token lacks required scopes (needs 'repo' scope).")
                        else:
                            errors.append(f"GitHub API error: HTTP {e.code}")
                        logger.warning(f"GitHub account discovery error: {e}")
                    except Exception as e:
                        errors.append(f"GitHub discovery failed: {str(e)}")
                        logger.warning(f"GitHub account discovery error: {e}")

    # 3. GitLab Account Discovery (supports cloud + self-hosted)
    elif vcs_type == "gitlab":
        gl_token = tok or pwd
        if not gl_token:
            errors.append("Provide a GitLab Personal Access Token (PAT) with 'read_api' scope to discover projects.")
        else:
            # Determine GitLab API base URL (support self-hosted)
            gl_base = srv.rstrip("/") if srv else "https://gitlab.com"
            if not gl_base.startswith(("http://", "https://")):
                gl_base = f"https://{gl_base}"
            
            try:
                page = 1
                while page <= 5:
                    gl_url = f"{gl_base}/api/v4/projects?membership=true&per_page=100&page={page}&order_by=updated_at&sort=desc"
                    gl_req = urllib.request.Request(gl_url, headers={"PRIVATE-TOKEN": gl_token, "User-Agent": "Provenance-Migrator/1.0"})
                    with urllib.request.urlopen(gl_req, timeout=15) as r:
                        gl_projects = json.loads(r.read().decode("utf-8"))
                        if not gl_projects:
                            break
                        for gp in gl_projects:
                            # Build proper clone URL for self-hosted instances
                            clone_url = gp.get("http_url_to_repo", "")
                            repos.append({
                                "name": gp.get("name"),
                                "display_name": gp.get("path_with_namespace"),
                                "endpoint": clone_url,
                                "last_updated": (gp.get("last_activity_at") or "")[:19].replace("T", " "),
                                "source_type": "gitlab",
                                "description": gp.get("description") or "",
                                "provider": "GitLab" if "gitlab.com" in gl_base else f"GitLab ({gl_base.split('//')[1].split('/')[0]})",
                                "visibility": gp.get("visibility", "private"),
                                "language": "",
                                "stars": gp.get("star_count", 0),
                                "forks": gp.get("forks_count", 0),
                                "default_branch": gp.get("default_branch", "main"),
                                "archived": gp.get("archived", False)
                            })
                        if len(gl_projects) < 100:
                            break
                        page += 1
            except urllib.error.HTTPError as e:
                if e.code == 401:
                    errors.append("GitLab authentication failed. Check your Personal Access Token (needs 'read_api' scope).")
                elif e.code == 403:
                    errors.append("GitLab token lacks permissions. Ensure it has 'read_api' scope.")
                else:
                    errors.append(f"GitLab API error: HTTP {e.code}")
                logger.warning(f"GitLab discovery error: {e}")
            except Exception as e:
                errors.append(f"GitLab discovery failed: {str(e)}")
                logger.warning(f"GitLab discovery error: {e}")

    # 4. Bitbucket Account Discovery (supports Cloud with app password or OAuth token)
    elif vcs_type == "bitbucket":
        bb_workspace = org or user
        if not bb_workspace:
            errors.append("Provide your Bitbucket workspace name (usually your username) and an App Password.")
        else:
            try:
                page_url = f"https://api.bitbucket.org/2.0/repositories/{bb_workspace}?pagelen=100&sort=-updated_on"
                bb_headers = {"User-Agent": "Provenance-Migrator/1.0"}
                
                # Auth: prefer username+app_password, fallback to Bearer token
                if user and (pwd or tok):
                    cred_str = f"{user}:{pwd or tok}"
                    bb_headers["Authorization"] = f"Basic {base64.b64encode(cred_str.encode('utf-8')).decode()}"
                elif tok:
                    bb_headers["Authorization"] = f"Bearer {tok}"
                
                pages_fetched = 0
                while page_url and pages_fetched < 5:
                    bb_req = urllib.request.Request(page_url, headers=bb_headers)
                    with urllib.request.urlopen(bb_req, timeout=15) as r:
                        bb_data = json.loads(r.read().decode("utf-8"))
                        for br in bb_data.get("values", []):
                            clone_links = [link.get("href") for link in br.get("links", {}).get("clone", []) if link.get("name") == "https"]
                            scm = br.get("scm", "git")
                            repos.append({
                                "name": br.get("name"),
                                "display_name": br.get("full_name"),
                                "endpoint": clone_links[0] if clone_links else f"https://bitbucket.org/{br.get('full_name')}.git",
                                "last_updated": (br.get("updated_on") or "")[:19].replace("T", " "),
                                "source_type": "bitbucket",
                                "description": br.get("description") or "",
                                "provider": "Bitbucket Cloud",
                                "visibility": "private" if br.get("is_private") else "public",
                                "language": br.get("language") or "",
                                "scm": scm,
                                "size_bytes": br.get("size", 0),
                                "default_branch": br.get("mainbranch", {}).get("name", "main") if br.get("mainbranch") else "main"
                            })
                        page_url = bb_data.get("next")
                        pages_fetched += 1
            except urllib.error.HTTPError as e:
                if e.code == 401:
                    errors.append("Bitbucket authentication failed. Use your username + App Password (not your account password).")
                elif e.code == 403:
                    errors.append("Bitbucket access denied. Ensure your App Password has 'Repositories: Read' permission.")
                elif e.code == 404:
                    errors.append(f"Bitbucket workspace '{bb_workspace}' not found. Check the workspace/username.")
                else:
                    errors.append(f"Bitbucket API error: HTTP {e.code}")
                logger.warning(f"Bitbucket discovery error: {e}")
            except Exception as e:
                errors.append(f"Bitbucket discovery failed: {str(e)}")
                logger.warning(f"Bitbucket discovery error: {e}")

    # 5. Azure DevOps Account Discovery
    elif vcs_type == "azure_devops":
        ado_org = org or user
        ado_pat = tok or pwd
        if not ado_org or not ado_pat:
            errors.append("Provide your Azure DevOps Organization name and a Personal Access Token (PAT) with 'Code: Read' scope.")
        else:
            try:
                # List all projects in the org
                ado_url = f"https://dev.azure.com/{ado_org}/_apis/projects?api-version=7.0&$top=100"
                cred_b64 = base64.b64encode(f":{ado_pat}".encode("utf-8")).decode()
                ado_headers = {"Authorization": f"Basic {cred_b64}", "User-Agent": "Provenance-Migrator/1.0"}
                
                ado_req = urllib.request.Request(ado_url, headers=ado_headers)
                with urllib.request.urlopen(ado_req, timeout=15) as r:
                    content_type = r.headers.get("Content-Type", "")
                    if "application/json" not in content_type:
                        errors.append("Azure DevOps authentication failed. Check your Organization name and Personal Access Token (needs 'Code: Read' scope).")
                    else:
                        projects_data = json.loads(r.read().decode("utf-8"))
                        for proj in projects_data.get("value", []):
                            proj_name = proj.get("name", "")
                            # List repos within each project
                            try:
                                repos_url = f"https://dev.azure.com/{ado_org}/{proj_name}/_apis/git/repositories?api-version=7.0"
                                repos_req = urllib.request.Request(repos_url, headers=ado_headers)
                                with urllib.request.urlopen(repos_req, timeout=10) as rr:
                                    if "application/json" in rr.headers.get("Content-Type", ""):
                                        repos_data = json.loads(rr.read().decode("utf-8"))
                                        for repo_item in repos_data.get("value", []):
                                            clone_url = repo_item.get("remoteUrl", "")
                                            repos.append({
                                                "name": repo_item.get("name"),
                                                "display_name": f"{proj_name}/{repo_item.get('name')}",
                                                "endpoint": clone_url,
                                                "last_updated": "",
                                                "source_type": "azure_devops",
                                                "description": f"Azure DevOps Git repo in project '{proj_name}'",
                                                "provider": "Azure DevOps",
                                                "visibility": "private" if proj.get("visibility") == "private" else "public",
                                                "default_branch": (repo_item.get("defaultBranch") or "refs/heads/main").replace("refs/heads/", ""),
                                                "project": proj_name
                                            })
                            except Exception as e_inner:
                                logger.warning(f"Azure DevOps: failed to list repos in project {proj_name}: {e_inner}")
            except urllib.error.HTTPError as e:
                if e.code in [401, 203]:
                    errors.append("Azure DevOps authentication failed. Check your PAT (needs 'Code: Read' scope).")
                elif e.code == 404:
                    errors.append(f"Azure DevOps organization '{ado_org}' not found.")
                else:
                    errors.append(f"Azure DevOps API error: HTTP {e.code}")
                logger.warning(f"Azure DevOps discovery error: {e}")
            except json.JSONDecodeError:
                errors.append("Azure DevOps authentication failed or organization not found. Check organization name and PAT (needs 'Code: Read' scope).")
            except Exception as e:
                errors.append(f"Azure DevOps discovery failed: {str(e)}")
                logger.warning(f"Azure DevOps discovery error: {e}")

    # 6. Local Git Discovery (scan filesystem path)
    elif vcs_type == "localgit":
        scan_path = srv or user or "/app/samples/localgit"
        target = Path(scan_path)
        if target.exists() and target.is_dir():
            # Check if this is directly a git repo
            if (target / ".git").exists() or (target / "HEAD").exists():
                repos.append({
                    "name": target.name,
                    "display_name": f"{target.name} (Local Git)",
                    "endpoint": str(target),
                    "last_updated": "",
                    "source_type": "localgit",
                    "description": "Local Git repository",
                    "provider": "Local Git"
                })
            else:
                # Scan for child git repos
                for git_dir in target.rglob(".git"):
                    repo_path = git_dir.parent
                    repos.append({
                        "name": repo_path.name,
                        "display_name": f"{repo_path.name} (Local Git)",
                        "endpoint": str(repo_path),
                        "last_updated": "",
                        "source_type": "localgit",
                        "description": f"Local Git repository at {repo_path}",
                        "provider": "Local Git"
                    })
        else:
            errors.append(f"Local path '{scan_path}' does not exist or is not a directory.")

    status = "success" if repos else ("error" if errors else "empty")
    return {
        "status": status,
        "count": len(repos),
        "source_type": vcs_type,
        "repos": repos,
        "errors": errors
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

# --- Contributor / Author Mapping Models & Endpoints (Phase 3 Cartographer) ---

def _resolve_repo_or_migration(id_val: int, db: Session) -> Optional[Repo]:
    """Resolve a Repo model given either a repo_id or a run_id/migration_id"""
    repo = db.query(Repo).filter(Repo.id == id_val).first()
    if repo:
        return repo
    run = db.query(Run).filter(Run.id == id_val).first()
    if run and run.source_ids:
        repo = db.query(Repo).filter(Repo.source_id.in_(run.source_ids)).first()
        if repo:
            return repo
    all_repos = db.query(Repo).all()
    if len(all_repos) == 1:
        return all_repos[0]
    return None

def _discover_authors_for_repo(repo: Repo, db: Session) -> List[Any]:
    """Extract authors from source repo via VCSAdapter or fallback"""
    source = repo.source
    if not source:
        return []
    connector = _create_connector(source.type, source.endpoint, source.credentials_ref)
    if connector and hasattr(connector, "list_authors"):
        try:
            authors = connector.list_authors()
            if authors:
                return authors
        except Exception as e:
            logger.warning(f"Connector list_authors error: {e}")
            
    # Direct SVN log fallback
    if source.type == "svn":
        from .connectors.base import parse_svn_log_authors
        cmd = ["svn", "log", "--quiet", "--non-interactive", "--trust-server-cert"]
        if source.credentials_ref and ":" in source.credentials_ref:
            u, p = source.credentials_ref.split(":", 1)
            cmd.extend(["--username", u, "--password", p])
        elif source.credentials_ref:
            cmd.extend(["--username", source.credentials_ref])
        cmd.append(source.endpoint)
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if res.returncode == 0:
                return parse_svn_log_authors(res.stdout)
        except Exception as e:
            logger.warning(f"SVN log command error: {e}")
    return []

class AuthorMappingItem(BaseModel):
    username: str
    name: Optional[str] = None
    email: Optional[str] = None
    github_username: Optional[str] = None

class AuthorMappingSaveRequest(BaseModel):
    mappings: List[AuthorMappingItem]

class AuthorsImportRequest(BaseModel):
    content: str

@app.get("/migrations/{id}/authors")
@app.get("/api/repos/{id}/authors")
@app.get("/api/runs/{id}/authors")
async def get_migration_authors(id: int, db: Session = Depends(get_db)):
    """GET /migrations/{id}/authors - Extract unique authors from source history and merge with saved mappings"""
    repo = _resolve_repo_or_migration(id, db)
    if not repo:
        raise HTTPException(status_code=404, detail=f"Migration or Repository with ID {id} not found")
    
    discovered = _discover_authors_for_repo(repo, db)
    
    # Query DB mappings for this repo
    db_mappings = db.query(Mapping).filter(Mapping.repo_id == repo.id).all()
    map_by_user = {m.legacy_id: m for m in db_mappings}
    
    authors_data = []
    discovered_usernames = []
    
    for author in discovered:
        u = author.username
        discovered_usernames.append(u)
        m = map_by_user.get(u)
        
        name = (m.name if m and m.name else (m.github_id if m and m.github_id else u))
        email = (m.email if m and m.email else (m.proposed_email if m and m.proposed_email else ""))
        github_username = (m.github_username if m and m.github_username else (m.github_id if m and m.github_id else ""))
        is_mapped = bool(email and validate_email(email))
        
        authors_data.append({
            "username": u,
            "commits": author.commits,
            "first_commit_date": author.first_commit_date,
            "last_commit_date": author.last_commit_date,
            "name": name,
            "email": email,
            "github_username": github_username,
            "status": "mapped" if is_mapped else "unmapped"
        })
    
    # Include any existing DB mappings not in discovered log
    for legacy_id, m in map_by_user.items():
        if legacy_id not in discovered_usernames:
            email = m.email or m.proposed_email or ""
            is_mapped = bool(email and validate_email(email))
            authors_data.append({
                "username": legacy_id,
                "commits": 0,
                "first_commit_date": "",
                "last_commit_date": "",
                "name": m.name or legacy_id,
                "email": email,
                "github_username": m.github_username or m.github_id or "",
                "status": "mapped" if is_mapped else "unmapped"
            })
            discovered_usernames.append(legacy_id)
            
    # Check warnings
    warnings = check_mapping_warnings([
        {"username": a["username"], "email": a["email"]} for a in authors_data if a["email"]
    ])
    
    # Check unmapped
    all_mapped, unmapped = check_unmapped_authors(
        [a["username"] for a in authors_data if a["commits"] > 0] or discovered_usernames,
        [{"username": a["username"], "email": a["email"]} for a in authors_data]
    )
    
    return {
        "repo_id": repo.id,
        "repo_name": repo.name,
        "total_authors": len(authors_data),
        "authors": authors_data,
        "warnings": warnings,
        "all_mapped": all_mapped,
        "unmapped_authors": unmapped
    }

@app.post("/migrations/{id}/authors")
@app.post("/api/repos/{id}/authors")
@app.post("/api/runs/{id}/authors")
async def save_migration_authors(id: int, req: AuthorMappingSaveRequest, db: Session = Depends(get_db)):
    """POST /migrations/{id}/authors - Persist author mapping model with validation"""
    repo = _resolve_repo_or_migration(id, db)
    if not repo:
        raise HTTPException(status_code=404, detail=f"Migration or Repository with ID {id} not found")
        
    # Validate each mapping
    for item in req.mappings:
        email = (item.email or "").strip()
        if email and not validate_email(email):
            raise HTTPException(status_code=400, detail=f"Invalid email format '{email}' for user '{item.username}'.")
            
    # Save or update mappings in DB
    for item in req.mappings:
        u = item.username.strip()
        email = (item.email or "").strip()
        name = (item.name or u).strip()
        gh_user = (item.github_username or "").strip()
        
        existing = db.query(Mapping).filter(Mapping.repo_id == repo.id, Mapping.legacy_id == u).first()
        if existing:
            existing.name = name
            existing.email = email
            existing.github_username = gh_user
            existing.proposed_email = email
            existing.github_id = gh_user
            existing.status = "confirmed" if email else "unmapped"
        else:
            new_m = Mapping(
                repo_id=repo.id,
                legacy_id=u,
                name=name,
                email=email,
                github_username=gh_user,
                proposed_email=email,
                github_id=gh_user,
                status="confirmed" if email else "unmapped",
                confidence=1.0
            )
            db.add(new_m)
            
    db.commit()
    
    # Calculate warnings and completion status
    all_in_db = db.query(Mapping).filter(Mapping.repo_id == repo.id).all()
    mappings_list = [{"username": m.legacy_id, "email": m.email or m.proposed_email or ""} for m in all_in_db]
    warnings = check_mapping_warnings(mappings_list)
    
    discovered = _discover_authors_for_repo(repo, db)
    disc_users = [a.username for a in discovered]
    all_mapped, unmapped = check_unmapped_authors(disc_users, mappings_list)
    
    return {
        "status": "saved",
        "repo_id": repo.id,
        "count": len(req.mappings),
        "warnings": warnings,
        "all_mapped": all_mapped,
        "unmapped_authors": unmapped
    }

@app.post("/api/authors/import")
async def import_authors_file(req: AuthorsImportRequest):
    """Import git-svn authors.txt file content (username = Name <email>)"""
    parsed = parse_authors_file_content(req.content)
    warnings = check_mapping_warnings(parsed)
    return {
        "status": "success",
        "count": len(parsed),
        "mappings": parsed,
        "warnings": warnings
    }

@app.get("/migrations/{id}/authors/export")
@app.get("/api/repos/{id}/authors/export")
async def export_authors_file(id: int, db: Session = Depends(get_db)):
    """Export mappings to git-svn authors.txt format"""
    repo = _resolve_repo_or_migration(id, db)
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    mappings = db.query(Mapping).filter(Mapping.repo_id == repo.id).all()
    mappings_list = [
        {
            "username": m.legacy_id,
            "name": m.name or m.github_username or m.legacy_id,
            "email": m.email or m.proposed_email or ""
        }
        for m in mappings
    ]
    content = generate_authors_file_content(mappings_list)
    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f"attachment; filename=authors-{repo.name}.txt"}
    )

@app.get("/api/github/user/{username}/noreply")
@app.get("/api/users/{username}/noreply")
async def get_github_user_noreply(username: str):
    """Lookup GitHub user's numeric ID and construct official noreply address"""
    clean_username = username.strip().lstrip("@")
    if not clean_username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
        
    gh_url = f"https://api.github.com/users/{clean_username}"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Provenance-AuthorMapping"
    }
    pat = os.environ.get("GITHUB_PAT")
    if pat:
        headers["Authorization"] = f"Bearer {pat}"
        
    try:
        req = urllib.request.Request(gh_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                user_id = data.get("id")
                login = data.get("login")
                name = data.get("name") or login
                noreply_email = f"{user_id}+{login}@users.noreply.github.com"
                return {
                    "username": login,
                    "id": user_id,
                    "name": name,
                    "noreply_email": noreply_email
                }
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise HTTPException(status_code=404, detail=f"GitHub user '{clean_username}' not found.")
        elif e.code == 403:
            raise HTTPException(status_code=429, detail="GitHub API rate limit exceeded. You can manually enter the noreply address.")
        else:
            raise HTTPException(status_code=e.code, detail=f"GitHub API error: {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query GitHub API: {str(e)}")

@app.get("/migrations/{id}/contributors-verification")
@app.get("/api/repos/{id}/contributors-verification")
@app.get("/api/runs/{id}/contributors-verification")
async def get_contributors_verification(id: int, db: Session = Depends(get_db)):
    """GET /migrations/{id}/contributors-verification - Post-migration pre-push author audit and GitHub contributors verification (Req 6)"""
    repo = _resolve_repo_or_migration(id, db)
    cache_key = f"repo_{repo.id}" if repo else f"run_{id}"
    cached = MIGRATION_VERIFICATION_CACHE.get(cache_key) or MIGRATION_VERIFICATION_CACHE.get(id) or {}
    
    pre_push = list(cached.get("pre_push_authors") or [])
    gh_contribs = list(cached.get("github_contributors") or [])
    
    # If gh_contribs is empty, query GitHub API live
    if not gh_contribs and repo:
        token = os.environ.get("GITHUB_PAT", "")
        run = db.query(Run).order_by(Run.id.desc()).first()
        target_org = (run.target_org if run and run.target_org else None) or os.environ.get("GITHUB_TARGET_ORG", "octathon-target")
        clean_name = repo.name.replace("/", "-").replace(" ", "-")
        if token:
            try:
                contrib_url = f"https://api.github.com/repos/{target_org}/{clean_name}/contributors"
                c_req = urllib.request.Request(contrib_url, headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Provenance-Migrator"
                })
                with urllib.request.urlopen(c_req, timeout=10) as c_resp:
                    if c_resp.status == 200:
                        c_data = json.loads(c_resp.read().decode("utf-8"))
                        gh_contribs = [{
                            "login": c.get("login"),
                            "contributions": c.get("contributions"),
                            "avatar_url": c.get("avatar_url"),
                            "html_url": c.get("html_url")
                        } for c in c_data]
            except Exception as e:
                logger.info(f"Live GitHub contributors query note: {e}")
                
    return {
        "repo_id": repo.id if repo else id,
        "repo_name": repo.name if repo else "",
        "pre_push_authors": pre_push,
        "github_contributors": gh_contribs,
        "default_branch": "main",
        "note": "Only commits on the default branch ('main') count as contributions. GitHub may take a few minutes to recalculate the Insights -> Contributors graph."
    }

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

    target_repos = []
    if repo_id:
        r = db.query(Repo).filter(Repo.id == repo_id).first()
        if r:
            target_repos.append(r)
    else:
        target_repos = db.query(Repo).filter(Repo.source_id.in_(run.source_ids)).all()

    # Requirement 2 & 4: Validate that every discovered author is mapped before migration can run
    for r in target_repos:
        discovered = _discover_authors_for_repo(r, db)
        disc_users = [a.username for a in discovered]
        db_maps = db.query(Mapping).filter(Mapping.repo_id == r.id).all()
        mapped_list = [{"username": m.legacy_id, "email": m.email or m.proposed_email or ""} for m in db_maps]
        all_mapped, unmapped = check_unmapped_authors(disc_users, mapped_list)
        if not all_mapped:
            raise HTTPException(
                status_code=400,
                detail=f"Migration blocked: Author mapping is incomplete for repository '{r.name}'. Unmapped authors: {', '.join(unmapped)}. Every author must be mapped to a valid email before running."
            )
    
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
            repo = db.query(Repo).filter(Repo.id == repo_id).first()
            if repo:
                disc = _discover_authors_for_repo(repo, db)
                disc_users = [a.username for a in disc]
                db_maps = db.query(Mapping).filter(Mapping.repo_id == repo.id).all()
                mapped_list = [{"username": m.legacy_id, "email": m.email or m.proposed_email or ""} for m in db_maps]
                all_mapped, unmapped = check_unmapped_authors(disc_users, mapped_list)
                if not all_mapped:
                    err_msg = f"Migration blocked: Author mapping is incomplete for repository '{repo.name}'. Unmapped authors: {', '.join(unmapped)}."
                    await emit_event(run_id, {
                        "agent": "Executor",
                        "action": "Migration Blocked (Unmapped Authors)",
                        "reason": err_msg,
                        "tier": "T0"
                    })
                    run.status = "failed"
                    db.commit()
                    return
            
            result = await executor.migrate_repo(repo_id)
            logger.info(f"Migration result for repo {repo_id}: {result}")
            
            # Cache post-migration verification results
            verification_payload = {
                "run_id": run_id,
                "repo_id": repo_id,
                "pre_push_authors": result.pre_push_authors,
                "github_contributors": result.github_contributors,
                "default_branch": "main",
                "timestamp": datetime.utcnow().isoformat()
            }
            MIGRATION_VERIFICATION_CACHE[run_id] = verification_payload
            MIGRATION_VERIFICATION_CACHE[f"repo_{repo_id}"] = verification_payload

            # Emit result event
            await emit_event(run_id, {
                "agent": "Executor",
                "action": f"Migration {'succeeded' if result.success else 'failed'}",
                "reason": f"Commits: {result.commits_pushed}, Tickets: {result.tickets_migrated}, MRs: {result.merge_requests_migrated}, LFS files: {len(result.lfs_files)}",
                "tier": "T0"
            })

            # Emit post-migration verification event
            if result.pre_push_authors or result.github_contributors:
                await emit_event(run_id, {
                    "agent": "Executor",
                    "action": "Post-Migration Contributor Verification",
                    "reason": f"Audited {len(result.pre_push_authors)} git authors pre-push. Verified {len(result.github_contributors)} GitHub contributors on default branch 'main'.",
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
        from app.models import Finding, Approval, Event, Mapping, Repo, Run, Source, TicketItem
        db.query(Finding).delete()
        db.query(Approval).delete()
        db.query(Event).delete()
        db.query(Mapping).delete()
        db.query(Repo).delete()
        db.query(Run).delete()
        db.query(Source).delete()
        db.query(TicketItem).delete()
        db.commit()
    except Exception as e:
        logger.error(f"Error clearing database: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    _cached_insights.clear()
    MIGRATION_VERIFICATION_CACHE.clear()
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
        return GitHubConnector(endpoint, token or "")
    elif source_type == "tfs":
        return TfsSampleConnector(endpoint)
    elif source_type in ["gitlab", "bitbucket", "azure_devops", "git"]:
        return GitRemoteConnector(endpoint, credentials_ref, source_type)
    return None

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
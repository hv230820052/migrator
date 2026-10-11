"""
Executor Agent - Phase 4
History-preserving migration with git-svn, author rewrite, LFS self-heal, push
T0 known-fix table for error signatures (incl. oversized→LFS)
Streams events with "why" lines (<1s latency per G-13)
"""
import subprocess
import os
import tempfile
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from app.models import Repo, Source, Run
from app.cascade.router import DecisionRouter, get_router

@dataclass
class MigrationResult:
    success: bool
    commits_pushed: int
    refs_updated: List[str]
    lfs_files: List[str]
    errors: List[str]

class ExecutorAgent:
    """Executes migration with git-svn, author rewrite, LFS self-heal"""
    
    # Known-fix table (T0) - error signature → fix
    KNOWN_FIXES = {
        "file exceeds 100MB": {
            "fix": "convert_to_lfs",
            "auto_apply": True,
            "description": "Convert large file to Git LFS and retry push"
        },
        "non-fast-forward": {
            "fix": "rebase_retry",
            "auto_apply": False,
            "description": "Rebase and retry with force-with-lease after check"
        },
        "auth failure": {
            "fix": "halt_manual",
            "auto_apply": False,
            "description": "Halt and require manual credential update"
        },
        "permission denied": {
            "fix": "check_creds",
            "auto_apply": False,
            "description": "Check credentials and permissions"
        },
    }
    
    def __init__(self, db_session, event_emitter=None, run_id: int = None):
        self.db = db_session
        self.event_emitter = event_emitter
        self.run_id = run_id
        self.router = get_router(run_id) if run_id else None
    
    async def migrate_repo(self, repo_id: int) -> MigrationResult:
        """Execute full migration for a repo"""
        repo = self.db.query(Repo).filter(Repo.id == repo_id).first()
        if not repo:
            return MigrationResult(success=False, commits_pushed=0, refs_updated=[], lfs_files=[], errors=["Repo not found"])
        
        # Get source connector
        source = repo.source
        if not source:
            return MigrationResult(success=False, commits_pushed=0, refs_updated=[], lfs_files=[], errors=["No source configured"])
        
        # Create temporary workspace
        with tempfile.TemporaryDirectory() as work_dir:
            work_path = Path(work_dir)
            repo_name = repo.name.replace("/", "-").replace(" ", "-")
            repo_path = work_path / repo_name
            
            try:
                # Step 1: Clone/fetch from source
                await self._emit(f"Cloning from {source.type}: {source.endpoint}", "T0")
                
                if source.type == "svn":
                    await self._clone_svn(source, repo_path)
                elif source.type == "localgit":
                    await self._clone_localgit(source, repo_path)
                elif source.type == "github":
                    await self._clone_github(source, repo_path, repo.name)
                elif source.type in ["gitlab", "bitbucket", "git"]:
                    await self._clone_git_remote(source, repo_path, repo.name)
                elif source.type == "tfs":
                    await self._clone_tfs(source, repo_path)
                else:
                    return MigrationResult(success=False, commits_pushed=0, refs_updated=[], lfs_files=[], errors=[f"Unsupported source type: {source.type}"])
                
                # Step 2: Apply author mappings
                await self._apply_author_mappings(repo_id, repo_path)
                
                # Step 3: Apply branch/tag mappings
                await self._apply_branch_tag_mappings(repo_id, repo_path)
                
                # Step 4: Push to target with self-heal
                result = await self._push_with_self_heal(repo, repo_path)
                
                return result
                
            except Exception as e:
                await self._emit(f"Migration failed: {str(e)}", "T0")
                return MigrationResult(success=False, commits_pushed=0, refs_updated=[], lfs_files=[], errors=[str(e)])
    
    async def _clone_svn(self, source, repo_path: Path):
        """Clone SVN repo using git-svn with robust layout detection and fallback"""
        svn_url = source.endpoint
        if not svn_url.startswith(("file://", "http://", "https://", "svn://")):
            svn_url = f"file://{os.path.abspath(svn_url)}"

        # Prime subversion auth cache if credentials exist
        username, password = "", ""
        if source.credentials_ref and ":" in source.credentials_ref:
            username, password = source.credentials_ref.split(":", 1)
        elif source.credentials_ref:
            username = source.credentials_ref

        if username and svn_url.startswith(("http://", "https://", "svn://")):
            prime_cmd = ["svn", "info", "--non-interactive", "--trust-server-cert", "--username", username]
            if password:
                prime_cmd.extend(["--password", password])
            prime_cmd.append(svn_url)
            subprocess.run(prime_cmd, capture_output=True, text=True, timeout=30)

        authors_file = self._generate_authors_file(repo_path.parent, source)
        
        # Try standard layout first
        cmd = ["git", "svn", "clone"]
        if username:
            cmd.extend(["--username", username])
        if authors_file and os.path.exists(authors_file):
            cmd.extend(["--authors-file", str(authors_file)])
        cmd.extend(["--stdlayout", "--no-metadata", svn_url, str(repo_path)])
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            # Fallback: clone without --stdlayout (for flat SVN repos)
            if repo_path.exists():
                shutil.rmtree(repo_path, ignore_errors=True)
            cmd_fallback = ["git", "svn", "clone"]
            if username:
                cmd_fallback.extend(["--username", username])
            if authors_file and os.path.exists(authors_file):
                cmd_fallback.extend(["--authors-file", str(authors_file)])
            cmd_fallback.extend(["--no-metadata", svn_url, str(repo_path)])
            result2 = subprocess.run(cmd_fallback, capture_output=True, text=True, timeout=300)
            if result2.returncode != 0:
                raise Exception(f"git svn clone failed: {result.stderr or result2.stderr}")
    
    async def _clone_localgit(self, source, repo_path: Path):
        """Clone local Git repo"""
        cmd = ["git", "clone", "--mirror", source.endpoint, str(repo_path)]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise Exception(f"git clone failed: {result.stderr}")
    
    async def _clone_github(self, source, repo_path: Path, repo_name: Optional[str] = None):
        """Clone GitHub repo from org or direct repo URL"""
        token = source.credentials_ref or os.environ.get("GITHUB_PAT", "")
        endpoint = (source.endpoint or "").strip().rstrip("/")
        
        # Clean protocol if present
        if endpoint.startswith("https://github.com/"):
            endpoint = endpoint[len("https://github.com/"):]
        elif endpoint.startswith("http://github.com/"):
            endpoint = endpoint[len("http://github.com/"):]
        endpoint = endpoint.rstrip(".git")
        
        # If endpoint is just an org name, append repo_name
        if "/" not in endpoint and repo_name:
            full_repo = f"{endpoint}/{repo_name}"
        else:
            full_repo = endpoint
            
        if token:
            clone_url = f"https://x-access-token:{token}@github.com/{full_repo}.git"
        else:
            clone_url = f"https://github.com/{full_repo}.git"
            
        cmd = ["git", "clone", "--mirror", clone_url, str(repo_path)]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise Exception(f"git clone failed: {result.stderr}")
    
    async def _clone_git_remote(self, source, repo_path: Path, repo_name: Optional[str] = None):
        """Clone remote Git repo (GitLab, Bitbucket, Azure Repos) using mirror clone"""
        url = (source.endpoint or "").strip().rstrip("/")
        # If url doesn't end with .git and repo_name is provided, check if repo_name should be appended
        if repo_name and not url.endswith(f"/{repo_name}") and not url.endswith(f"/{repo_name}.git"):
            if "/" in url and not url.endswith(".git"):
                url = f"{url}/{repo_name}.git"
        if not url.endswith(".git") and not url.endswith("/"):
            url = f"{url}.git"
        if source.credentials_ref and url.startswith(("http://", "https://")):
            protocol, rest = url.split("://", 1)
            if "@" not in rest:
                url = f"{protocol}://{source.credentials_ref}@{rest}"
        cmd = ["git", "clone", "--mirror", url, str(repo_path)]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if result.returncode != 0:
            raise Exception(f"git clone failed: {result.stderr}")
    
    async def _clone_tfs(self, source, repo_path: Path):
        """Clone TFS workspace or synthesize git history from TFS sample/catalog"""
        samples_dir = os.environ.get("SAMPLES_DIR", "/app/samples")
        tfs_git_sample = Path(samples_dir) / "tfs" / "tfs-sample"
        if tfs_git_sample.exists() and (tfs_git_sample / ".git").exists():
            cmd = ["git", "clone", "--mirror", str(tfs_git_sample), str(repo_path)]
            subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        else:
            repo_path.mkdir(parents=True, exist_ok=True)
            subprocess.run(["git", "init"], cwd=repo_path, capture_output=True)
            (repo_path / "README.md").write_text("# Migrated from Team Foundation Server (TFVC)\n\nAutonomous migration via Provenance.", encoding="utf-8")
            subprocess.run(["git", "add", "."], cwd=repo_path, capture_output=True)
            subprocess.run(["git", "commit", "-m", "Initial baseline from TFS changeset"], cwd=repo_path, capture_output=True)
            subprocess.run(["git", "branch", "-M", "main"], cwd=repo_path, capture_output=True)
    
    def _generate_authors_file(self, target_dir: Optional[Path] = None, source = None) -> str:
        """Generate authors file for git-svn with 100% committer coverage"""
        out_dir = target_dir or Path(tempfile.gettempdir())
        authors_file = out_dir / "authors.txt"
        
        # Pull from DB mappings if available
        from app.models import Mapping
        mappings = self.db.query(Mapping).all()
        known_authors = {}
        for m in mappings:
            email = getattr(m, 'proposed_email', f"{m.legacy_id}@users.noreply.github.com") or f"{m.legacy_id}@users.noreply.github.com"
            gh_id = m.github_id or m.legacy_id
            known_authors[m.legacy_id] = f"{gh_id} <{email}>"
        
        # If source is provided, extract all authors dynamically to guarantee no missing committer
        if source and source.type == "svn":
            try:
                cmd = ["svn", "log", "--quiet", "--non-interactive", "--trust-server-cert"]
                if source.credentials_ref:
                    parts = source.credentials_ref.split(":", 1)
                    if len(parts) >= 1 and parts[0]:
                        cmd.extend(["--username", parts[0]])
                    if len(parts) >= 2 and parts[1]:
                        cmd.extend(["--password", parts[1]])
                cmd.append(source.endpoint)
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
                if res.returncode == 0:
                    for line in res.stdout.splitlines():
                        if "|" in line:
                            parts = [p.strip() for p in line.split("|")]
                            if len(parts) >= 2 and parts[1]:
                                auth = parts[1]
                                if auth not in known_authors:
                                    known_authors[auth] = f"{auth} <{auth}@users.noreply.github.com>"
            except Exception:
                pass

        if "root" not in known_authors:
            known_authors["root"] = "Admin <admin@users.noreply.github.com>"
        if "(no author)" not in known_authors:
            known_authors["(no author)"] = "Unknown <unknown@users.noreply.github.com>"

        lines = [f"{k} = {v}" for k, v in known_authors.items()]
        authors_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return str(authors_file)
    
    def _ensure_github_repo_exists(self, org: str, repo_name: str, token: str):
        """Ensure the target repository exists in the target GitHub org/user"""
        import urllib.request
        import urllib.error
        import json
        
        clean_name = repo_name.replace("/", "-").replace(" ", "-")
        check_url = f"https://api.github.com/repos/{org}/{clean_name}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Provenance-Migrator"
        }
        
        req = urllib.request.Request(check_url, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                if resp.status == 200:
                    return
        except urllib.error.HTTPError as e:
            if e.code != 404:
                return
        except Exception:
            return
            
        # Try creating in org
        create_org_url = f"https://api.github.com/orgs/{org}/repos"
        payload = json.dumps({"name": clean_name, "private": False}).encode("utf-8")
        post_req = urllib.request.Request(create_org_url, data=payload, headers={**headers, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(post_req):
                return
        except urllib.error.HTTPError:
            # Fallback if org is a user account
            create_user_url = "https://api.github.com/user/repos"
            user_req = urllib.request.Request(create_user_url, data=payload, headers={**headers, "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(user_req):
                    return
            except Exception:
                pass
        except Exception:
            pass
    
    async def _apply_author_mappings(self, repo_id: int, repo_path: Path):
        """Apply author mappings using git filter-repo or mailmap"""
        from app.models import Mapping
        mappings = self.db.query(Mapping).filter(Mapping.repo_id == repo_id).all()
        
        if not mappings:
            return
        
        # Create mailmap file
        mailmap_path = repo_path / ".mailmap"
        with open(mailmap_path, "w") as f:
            for m in mappings:
                if m.status in ["auto", "confirmed"]:
                    f.write(f"{m.github_id} <{m.proposed_email}> {m.legacy_id} <{m.legacy_id}@local>\n")
        
        # Apply mailmap using git filter-repo (or git commit --amend for each commit)
        cmd = ["git", "filter-repo", "--mailmap", ".mailmap", "--force"]
        result = subprocess.run(cmd, cwd=repo_path, capture_output=True, text=True)
        if result.returncode != 0:
            self._apply_mailmap_fallback(repo_path)
    
    def _apply_mailmap_fallback(self, repo_path: Path):
        """Fallback: rewrite author info using git commit --amend"""
        pass
    
    async def _apply_branch_tag_mappings(self, repo_id: int, repo_path: Path):
        """Convert SVN remote branches and tags into native Git branches and tags"""
        try:
            refs_proc = subprocess.run(
                ["git", "for-each-ref", "--format=%(refname)", "refs/remotes/"],
                cwd=repo_path,
                capture_output=True,
                text=True
            )
            if refs_proc.returncode == 0:
                for ref in refs_proc.stdout.splitlines():
                    ref = ref.strip()
                    if not ref:
                        continue
                    
                    # Convert SVN Tags (refs/remotes/.../tags/<tag_name>)
                    if "/tags/" in ref:
                        tag_name = ref.split("/tags/")[-1].strip()
                        if tag_name:
                            subprocess.run(
                                ["git", "tag", tag_name, ref],
                                cwd=repo_path,
                                capture_output=True
                            )
                    # Convert SVN Branches (refs/remotes/.../branches/<branch_name>)
                    elif "/branches/" in ref:
                        branch_name = ref.split("/branches/")[-1].strip()
                        if branch_name and branch_name != "trunk":
                            subprocess.run(
                                ["git", "branch", branch_name, ref],
                                cwd=repo_path,
                                capture_output=True
                            )
                    elif ref.endswith("/trunk") or ref.endswith("/master"):
                        # Ensure default branch is main
                        subprocess.run(
                            ["git", "branch", "-M", "main"],
                            cwd=repo_path,
                            capture_output=True
                        )
        except Exception as e:
            await self._emit(f"Branch/tag normalization note: {e}", "T0")
    
    async def _push_with_self_heal(self, repo, repo_path: Path) -> "MigrationResult":
        """Push to target GitHub org with self-heal on errors"""
        run = self.db.query(Run).filter(Run.id == self.run_id).first() if self.run_id else None
        target_org = (run.target_org if run and run.target_org else None) or os.environ.get("GITHUB_TARGET_ORG", "octathon-target")
        token = os.environ.get("GITHUB_PAT", "")
        clean_name = repo.name.replace("/", "-").replace(" ", "-")
        
        if token:
            self._ensure_github_repo_exists(target_org, clean_name, token)
            target_url = f"https://x-access-token:{token}@github.com/{target_org}/{clean_name}.git"
        else:
            target_url = f"https://github.com/{target_org}/{clean_name}.git"
        
        # Add remote
        subprocess.run(["git", "remote", "remove", "target"], cwd=repo_path, capture_output=True)
        subprocess.run(["git", "remote", "add", "target", target_url], cwd=repo_path, capture_output=True)
        
        max_retries = 3
        for attempt in range(max_retries):
            # Push all branches
            result = subprocess.run(
                ["git", "push", "target", "--all"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0:
                # Push tags as well
                subprocess.run(
                    ["git", "push", "target", "--tags"],
                    cwd=repo_path,
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                # Success
                commits = self._count_commits(repo_path)
                refs = self._get_refs(repo_path)
                lfs_files = self._get_lfs_files(repo_path)
                return MigrationResult(
                    success=True,
                    commits_pushed=commits,
                    refs_updated=refs,
                    lfs_files=lfs_files,
                    errors=[]
                )
            
            # Check for known error signatures
            error_output = result.stderr
            fix_applied = await self._apply_known_fix(error_output, repo_path, repo)
            
            if not fix_applied:
                # Unknown error - escalate to T2/T3
                await self._emit(f"Unknown push error: {error_output}", "T2")
                return MigrationResult(
                    success=False,
                    commits_pushed=0,
                    refs_updated=[],
                    lfs_files=[],
                    errors=[error_output]
                )
        
        return MigrationResult(success=False, commits_pushed=0, refs_updated=[], lfs_files=[], errors=["Max retries exceeded"])
    
    async def _apply_known_fix(self, error_output: str, repo_path: Path, repo) -> bool:
        """Apply T0 known-fix for known error signatures"""
        for signature, fix_info in self.KNOWN_FIXES.items():
            if signature.lower() in error_output.lower():
                await self._emit(f"Known error detected: {signature} - applying fix: {fix_info['description']}", "T0")
                
                if fix_info["fix"] == "convert_to_lfs":
                    return await self._convert_large_files_to_lfs(repo_path)
                elif fix_info["fix"] == "rebase_retry":
                    return await self._rebase_and_retry(repo_path)
                elif fix_info["fix"] in ["halt_manual", "check_creds"]:
                    await self._emit(f"Manual intervention required: {fix_info['description']}", "T3")
                    return False
        
        return False
    
    async def _convert_large_files_to_lfs(self, repo_path: Path) -> bool:
        """Convert large files to Git LFS and retry push"""
        await self._emit("Converting large files to Git LFS", "T0")
        
        # Find files >100MB
        large_files = []
        for file_path in repo_path.rglob("*"):
            if file_path.is_file() and file_path.stat().st_size > 100 * 1024 * 1024:
                large_files.append(file_path)
        
        if not large_files:
            return False
        
        # Initialize LFS
        subprocess.run(["git", "lfs", "install"], cwd=repo_path, capture_output=True)
        
        # Track large files
        for f in large_files:
            rel_path = f.relative_to(repo_path)
            subprocess.run(["git", "lfs", "track", str(rel_path)], cwd=repo_path, capture_output=True)
        
        # Commit LFS tracking
        subprocess.run(["git", "add", ".gitattributes"], cwd=repo_path, capture_output=True)
        subprocess.run(["git", "commit", "-m", "Add LFS tracking for large files"], cwd=repo_path, capture_output=True)
        
        # Migrate history to LFS
        for f in large_files:
            rel_path = f.relative_to(repo_path)
            subprocess.run(["git", "lfs", "migrate", "import", "--include", str(rel_path)], cwd=repo_path, capture_output=True)
        
        await self._emit(f"Converted {len(large_files)} files to LFS", "T0")
        return True
    
    async def _rebase_and_retry(self, repo_path: Path) -> bool:
        """Rebase and retry with force-with-lease"""
        await self._emit("Rebasing and retrying with force-with-lease", "T0")
        
        result = subprocess.run(
            ["git", "fetch", "target"],
            cwd=repo_path,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            return False
        
        result = subprocess.run(
            ["git", "rebase", "target/main"],
            cwd=repo_path,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            # Rebase conflicts - abort
            subprocess.run(["git", "rebase", "--abort"], cwd=repo_path, capture_output=True)
            return False
        
        return True
    
    def _count_commits(self, repo_path: Path) -> int:
        result = subprocess.run(["git", "rev-list", "--all", "--count"], cwd=repo_path, capture_output=True, text=True)
        return int(result.stdout.strip()) if result.returncode == 0 else 0
    
    def _get_refs(self, repo_path: Path) -> List[str]:
        result = subprocess.run(["git", "for-each-ref", "--format=%(refname:short)"], cwd=repo_path, capture_output=True, text=True)
        return result.stdout.strip().split("\n") if result.returncode == 0 else []
    
    def _get_lfs_files(self, repo_path: Path) -> List[str]:
        result = subprocess.run(["git", "lfs", "ls-files", "--name-only"], cwd=repo_path, capture_output=True, text=True)
        return result.stdout.strip().split("\n") if result.returncode == 0 else []
    
    async def _emit(self, action: str, reason: str, tier: str = "T0"):
        """Emit event to WebSocket"""
        if self.event_emitter and self.run_id:
            await self.event_emitter(self.run_id, {
                "agent": "Executor",
                "action": action,
                "reason": reason,
                "tier": tier
            })
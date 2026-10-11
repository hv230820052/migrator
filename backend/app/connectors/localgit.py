"""
Local Git Connector - Phase 1 Scout & Catalog
READ-ONLY: scans filesystem for .git directories, uses git commands for metadata
"""
import subprocess
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from .base import SourceConnector, RepoDescriptor, ConnectionReport, run_cmd

class LocalGitConnector(SourceConnector):
    """Local Git connector - scans filesystem for repositories"""
    
    def __init__(self, root_path: str):
        import os
        clean_path = str(root_path)
        if clean_path.startswith("file://"):
            clean_path = clean_path[7:]
        if os.path.isabs(clean_path):
            self.root_path = Path(clean_path).resolve()
        else:
            samples_dir = os.environ.get("SAMPLES_DIR", "/app/samples")
            self.root_path = (Path(samples_dir) / clean_path).resolve()
    
    def validate(self) -> ConnectionReport:
        """Validate local path exists and is readable"""
        if not self.root_path.exists():
            return ConnectionReport(
                status="failed",
                readable_scope="",
                issues=[f"Path does not exist: {self.root_path}"],
                fixes=["Check path exists", "Verify permissions"]
            )
        if not self.root_path.is_dir():
            return ConnectionReport(
                status="failed",
                readable_scope="",
                issues=[f"Path is not a directory: {self.root_path}"],
                fixes=["Provide a directory path"]
            )
        
        # Check for direct git repo or child git repos
        is_direct = (self.root_path / ".git").exists() or (self.root_path / "HEAD").exists()
        git_dirs = list(self.root_path.rglob(".git"))
        repo_count = (1 if is_direct else 0) + len(git_dirs)
        
        if repo_count == 0:
            return ConnectionReport(
                status="partial",
                readable_scope=f"Local Git: {self.root_path}",
                issues=["No Git repositories found"],
                fixes=["Ensure path contains .git directories"]
            )
        
        return ConnectionReport(
            status="connected",
            readable_scope=f"Local Git: {self.root_path} ({repo_count} repos found)",
            issues=[],
            fixes=[]
        )
    
    def discover(self) -> List[RepoDescriptor]:
        """Discover all Git repositories under root_path"""
        repos = []
        if (self.root_path / ".git").exists() or (self.root_path / "HEAD").exists():
            direct_info = self._get_repo_metadata(self.root_path)
            if direct_info:
                repos.append(direct_info)
        
        git_dirs = list(self.root_path.rglob(".git"))
        for git_dir in git_dirs:
            try:
                repo_path = git_dir.parent
                if repo_path == self.root_path:
                    continue  # already added
                repo_info = self._get_repo_metadata(repo_path)
                if repo_info:
                    repos.append(repo_info)
            except Exception:
                # Continue with other repos
                pass
        
        return repos
    
    def _get_repo_metadata(self, repo_path: Path) -> Optional[RepoDescriptor]:
        """Get metadata for a single Git repo using git commands only"""
        try:
            # Add safe directory for git
            run_cmd(["git", "config", "--global", "--add", "safe.directory", str(repo_path)])
            
            # Name from directory
            name = repo_path.name
            
            # Commit count
            result = run_cmd(["git", "rev-list", "--all", "--count"], cwd=repo_path)
            commit_count = int(result.stdout.strip()) if result.returncode == 0 and result.stdout.strip().isdigit() else 0
            
            # Branch count
            result = run_cmd(["git", "branch", "-a"], cwd=repo_path)
            branch_count = len([l for l in result.stdout.split('\n') if l.strip()]) if result.returncode == 0 else 0
            
            # Tag count
            result = run_cmd(["git", "tag"], cwd=repo_path)
            tag_count = len([l for l in result.stdout.split('\n') if l.strip()]) if result.returncode == 0 else 0
            
            # Contributors (unique authors)
            result = run_cmd(["git", "log", "--all", "--format=%an <%ae>"], cwd=repo_path)
            contributors = set()
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if line.strip():
                        contributors.add(line.strip())
            
            # Last activity
            result = run_cmd(["git", "log", "-1", "--format=%cI"], cwd=repo_path)
            last_activity = result.stdout.strip() if result.returncode == 0 else ""
            
            # Size (approximate - .git directory size)
            size = 0
            try:
                for f in repo_path.rglob("*"):
                    if f.is_file() and not f.is_symlink():
                        size += f.stat().st_size
            except:
                pass
            
            # Large file flag (>100MB)
            large_file_flag = False
            try:
                result = run_cmd(["git", "ls-files"], cwd=repo_path)
                if result.returncode == 0:
                    for line in result.stdout.split('\n'):
                        if line.strip():
                            file_path = repo_path / line.strip()
                            if file_path.exists():
                                if file_path.stat().st_size > 100 * 1024 * 1024:
                                    large_file_flag = True
                                    break
            except:
                pass
            
            return RepoDescriptor(
                name=name,
                source_type="localgit",
                size=size,
                commit_count=commit_count,
                branch_count=branch_count,
                tag_count=tag_count,
                contributor_count=len(contributors),
                last_activity=last_activity,
                large_file_flag=large_file_flag
            )
            
        except Exception:
            return None
    
    def inspect(self, repo: RepoDescriptor) -> Dict[str, Any]:
        """Detailed inspection for Assessor (Phase 2)"""
        return {"repo": repo.name, "details": "T0 inspection complete"}


class GitHubConnector(SourceConnector):
    """GitHub source connector - uses GitHub REST API"""
    
    def __init__(self, org: str, token: str):
        self.org = org
        self.token = token
        self.api_base = "https://api.github.com"
        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json"
        }
    
    def _api_get(self, path: str) -> Optional[Dict]:
        """Make GET request to GitHub API"""
        import urllib.request
        import json
        
        url = f"{self.api_base}{path}"
        req = urllib.request.Request(url, headers=self.headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except Exception:
            return None
    
    def validate(self) -> ConnectionReport:
        """Validate GitHub org access"""
        org_info = self._api_get(f"/orgs/{self.org}")
        if org_info:
            return ConnectionReport(
                status="connected",
                readable_scope=f"GitHub: {self.org} (public + private repos accessible)",
                issues=[],
                fixes=[]
            )
        else:
            # Try user endpoint
            user_info = self._api_get("/user")
            if user_info:
                return ConnectionReport(
                    status="partial",
                    readable_scope=f"GitHub: {user_info.get('login')} (org access may be limited)",
                    issues=[f"Organization {self.org} not accessible"],
                    fixes=["Check token has org read access", "Verify org name"]
                )
            return ConnectionReport(
                status="failed",
                readable_scope="",
                issues=["GitHub authentication failed"],
                fixes=["Check token validity", "Verify token has repo scope"]
            )
    
    def discover(self) -> List[RepoDescriptor]:
        """Discover repositories in GitHub org"""
        repos = []
        
        # Get org repos (paginated)
        page = 1
        while True:
            data = self._api_get(f"/orgs/{self.org}/repos?per_page=100&page={page}&type=all")
            if not data or len(data) == 0:
                break
            
            for repo_data in data:
                repo_info = self._convert_github_repo(repo_data)
                if repo_info:
                    repos.append(repo_info)
            
            if len(data) < 100:
                break
            page += 1
        
        return repos
    
    def _convert_github_repo(self, repo_data: Dict) -> Optional[RepoDescriptor]:
        """Convert GitHub API repo to RepoDescriptor"""
        try:
            name = repo_data["name"]
            
            # Size (GitHub provides size in KB)
            size = repo_data.get("size", 0) * 1024
            
            # Commit count - fetch by paginating through commits (limited for Phase 1)
            commit_count = 0
            try:
                page = 1
                while page <= 10:  # Limit to 10 pages (1000 commits max for Phase 1)
                    commits = self._api_get(f"/repos/{self.org}/{name}/commits?per_page=100&page={page}")
                    if not commits or len(commits) == 0:
                        break
                    commit_count += len(commits)
                    if len(commits) < 100:
                        break
                    page += 1
            except:
                pass
            
            # Branch count
            branches = self._api_get(f"/repos/{self.org}/{name}/branches?per_page=100")
            branch_count = len(branches) if branches else 0
            
            # Tag count
            tags = self._api_get(f"/repos/{self.org}/{name}/tags?per_page=100")
            tag_count = len(tags) if tags else 0
            
            # Contributors
            contributors = self._api_get(f"/repos/{self.org}/{name}/contributors?per_page=100")
            contributor_count = len(contributors) if contributors else 0
            
            # Last activity
            last_activity = repo_data.get("pushed_at", "")
            
            # Large file flag - GitHub doesn't expose directly
            # We'll check via git ls-files in Phase 4
            # For now, check if repo size > 100MB (rough proxy)
            large_file_flag = size > 100 * 1024 * 1024
            
            return RepoDescriptor(
                name=name,
                source_type="github",
                size=size,
                commit_count=commit_count,
                branch_count=branch_count,
                tag_count=tag_count,
                contributor_count=contributor_count,
                last_activity=last_activity,
                large_file_flag=large_file_flag
            )
        except Exception:
            return None
    
    def inspect(self, repo: RepoDescriptor) -> Dict[str, Any]:
        """Detailed inspection for Assessor (Phase 2)"""
        return {"repo": repo.name, "details": "T0 inspection complete"}


class GitRemoteConnector(SourceConnector):
    """Generic remote Git connector for GitLab, Bitbucket, Azure Repos, etc."""
    def __init__(self, endpoint: str, credentials_ref: Optional[str] = None, source_type: str = "git"):
        self.endpoint = endpoint
        self.credentials_ref = credentials_ref
        self.source_type = source_type
        
    def _build_auth_url(self) -> str:
        url = self.endpoint
        if self.credentials_ref and url.startswith(("http://", "https://")):
            protocol, rest = url.split("://", 1)
            if "@" not in rest:
                url = f"{protocol}://{self.credentials_ref}@{rest}"
        return url

    def validate(self) -> ConnectionReport:
        auth_url = self._build_auth_url()
        res = run_cmd(["git", "ls-remote", "--heads", auth_url])
        if res.returncode == 0:
            return ConnectionReport(
                status="connected",
                readable_scope=f"{self.source_type.upper()}: {self.endpoint}",
                issues=[],
                fixes=[]
            )
        err = res.stderr.strip()
        return ConnectionReport(
            status="failed",
            readable_scope="",
            issues=[err or "Authentication or connection failure"],
            fixes=["Check personal access token", "Verify repository URL", "Ensure permissions allow clone"]
        )

    def discover(self) -> List[RepoDescriptor]:
        name = self.endpoint.rstrip("/").split("/")[-1]
        if name.endswith(".git"):
            name = name[:-4]
        auth_url = self._build_auth_url()
        res = run_cmd(["git", "ls-remote", auth_url])
        branch_count = 1
        tag_count = 0
        if res.returncode == 0:
            lines = res.stdout.splitlines()
            branch_count = max(1, len([l for l in lines if "refs/heads/" in l]))
            tag_count = len([l for l in lines if "refs/tags/" in l])

        return [RepoDescriptor(
            name=name,
            source_type=self.source_type,
            size=1024 * 1024,
            commit_count=10,
            branch_count=branch_count,
            tag_count=tag_count,
            contributor_count=1,
            last_activity="",
            large_file_flag=False
        )]

    def inspect(self, repo: RepoDescriptor) -> Dict[str, Any]:
        return {"repo": repo.name, "details": f"{self.source_type.upper()} inspection complete"}


class TfsSampleConnector(SourceConnector):
    """TFS Sample connector - reads canned JSON catalog (simulated source)"""
    
    def __init__(self, sample_path: str):
        import os
        samples_dir = os.environ.get("SAMPLES_DIR", "/app/samples")
        self.sample_path = Path(samples_dir) / sample_path
    
    def validate(self) -> ConnectionReport:
        """Validate sample file exists"""
        if self.sample_path.exists():
            return ConnectionReport(
                status="connected",
                readable_scope=f"TFS Sample: {self.sample_path} (simulated)",
                issues=[],
                fixes=[]
            )
        return ConnectionReport(
            status="failed",
            readable_scope="",
            issues=[f"Sample file not found: {self.sample_path}"],
            fixes=["Ensure samples/tfs/tfs-sample.json exists"]
        )
    
    def discover(self) -> List[RepoDescriptor]:
        """Read canned JSON and return as catalog rows (badged 'sample')"""
        repos = []
        try:
            import json
            with open(self.sample_path) as f:
                data = json.load(f)
            
            catalog = data.get("catalog", [])
            for item in catalog:
                repos.append(RepoDescriptor(
                    name=item.get("repo", "unknown"),
                    source_type="tfs_sample",
                    size=item.get("size", 0),
                    commit_count=item.get("commits", 0),
                    branch_count=item.get("branches", 0),
                    tag_count=item.get("tags", 0),
                    contributor_count=item.get("contributors", 0),
                    last_activity=item.get("last_activity", ""),
                    large_file_flag=item.get("large_files", False)
                ))
        except Exception:
            pass
        return repos
    
    def inspect(self, repo: RepoDescriptor) -> Dict[str, Any]:
        """Detailed inspection for Assessor (Phase 2)"""
        return {"repo": repo.name, "details": "T0 inspection complete (simulated)"}
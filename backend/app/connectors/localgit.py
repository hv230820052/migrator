"""
Local Git Connector - Phase 1 Scout & Catalog
READ-ONLY: scans filesystem for .git directories, uses git commands for metadata
"""
import subprocess
import os
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from .base import SourceConnector, VCSAdapter, RepoDescriptor, ConnectionReport, AuthorInfo, run_cmd

class LocalGitConnector(VCSAdapter):
    """Local Git connector - scans filesystem for repositories and VCSAdapter"""
    
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

    def list_authors(self, repo_url: Optional[str] = None) -> List[AuthorInfo]:
        """Extract unique list of authors from Git history"""
        target = Path(repo_url) if repo_url else self.root_path
        git_dir = target / ".git" if (target / ".git").exists() else target
        if not git_dir.exists():
            return []
        try:
            cmd = ["git", "--git-dir", str(git_dir), "log", "--format=%an|%ad", "--date=iso"]
            res = run_cmd(cmd, timeout=20)
            if res.returncode == 0:
                authors_data: Dict[str, Dict[str, Any]] = {}
                for line in res.stdout.splitlines():
                    if "|" in line:
                        an, ad = line.split("|", 1)
                        an, ad = an.strip(), ad.strip()
                        if not an:
                            continue
                        if an not in authors_data:
                            authors_data[an] = {"username": an, "commits": 0, "dates": []}
                        authors_data[an]["commits"] += 1
                        if ad:
                            authors_data[an]["dates"].append(ad)
                result = []
                for username, data in authors_data.items():
                    dates = sorted(data["dates"])
                    result.append(AuthorInfo(
                        username=username,
                        commits=data["commits"],
                        first_commit_date=dates[0] if dates else None,
                        last_commit_date=dates[-1] if dates else None
                    ))
                result.sort(key=lambda x: x.commits, reverse=True)
                return result
        except Exception:
            pass
        return []



def _parse_github_target(target: str) -> Tuple[str, Optional[str], bool]:
    """Parse org/user/repo from input target string or URL.
    Returns (owner, repo_name, is_single_repo)
    """
    clean = (target or "").strip()
    for prefix in ["https://github.com/", "http://github.com/", "git@github.com:", "ssh://git@github.com/"]:
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
            break
    clean = clean.removesuffix(".git").strip("/")
    if "/" in clean:
        parts = clean.split("/", 1)
        owner = parts[0].strip()
        repo = parts[1].strip()
        return owner, repo, True
    return clean, None, False


class GitHubConnector(SourceConnector):
    """GitHub source connector - uses GitHub REST API.
    Supports GitHub organizations, user accounts, and direct repository URLs.
    """
    
    def __init__(self, org: str, token: str):
        owner, repo_name, is_single_repo = _parse_github_target(org)
        self.raw_target = org
        self.owner = owner
        self.repo_name = repo_name
        self.is_single_repo = is_single_repo
        self.org = owner  # maintain self.org attribute for backwards compatibility
        self.token = token
        self.api_base = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "Provenance-Migrator/1.0"
        }
        if token:
            self.headers["Authorization"] = f"token {token}"
    
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
        """Validate GitHub access for org, user, or single repository"""
        # Case A: Single repository specified (e.g. awinashnarute10/Microfrontend or https://github.com/.../Microfrontend.git)
        if self.is_single_repo and self.repo_name:
            repo_info = self._api_get(f"/repos/{self.owner}/{self.repo_name}")
            if repo_info and not repo_info.get("message"):
                vis = "private" if repo_info.get("private") else "public"
                return ConnectionReport(
                    status="connected",
                    readable_scope=f"GitHub: {self.owner}/{self.repo_name} ({vis})",
                    issues=[],
                    fixes=[]
                )
            
            # If repo lookup failed, check if token / user is valid
            user_info = self._api_get("/user")
            if user_info:
                return ConnectionReport(
                    status="failed",
                    readable_scope=f"GitHub: {user_info.get('login')}",
                    issues=[f"Repository {self.owner}/{self.repo_name} not accessible or not found"],
                    fixes=["Check repository name, verify public access, or provide a token with 'repo' scope"]
                )
            return ConnectionReport(
                status="failed",
                readable_scope="",
                issues=["GitHub authentication failed"],
                fixes=["Check token validity", "Verify token has repo scope"]
            )

        # Case B: Organization access
        org_info = self._api_get(f"/orgs/{self.owner}")
        if org_info and not org_info.get("message"):
            return ConnectionReport(
                status="connected",
                readable_scope=f"GitHub: {self.owner} (public + private repos accessible)",
                issues=[],
                fixes=[]
            )
        
        # Case C: GitHub user account
        user_target = self._api_get(f"/users/{self.owner}")
        if user_target and not user_target.get("message"):
            return ConnectionReport(
                status="connected",
                readable_scope=f"GitHub user: {self.owner} (repositories accessible)",
                issues=[],
                fixes=[]
            )

        # Case D: Check authenticated user
        user_info = self._api_get("/user")
        if user_info and not user_info.get("message"):
            return ConnectionReport(
                status="partial",
                readable_scope=f"GitHub: {user_info.get('login')} (target access may be limited)",
                issues=[f"Organization or user {self.owner} not accessible"],
                fixes=["Check token has org read access", "Verify user/org name"]
            )
        
        return ConnectionReport(
            status="failed",
            readable_scope="",
            issues=["GitHub authentication failed"],
            fixes=["Check token validity", "Verify token has repo scope"]
        )
    
    def discover(self) -> List[RepoDescriptor]:
        """Discover repositories in GitHub org, user account, or single repo"""
        repos = []
        
        # Case A: Single repository specified
        if self.is_single_repo and self.repo_name:
            repo_data = self._api_get(f"/repos/{self.owner}/{self.repo_name}")
            if repo_data and not repo_data.get("message"):
                repo_info = self._convert_github_repo(repo_data)
                if repo_info:
                    repos.append(repo_info)
            return repos

        # Case B: Organization or user repositories
        page = 1
        is_user_endpoint = False
        while True:
            if not is_user_endpoint:
                data = self._api_get(f"/orgs/{self.owner}/repos?per_page=100&page={page}&type=all")
                if data is None and page == 1:
                    is_user_endpoint = True
                    data = self._api_get(f"/users/{self.owner}/repos?per_page=100&page={page}&sort=updated")
            else:
                data = self._api_get(f"/users/{self.owner}/repos?per_page=100&page={page}&sort=updated")

            if not data or not isinstance(data, list) or len(data) == 0:
                break
            
            for repo_data in data:
                repo_info = self._convert_github_repo(repo_data)
                if repo_info:
                    repos.append(repo_info)
            
            if len(data) < 100:
                break
            page += 1
            if page > 10:
                break
        
        return repos
    
    def _convert_github_repo(self, repo_data: Dict) -> Optional[RepoDescriptor]:
        """Convert GitHub API repo to RepoDescriptor"""
        try:
            name = repo_data["name"]
            owner = repo_data.get("owner", {}).get("login") or self.owner
            
            # Size (GitHub provides size in KB)
            size = repo_data.get("size", 0) * 1024
            
            # Commit count - fetch by paginating through commits (limited for Phase 1)
            commit_count = 0
            try:
                page = 1
                while page <= 10:  # Limit to 10 pages (1000 commits max)
                    commits = self._api_get(f"/repos/{owner}/{name}/commits?per_page=100&page={page}")
                    if not commits or not isinstance(commits, list) or len(commits) == 0:
                        break
                    commit_count += len(commits)
                    if len(commits) < 100:
                        break
                    page += 1
            except Exception:
                pass
            
            # Branch count
            branches = self._api_get(f"/repos/{owner}/{name}/branches?per_page=100")
            branch_count = len(branches) if branches and isinstance(branches, list) else 0
            
            # Tag count
            tags = self._api_get(f"/repos/{owner}/{name}/tags?per_page=100")
            tag_count = len(tags) if tags and isinstance(tags, list) else 0
            
            # Contributors
            contributors = self._api_get(f"/repos/{owner}/{name}/contributors?per_page=100")
            contributor_count = len(contributors) if contributors and isinstance(contributors, list) else 0
            
            # Last activity
            last_activity = repo_data.get("pushed_at", "")
            
            # Large file flag - check if repo size > 100MB
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
    
    def list_authors(self) -> List[AuthorInfo]:
        """List authors for GitHub repository from contributors or commits"""
        authors = []
        try:
            target_repo = self.repo_name
            if target_repo:
                contributors = self._api_get(f"/repos/{self.owner}/{target_repo}/contributors?per_page=100")
                if contributors and isinstance(contributors, list):
                    for c in contributors:
                        login = c.get("login") or "unknown"
                        commits = c.get("contributions", 1)
                        authors.append(AuthorInfo(username=login, commits=commits))
        except Exception:
            pass
        return authors

    def inspect(self, repo: RepoDescriptor) -> Dict[str, Any]:
        """Detailed inspection for Assessor (Phase 2)"""
        return {"repo": repo.name, "details": "T0 inspection complete"}


class GitRemoteConnector(VCSAdapter):
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
                creds = self.credentials_ref
                if self.source_type == "gitlab" and ":" not in creds:
                    creds = f"oauth2:{creds}"
                elif self.source_type == "azure_devops" and ":" not in creds:
                    creds = f":{creds}"
                url = f"{protocol}://{creds}@{rest}"
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

    def list_authors(self, repo_url: Optional[str] = None) -> List[AuthorInfo]:
        """Extract unique list of authors using git log if cloned or empty list"""
        target = Path(repo_url) if repo_url else None
        if target and (target / ".git").exists():
            try:
                cmd = ["git", "--git-dir", str(target / ".git"), "log", "--format=%an|%ad", "--date=iso"]
                res = run_cmd(cmd, timeout=20)
                if res.returncode == 0:
                    authors_data: Dict[str, Dict[str, Any]] = {}
                    for line in res.stdout.splitlines():
                        if "|" in line:
                            an, ad = line.split("|", 1)
                            an, ad = an.strip(), ad.strip()
                            if not an:
                                continue
                            if an not in authors_data:
                                authors_data[an] = {"username": an, "commits": 0, "dates": []}
                            authors_data[an]["commits"] += 1
                            if ad:
                                authors_data[an]["dates"].append(ad)
                    result = []
                    for username, data in authors_data.items():
                        dates = sorted(data["dates"])
                        result.append(AuthorInfo(
                            username=username,
                            commits=data["commits"],
                            first_commit_date=dates[0] if dates else None,
                            last_commit_date=dates[-1] if dates else None
                        ))
                    result.sort(key=lambda x: x.commits, reverse=True)
                    return result
            except Exception:
                pass
        return []


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
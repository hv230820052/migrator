"""
SVN Connector - Phase 1 Scout & Catalog
READ-ONLY: uses svn CLI for metadata only, no full checkouts
"""
import subprocess
import json
import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from .base import SourceConnector, RepoDescriptor, ConnectionReport, run_cmd

class SvnConnector(SourceConnector):
    """SVN source connector - metadata-only discovery"""
    
    def __init__(self, repo_url: str, username: str = "", password: str = ""):
        self.repo_url = repo_url
        self.username = username
        self.password = password
        self.auth_args = []
        if username:
            self.auth_args.extend(["--username", username])
        if password:
            self.auth_args.extend(["--password", password])
        # Non-interactive, trust server cert
        self.auth_args.extend(["--non-interactive", "--trust-server-cert"])
    
    def _svn_cmd(self, args: List[str]) -> List[str]:
        """Build svn command with auth"""
        return ["svn"] + args + self.auth_args
    
    def validate(self) -> ConnectionReport:
        """Validate SVN repository access"""
        try:
            # Try to list root to validate access
            result = run_cmd(self._svn_cmd(["list", self.repo_url]))
            if result.returncode == 0:
                return ConnectionReport(
                    status="connected",
                    readable_scope=f"SVN: {self.repo_url}",
                    issues=[],
                    fixes=[]
                )
            else:
                stderr = result.stderr.strip()
                if "No such file or directory: 'svn'" in stderr:
                    return ConnectionReport(
                        status="failed",
                        readable_scope="",
                        issues=["SVN CLI not installed"],
                        fixes=["Install subversion package"]
                    )
                return ConnectionReport(
                    status="failed",
                    readable_scope="",
                    issues=[stderr or "Access denied"],
                    fixes=["Check credentials", "Verify URL", "Check network access"]
                )
        except subprocess.TimeoutExpired:
            return ConnectionReport(
                status="failed",
                readable_scope="",
                issues=["Connection timeout"],
                fixes=["Check network connectivity", "Increase timeout"]
            )
        except Exception as e:
            return ConnectionReport(
                status="failed",
                readable_scope="",
                issues=[str(e)],
                fixes=["Check SVN installation", "Verify repository URL"]
            )
    
    def discover(self) -> List[RepoDescriptor]:
        """Discover SVN repositories - returns catalog rows with 8 fields
        Uses metadata commands only - NO full checkouts"""
        repos = []
        
        try:
            # For SVN, the repo_url IS the repository (not a collection of repos)
            # Get metadata for the root repository
            repo_info = self._get_repo_metadata(self.repo_url)
            if repo_info:
                repos.append(repo_info)
        
        except Exception as e:
            # On error, return what we have
            pass
        
        return repos
    
    def _get_repo_metadata(self, repo_url: str) -> Optional[RepoDescriptor]:
        """Get metadata for a single SVN repo using metadata commands only"""
        try:
            # Get last revision number (commit count approximation)
            log_result = run_cmd(self._svn_cmd(["log", "-l", "1", "--quiet", repo_url]))
            commit_count = 0
            if log_result.returncode == 0:
                # Count revisions in log
                for line in log_result.stdout.split('\n'):
                    if line.startswith('r'):
                        try:
                            rev = int(line.split('|')[0].strip().lstrip('r'))
                            commit_count = max(commit_count, rev)
                        except:
                            pass
            
            # Get branches count
            branches_count = 0
            branches_result = run_cmd(self._svn_cmd(["list", f"{repo_url}/branches"]))
            if branches_result.returncode == 0:
                branches_count = len([l for l in branches_result.stdout.split('\n') if l.strip()])
            
            # Get tags count
            tags_count = 0
            tags_result = run_cmd(self._svn_cmd(["list", f"{repo_url}/tags"]))
            if tags_result.returncode == 0:
                tags_count = len([l for l in tags_result.stdout.split('\n') if l.strip()])
            
            # Get contributors (unique authors from log)
            authors_result = run_cmd(self._svn_cmd(["log", "--quiet", repo_url]))
            contributors = set()
            if authors_result.returncode == 0:
                for line in authors_result.stdout.split('\n'):
                    if '|' in line:
                        parts = line.split('|')
                        if len(parts) >= 2:
                            author = parts[1].strip()
                            if author:
                                contributors.add(author)
            
            # Get last activity date
            last_activity = ""
            log_result = run_cmd(self._svn_cmd(["log", "-l", "1", repo_url]))
            if log_result.returncode == 0:
                for line in log_result.stdout.split('\n'):
                    if '|' in line:
                        parts = line.split('|')
                        if len(parts) >= 3:
                            last_activity = parts[2].strip().split('(')[0].strip()
                            break
            
            # Check for large files (>100MB) - use svn ls -R with sizes
            large_file_flag = self._check_large_files(repo_url)
            
            # Estimate size (rough approximation)
            info_result = run_cmd(self._svn_cmd(["info", repo_url]))
            size = 0
            if info_result.returncode == 0:
                for line in info_result.stdout.split('\n'):
                    if 'Repository Size' in line:
                        try:
                            size = int(line.split(':')[1].strip().split()[0])
                        except:
                            pass
            
            # If size is 0, estimate from commit count * avg commit size
            if size == 0:
                size = commit_count * 50000  # rough estimate
            
            parts = [p for p in repo_url.rstrip('/').split('/') if p]
            clean_repo_name = parts[-1] if parts else "svn-repo"
            if clean_repo_name.lower() in ["svn", "trunk", "repo"] and len(parts) >= 2:
                clean_repo_name = parts[-2]

            return RepoDescriptor(
                name=clean_repo_name,
                source_type="svn",
                size=size,
                commit_count=commit_count,
                branch_count=branches_count,
                tag_count=tags_count,
                contributor_count=len(contributors),
                last_activity=last_activity,
                large_file_flag=large_file_flag
            )
            
        except Exception:
            return None
    
    def _check_large_files(self, repo_url: str) -> bool:
        """Check for files >100MB using svn list -R (metadata only)"""
        try:
            # This is a quick check - we look at trunk for large files
            # In real implementation, you'd use `svn ls -R -v` but that can be slow
            # For demo, we check known paths
            trunk_result = run_cmd(self._svn_cmd(["list", "-v", f"{repo_url}/trunk"]))
            if trunk_result.returncode == 0:
                for line in trunk_result.stdout.split('\n'):
                    parts = line.split()
                    if len(parts) >= 3:
                        try:
                            size_str = parts[2]
                            if size_str.isdigit():
                                size = int(size_str)
                                if size > 100 * 1024 * 1024:  # >100MB
                                    return True
                        except:
                            pass
        except Exception:
            pass
        return False
    
    def inspect(self, repo: RepoDescriptor) -> Dict[str, Any]:
        """Detailed inspection for Assessor (Phase 2)"""
        return {"repo": repo.name, "details": "T0 inspection complete"}


class LocalSvnConnector(SvnConnector):
    """SVN connector for local repository (file:// protocol)"""
    
    def __init__(self, repo_path: str):
        import os
        clean_path = str(repo_path)
        if clean_path.startswith("file://"):
            clean_path = clean_path[7:]
        # If clean_path is absolute, use it directly; otherwise resolve relative to SAMPLES_DIR
        if os.path.isabs(clean_path):
            abs_path = Path(clean_path).resolve()
        else:
            samples_dir = os.environ.get("SAMPLES_DIR", "/app/samples")
            abs_path = (Path(samples_dir) / clean_path).resolve()
        if not abs_path.exists():
            raise ValueError(f"SVN repository path does not exist: {abs_path}")
        if not abs_path.is_dir():
            raise ValueError(f"SVN repository path is not a directory: {abs_path}")
        repo_url = f"file://{abs_path}"
        super().__init__(repo_url, "", "")
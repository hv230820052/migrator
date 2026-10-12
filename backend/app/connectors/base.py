"""
Base connector interface - Phase 1 Scout & Catalog
All connectors are strictly READ-ONLY - no writes to sources
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
from pathlib import Path
import subprocess
import json
import os
import time

@dataclass
class RepoDescriptor:
    """Catalog row with exactly 8 metadata fields per FR-01"""
    name: str
    source_type: str
    size: int  # bytes
    commit_count: int
    branch_count: int
    tag_count: int
    contributor_count: int
    last_activity: str  # ISO8601 timestamp
    large_file_flag: bool  # True if any file >100MB
    
    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class ConnectionReport:
    """Result of source validation"""
    status: str  # "connected" | "failed" | "partial"
    readable_scope: str
    issues: List[str]
    fixes: List[str]

@dataclass
class AuthorInfo:
    """Discovered author record per VCS history"""
    username: str
    commits: int
    first_commit_date: Optional[str] = None
    last_commit_date: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)

def parse_svn_log_authors(log_output: str) -> List[AuthorInfo]:
    """Parse output from svn log -q / svn log --quiet into structured AuthorInfo list"""
    authors_data: Dict[str, Dict[str, Any]] = {}
    for line in log_output.splitlines():
        line = line.strip()
        if not line or line.startswith("-"):
            continue
        if "|" in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 3 and parts[0].startswith("r"):
                username = parts[1] if parts[1] else "(no author)"
                raw_date = parts[2].split("(")[0].strip()
                if username not in authors_data:
                    authors_data[username] = {
                        "username": username,
                        "commits": 0,
                        "dates": []
                    }
                authors_data[username]["commits"] += 1
                if raw_date:
                    authors_data[username]["dates"].append(raw_date)

    result = []
    for username, data in authors_data.items():
        dates = sorted(data["dates"])
        first_date = dates[0] if dates else None
        last_date = dates[-1] if dates else None
        result.append(AuthorInfo(
            username=username,
            commits=data["commits"],
            first_commit_date=first_date,
            last_commit_date=last_date
        ))
    result.sort(key=lambda x: x.commits, reverse=True)
    return result

class SourceConnector(ABC):
    """Abstract base for all source connectors - READ-ONLY"""
    
    @abstractmethod
    def validate(self) -> ConnectionReport:
        """Validate connectivity and permissions"""
        pass
    
    @abstractmethod
    def discover(self) -> List[RepoDescriptor]:
        """Discover repositories - returns catalog rows with 8 fields"""
        pass
    
    @abstractmethod
    def inspect(self, repo: RepoDescriptor) -> Dict[str, Any]:
        """Inspect single repo for detailed stats (optional)"""
        pass

class VCSAdapter(SourceConnector):
    """Abstract VCS adapter interface for extracting history and authors across VCS types"""

    @abstractmethod
    def list_authors(self, repo_url: Optional[str] = None) -> List[AuthorInfo]:
        """Extract unique list of authors with commit count, first commit date, and last commit date"""
        pass

def run_cmd(cmd: List[str], cwd: Optional[str] = None, timeout: int = 30) -> subprocess.CompletedProcess:
    """Run command with timeout, return CompletedProcess"""
    return subprocess.run(
        cmd, 
        cwd=cwd, 
        capture_output=True, 
        text=True, 
        timeout=timeout
    )
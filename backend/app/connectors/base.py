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

def run_cmd(cmd: List[str], cwd: Optional[str] = None, timeout: int = 30) -> subprocess.CompletedProcess:
    """Run command with timeout, return CompletedProcess"""
    return subprocess.run(
        cmd, 
        cwd=cwd, 
        capture_output=True, 
        text=True, 
        timeout=timeout
    )
"""
Connectors package - Phase 1 Scout & Catalog
All connectors are strictly READ-ONLY
"""
from .base import SourceConnector, RepoDescriptor, ConnectionReport
from .svn import SvnConnector, LocalSvnConnector
from .localgit import LocalGitConnector, GitHubConnector, TfsSampleConnector

__all__ = [
    "SourceConnector",
    "RepoDescriptor", 
    "ConnectionReport",
    "SvnConnector",
    "LocalSvnConnector",
    "LocalGitConnector",
    "GitHubConnector",
    "TfsSampleConnector"
]
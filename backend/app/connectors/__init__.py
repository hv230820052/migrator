"""
Connectors package - Phase 1 Scout & Catalog
All connectors are strictly READ-ONLY
"""
from .base import SourceConnector, VCSAdapter, RepoDescriptor, ConnectionReport, AuthorInfo, parse_svn_log_authors
from .svn import SvnConnector, LocalSvnConnector
from .localgit import LocalGitConnector, GitHubConnector, TfsSampleConnector, GitRemoteConnector

__all__ = [
    "SourceConnector",
    "VCSAdapter",
    "AuthorInfo",
    "parse_svn_log_authors",
    "RepoDescriptor", 
    "ConnectionReport",
    "SvnConnector",
    "LocalSvnConnector",
    "LocalGitConnector",
    "GitHubConnector",
    "TfsSampleConnector",
    "GitRemoteConnector"
]
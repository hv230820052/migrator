"""
Scout Agent - Phase 1 Scout & Catalog
T0 only - zero LLM calls
Streams catalog rows over WebSocket as discovered (incremental, never batch-at-end)
"""
import asyncio
import json
import time
from typing import List, Dict, Any, Optional
from dataclasses import asdict

from ..connectors import (
    SvnConnector, LocalSvnConnector, 
    LocalGitConnector, GitHubConnector, TfsSampleConnector,
    RepoDescriptor, ConnectionReport
)
from ..cascade.router import DecisionRouter
from ..models import Source, Repo

class ScoutAgent:
    """Scout agent - discovers repositories from all connected sources"""
    
    def __init__(self, db_session, event_emitter=None):
        self.db = db_session
        self.event_emitter = event_emitter
        self.router = DecisionRouter()
    
    async def run_discovery(self, run_id: int, source_ids: List[int]) -> List[RepoDescriptor]:
        """Run discovery for all sources, streaming results via WebSocket"""
        all_repos = []
        
        for source_id in source_ids:
            source = self.db.query(Source).filter(Source.id == source_id).first()
            if not source:
                continue
            
            # Validate source first
            connector = self._create_connector(source)
            if not connector:
                continue
            
            report = connector.validate()
            
            # Emit source validation event
            if self.event_emitter:
                await self.event_emitter(run_id, {
                    "agent": "Scout",
                    "action": f"Source {source.type} validated",
                    "reason": f"Status: {report.status} - {report.readable_scope}",
                    "tier": "T0"
                })
            
            if report.status != "connected":
                # Still continue with other sources (US-01 AC2)
                continue
            
            # Discover repos - stream each as found
            repos = connector.discover()
            
            for repo_desc in repos:
                # Save to database
                repo = Repo(
                    source_id=source.id,
                    name=repo_desc.name,
                    size=repo_desc.size,
                    commits=repo_desc.commit_count,
                    branches=repo_desc.branch_count,
                    tags=repo_desc.tag_count,
                    contributors=str(repo_desc.contributor_count),
                    last_activity=repo_desc.last_activity,
                    large_files=1 if repo_desc.large_file_flag else 0
                )
                self.db.add(repo)
                self.db.flush()  # Get ID
                
                repo_desc_dict = asdict(repo_desc)
                repo_desc_dict["db_id"] = repo.id
                
                # Emit repo discovered event (incremental streaming)
                if self.event_emitter:
                    await self.event_emitter(run_id, {
                        "agent": "Scout",
                        "action": f"Discovered {repo_desc.name}",
                        "reason": f"{repo_desc.source_type} repo with {repo_desc.commit_count} commits, {repo_desc.branch_count} branches",
                        "tier": "T0",
                        "repo": repo_desc_dict
                    })
                
                all_repos.append(repo_desc)
                
                # Small delay to show streaming effect
                await asyncio.sleep(0.05)
        
        self.db.commit()
        return all_repos
    
    def _create_connector(self, source: Source):
        """Create appropriate connector for source type"""
        if source.type == "svn":
            return LocalSvnConnector(source.endpoint)
        elif source.type == "localgit":
            return LocalGitConnector(source.endpoint)
        elif source.type == "github":
            # Get token from config/env
            import os
            token = os.environ.get("GITHUB_PAT", "")
            if not token:
                return None
            return GitHubConnector(source.endpoint, token)
        elif source.type == "tfs":
            # TFS sample connector - use endpoint from source
            return TfsSampleConnector(source.endpoint)
        return None


class DiscoveryService:
    """High-level service for running discovery"""
    
    def __init__(self, db_session, event_emitter=None):
        self.scout = ScoutAgent(db_session, event_emitter)
    
    async def discover_all(self, run_id: int, source_ids: List[int]) -> Dict[str, Any]:
        """Run full discovery and return summary"""
        start_time = time.time()
        
        repos = await self.scout.run_discovery(run_id, source_ids)
        
        elapsed = time.time() - start_time
        
        # Summary
        summary = {
            "total_repos": len(repos),
            "by_source": {},
            "elapsed_seconds": elapsed,
            "performance_ok": elapsed < 60  # FR-01 performance target
        }
        
        for repo in repos:
            st = repo.source_type
            if st not in summary["by_source"]:
                summary["by_source"][st] = 0
            summary["by_source"][st] += 1
        
        return summary
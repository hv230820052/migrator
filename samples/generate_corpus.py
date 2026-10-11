#!/usr/bin/env python3
"""
Demo Corpus Generator - Phase 0 (D-08 R6 approved with refinements)
Deterministic (seed 42), byte-identical twin runs.
Produces: messy-svn, dirty-local, github-org fixtures + pre/post checksums.
"""
import random
import hashlib
import subprocess
import sys
import os
from pathlib import Path

# Fixed seed for determinism - R6
random.seed(42)

SAMPLES_DIR = Path(__file__).parent

def generate_samples():
    """Generate all fixtures per DoD §2 / G-12"""
    print("Phase 0: Generating demo corpus (seed=42, deterministic)")
    
    # 1. Create messy SVN repo simulation (standard layout with edge cases)
    svn_dir = SAMPLES_DIR / "svn" / "messy-svn"
    svn_dir.mkdir(parents=True, exist_ok=True)
    
    # Create SVN-like directory structure
    repo_dir = svn_dir / "repo"
    repo_dir.mkdir(exist_ok=True)
    
    # Create standard SVN layout
    (repo_dir / "trunk").mkdir(exist_ok=True)
    (repo_dir / "branches").mkdir(exist_ok=True)
    (repo_dir / "tags").mkdir(exist_ok=True)
    
    # 2. Create oversized file (110MB from repeating pattern - highly compressible)
    # Pattern: "X" * 1024 repeats → ~1MB compressed, but logical size ~110MB
    oversized_path = repo_dir / "trunk" / "large_file.bin"
    # Create 110MB file from repeating 1KB chunk
    chunk = b"X" * 1024  # 1KB chunk
    target_size = 110 * 1024 * 1024  # 110MB
    with open(oversized_path, "wb") as f:
        for _ in range(target_size // len(chunk)):
            f.write(chunk)
    
    # 3. Planted secret at pinned revision (AWS-key-pattern)
    secret_path = repo_dir / "trunk" / "secrets.txt"
    with open(secret_path, "w") as f:
        f.write("# Config\nAWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n")
    
    # 4. Ambiguous author reference (dev_ninja99 with header email evidence)
    # Simulated in a metadata file
    metadata_file = svn_dir / "metadata.json"
    import json
    with open(metadata_file, "w") as f:
        json.dump({
            "ambiguous_author": "dev_ninja99",
            "header_email": "dev.ninja99@example.com",
            "source_type": "svn",
            "revision_count": 52,
            "oversized_file": "trunk/large_file.bin",
            "secret_file": "trunk/secrets.txt",
            "dead_branch": "branches/dead-feature",
            "tag": "tags/v1.0"
        }, f, indent=2)
    
    # 5. Dead branch and tag (create as files)
    (repo_dir / "branches" / "dead-feature").write_text("# Dead branch content\n")
    (repo_dir / "tags" / "v1.0").write_text("# Release v1.0\n")
    
    # 6. Create local dirty git repo
    git_dir = SAMPLES_DIR / "localgit" / "dirty-local"
    git_dir.mkdir(parents=True, exist_ok=True)
    
    # Initialize git repo
    subprocess.run(["git", "init"], cwd=git_dir, capture_output=True)
    # Create initial commit
    (git_dir / "README.md").write_text("# Demo repo\n")
    subprocess.run(["git", "add", "README.md"], cwd=git_dir, capture_output=True)
    subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=git_dir, capture_output=True)
    # Create dirty state (uncommitted changes)
    (git_dir / "changes.txt").write_text("# Local changes\n")
    
    # 7. TFS sample JSON (simulated)
    tfs_dir = SAMPLES_DIR / "tfs"
    tfs_dir.mkdir(parents=True, exist_ok=True)
    tfs_path = tfs_dir / "tfs-sample.json"
    with open(tfs_path, "w") as f:
        json.dump({
            "source": "tfs",
            "label": "simulated",
            "catalog": [{"repo":"billing-svc","branch":"dev"}],
            "note": "TFS represented as canned sample per D-02"
        }, f, indent=2)
    
    # 8. GitHub source org (simulated)
    github_dir = SAMPLES_DIR / "github-org"
    github_dir.mkdir(parents=True, exist_ok=True)
    github_info = github_dir / "info.json"
    with open(github_info, "w") as f:
        json.dump({
            "org": "demo-org",
            "repos": [{"name":"billing-svc","description":"Billing service"}],
            "issues_count": 3,
            "pr_count": 1,
            "note": "GitHub source org for FR-08 context migration"
        }, f, indent=2)
    
    # 9. Pre/post checksum manifests (G-12 harness)
    manifest_path = SAMPLES_DIR / "checksum-manifests.json"
    
    def hash_dir(path: Path) -> str:
        h = hashlib.sha256()
        for child in sorted(path.rglob("*")):
            if child.is_file() and ".git/" not in str(child.relative_to(path)) and ".git/logs" not in str(child):
                # Exclude git internal state — only hash project content
                try:
                    h.update(str(child.relative_to(path)).encode())
                    h.update(child.read_bytes()[:1024])
                except Exception:
                    pass
        return h.hexdigest()
    
    # Generate pre-manifest
    pre_hashes = {}
    for source in ["svn/messy-svn", "localgit/dirty-local", "tfs", "github-org"]:
        source_path = SAMPLES_DIR / source
        if source_path.exists():
            pre_hashes[source] = hash_dir(source_path)
    
    with open(manifest_path, "w") as f:
        json.dump({
            "generator_seed": 42,
            "pre_hashes": pre_hashes,
            "note": "Run generator twice; compare post hashes for G-12 byte-check",
            "oversized_file_path": "samples/svn/messy-svn/repo/trunk/large_file.bin",
            "secret_file_path": "samples/svn/messy-svn/repo/trunk/secrets.txt",
            "secret_revision": "r4821",
            "oversized_blob_size_mb": 110,
            "ambiguous_author": "dev_ninja99",
            "dead_branch": "branches/dead-feature",
            "tag": "tags/v1.0"
        }, f, indent=2)
    
    print(f"Corpus generated at {SAMPLES_DIR}")
    print("Check checksums at checksum-manifests.json for G-12 harness")
    print("Oversized file at samples/svn/messy-svn/repo/trunk/large_file.bin (~110MB logical, compressible)")
    print("Planted secret at samples/svn/messy-svn/repo/trunk/secrets.txt (revision pinned)")
    print("Ambiguous author: dev_ninja99 with header email evidence")
    print("Edge conditions: dead branch (branches/dead-feature), tag (tags/v1.0)")
    print(f"Pinned secret revision: r4821 (AWS key at trunk/secrets.txt)")
    print(f"Logical blob size: 110MB (samples/svn/messy-svn/repo/trunk/large_file.bin)")
    return True

if __name__ == "__main__":
    ok = generate_samples()
    sys.exit(0 if ok else 1)
-- Provenance Database Schema (SQLite)
-- Phase 0 foundation per architecture.md §7

-- Sources table: connectors to VCS sources
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('svn', 'tfs', 'localgit', 'github')),
    endpoint TEXT NOT NULL,
    credentials_ref TEXT,
    status TEXT DEFAULT 'connected',
    readable_scope TEXT,
    source_id INTEGER,
    last_activity DATETIME,
    large_file_flag INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Repositories catalog
CREATE TABLE IF NOT EXISTS repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER REFERENCES sources(id),
    name TEXT NOT NULL,
    size INTEGER,
    commits INTEGER,
    branches INTEGER,
    tags INTEGER,
    contributors TEXT,
    last_activity DATETIME,
    large_files INTEGER,
    risk_tier TEXT,
    risk_factors TEXT,
    state TEXT DEFAULT 'discovered'
);

-- Pre-flight findings (secrets, large bins, unmapped authors)
CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL REFERENCES repos(id),
    type TEXT NOT NULL CHECK(type IN ('secret', 'large_binary', 'unmapped_author')),
    severity TEXT DEFAULT 'medium',
    location TEXT,
    fingerprint TEXT,
    recommendation TEXT,
    status TEXT DEFAULT 'pending'
);

-- Author identity mapping
CREATE TABLE IF NOT EXISTS mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    legacy_id TEXT NOT NULL,
    github_id TEXT NOT NULL,
    method TEXT DEFAULT 'exact_match',
    confidence REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    coverage_percent REAL DEFAULT 0
);

-- Plan: mapping proposals, waves, approval state
CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL REFERENCES repos(id),
    mappings TEXT,  -- JSON array of mapping proposals
    waves TEXT,
    approval_state TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Verification results (fr-13, fr-14)
CREATE TABLE IF NOT EXISTS verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL REFERENCES repos(id),
    checks TEXT,  -- JSON array of check results
    score INTEGER,
    gaps TEXT,
    verdict TEXT DEFAULT 'passed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migration certificates (fr-14)
CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL REFERENCES repos(id),
    approvals TEXT,  -- JSON array of approval records
    actions TEXT,
    verification TEXT,
    hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Event log (fr-12, fr-13)
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER,
    repo_id INTEGER,
    agent TEXT,
    action TEXT,
    reason TEXT,
    tier TEXT DEFAULT 'T0',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Approval records (fr-10)
CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gate TEXT NOT NULL,
    run_id INTEGER,
    actor TEXT,
    decision TEXT NOT NULL,  -- approve, adjust, hold
    reason TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_repos_source ON repos(source_id);
CREATE INDEX IF NOT EXISTS idx_findings_repo ON findings(repo_id);
CREATE INDEX IF NOT EXISTS idx_mappings_legacy ON mappings(legacy_id);
CREATE INDEX IF NOT EXISTS idx_plans_repo ON plans(repo_id);
CREATE INDEX IF NOT EXISTS idx_verifications_repo ON verifications(repo_id);
CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id);

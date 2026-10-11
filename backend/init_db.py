#!/usr/bin/env python3
"""
Initialize SQLite database with schema from architecture.md §7
Phase 0 Foundation
"""
import sqlite3
import os
from pathlib import Path

SCHEMA_PATH = Path(__file__).parent / "models" / "schema.sql"
DB_PATH = Path(__file__).parent / "data" / "provenance.db"

def init_database():
    """Create database and apply schema"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    with open(SCHEMA_PATH, 'r') as f:
        schema_sql = f.read()
    
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(schema_sql)
    conn.commit()
    
    # Verify tables
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"Created tables: {tables}")
    
    # Verify schema against required tables per arch.md §7
    required = {'sources', 'repos', 'findings', 'mappings', 'plans', 
                'verifications', 'certificates', 'events', 'approvals'}
    missing = required - set(tables)
    if missing:
        print(f"ERROR: Missing tables: {missing}")
        return False
    
    print(f"Database initialized at {DB_PATH}")
    return True

if __name__ == "__main__":
    success = init_database()
    exit(0 if success else 1)
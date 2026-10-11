#!/bin/bash
# Entrypoint script - runs at container startup
set -e

# Initialize SVN repo from samples structure
SVN_REPO_PATH="/app/data/messy-svn-repo"
SAMPLE_REPO="/app/samples/svn/messy-svn/repo"

if [ ! -d "$SVN_REPO_PATH/db" ]; then
    echo "Initializing SVN repo at $SVN_REPO_PATH from $SAMPLE_REPO"
    svnadmin create "$SVN_REPO_PATH"
    
    WORKSPACE="/tmp/svn-workspace"
    rm -rf "$WORKSPACE"
    svn checkout "file://$SVN_REPO_PATH" "$WORKSPACE"
    cp -r "$SAMPLE_REPO"/* "$WORKSPACE/"
    cd "$WORKSPACE"
    svn add --force .
    svn commit -m "Initial import from samples"
    echo "SVN repo initialized at $SVN_REPO_PATH"
else
    echo "SVN repo already exists at $SVN_REPO_PATH"
fi

# Initialize DB (from /app)
cd /app
python init_db.py

# Start server with auto-reload
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
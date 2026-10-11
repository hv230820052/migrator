#!/bin/bash
# Initialize SVN repo from samples structure
set -e

SVN_REPO_PATH="/app/data/messy-svn-repo"
SAMPLE_REPO="/app/samples/svn/messy-svn/repo"

echo "Initializing SVN repo at $SVN_REPO_PATH from $SAMPLE_REPO"

# Create SVN repo
svnadmin create "$SVN_REPO_PATH"

# Checkout to temp workspace
WORKSPACE="/tmp/svn-workspace"
rm -rf "$WORKSPACE"
svn checkout "file://$SVN_REPO_PATH" "$WORKSPACE"

# Copy sample structure
cp -r "$SAMPLE_REPO"/* "$WORKSPACE/"

# Add and commit
cd "$WORKSPACE"
svn add --force .
svn commit -m "Initial import from samples"

echo "SVN repo initialized at $SVN_REPO_PATH"
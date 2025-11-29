#!/bin/bash

# Script to create GitHub releases for Content Safety Lock
# This script uses the GitHub CLI (gh) to create releases
#
# Usage:
#   ./create-github-releases.sh <version> <title> [--latest]
#
# Examples:
#   ./create-github-releases.sh 1.2.2 "Bug Fixes"
#   ./create-github-releases.sh 1.3.0 "New Features" --latest
#
# Prerequisites:
#   1. GitHub CLI installed: sudo port install gh
#   2. Authenticated: gh auth login
#   3. Build artifact exists: web-ext-artifacts/content_safety_lock-<version>.zip
#   4. Release notes exist: web-ext-artifacts/RELEASE_NOTES_v<version>.md
#
# Steps to create a new release:
#   1. Update CHANGELOG.md with new version
#   2. Update manifest.json version
#   3. Build extension: web-ext build
#   4. Create release notes: web-ext-artifacts/RELEASE_NOTES_v<version>.md
#   5. Run this script: ./create-github-releases.sh <version> "<title>" [--latest]

set -e

REPO="dwright/content-safety-lock"
ARTIFACTS_DIR="web-ext-artifacts"

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <version> <title> [--latest]"
    echo ""
    echo "Examples:"
    echo "  $0 1.2.2 \"Bug Fixes\""
    echo "  $0 1.3.0 \"New Features\" --latest"
    exit 1
fi

VERSION="$1"
TITLE="$2"
LATEST_FLAG=""

if [ "$3" = "--latest" ]; then
    LATEST_FLAG="--latest"
fi

ZIP_FILE="$ARTIFACTS_DIR/content_safety_lock-$VERSION.zip"
NOTES_FILE="$ARTIFACTS_DIR/RELEASE_NOTES_v$VERSION.md"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "ERROR: GitHub CLI (gh) is not installed."
    echo "Please install it: sudo port install gh"
    echo "Then authenticate: gh auth login"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "ERROR: Not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

# Check if files exist
if [ ! -f "$ZIP_FILE" ]; then
    echo "ERROR: ZIP file not found: $ZIP_FILE"
    echo "Please build the extension first: web-ext build"
    exit 1
fi

if [ ! -f "$NOTES_FILE" ]; then
    echo "ERROR: Release notes not found: $NOTES_FILE"
    echo "Please create release notes file first."
    exit 1
fi

echo "Creating GitHub Release for Content Safety Lock v$VERSION"
echo "=========================================================="
echo ""
echo "Version: $VERSION"
echo "Title: $TITLE"
echo "ZIP: $ZIP_FILE"
echo "Notes: $NOTES_FILE"
echo "Latest: ${LATEST_FLAG:-no}"
echo ""

# Create release
echo "Creating release v$VERSION..."
gh release create "v$VERSION" \
    --repo "$REPO" \
    --title "Content Safety Lock v$VERSION - $TITLE" \
    --notes-file "$NOTES_FILE" \
    $LATEST_FLAG \
    "$ZIP_FILE"

echo ""
echo "✅ Release v$VERSION created successfully!"
echo ""
echo "View release at: https://github.com/$REPO/releases/tag/v$VERSION"

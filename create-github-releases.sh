#!/bin/bash

# Script to create GitHub releases for Content Safety Lock
#
# Builds and packages every browser target, then creates a GitHub release that
# carries one archive per browser (Firefox, Chrome/Edge/Brave/Opera, Safari).
#
# Usage:
#   ./create-github-releases.sh <version> <title> [--latest] [--skip-build]
#
# Examples:
#   ./create-github-releases.sh 1.5.0 "Multi-browser support" --latest
#   ./create-github-releases.sh 1.5.1 "Bug Fixes"
#
# Prerequisites:
#   1. GitHub CLI installed: brew install gh
#   2. Authenticated: gh auth login
#   3. <version> matches the "version" field in package.json
#   4. Release notes exist: release-notes/RELEASE_NOTES_v<version>.md
#
# Steps to create a new release:
#   1. Update CHANGELOG.md with the new version
#   2. Update the version in package.json (the build stamps every manifest)
#   3. Create release notes: release-notes/RELEASE_NOTES_v<version>.md
#   4. Run this script: ./create-github-releases.sh <version> "<title>" [--latest]
#
# Releases are also produced automatically by .github/workflows/release.yml when
# a v<version> tag is pushed; run this script for a manual/local release.

set -euo pipefail

REPO="dwright/content-safety-lock"
DIST_DIR="dist"
NOTES_DIR="release-notes"
TARGETS=(firefox chrome safari)

if [ $# -lt 2 ]; then
    echo "Usage: $0 <version> <title> [--latest] [--skip-build]"
    echo ""
    echo "Examples:"
    echo "  $0 1.5.0 \"Multi-browser support\" --latest"
    echo "  $0 1.5.1 \"Bug Fixes\""
    exit 1
fi

VERSION="$1"
TITLE="$2"
shift 2

LATEST_FLAG=""
SKIP_BUILD="no"

for arg in "$@"; do
    case "$arg" in
        --latest) LATEST_FLAG="--latest" ;;
        --skip-build) SKIP_BUILD="yes" ;;
        *) echo "ERROR: unknown option: $arg"; exit 1 ;;
    esac
done

NOTES_FILE="$NOTES_DIR/RELEASE_NOTES_v$VERSION.md"

# Check tooling
if ! command -v gh &> /dev/null; then
    echo "ERROR: GitHub CLI (gh) is not installed."
    echo "Please install it: brew install gh"
    echo "Then authenticate: gh auth login"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "ERROR: Not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

# The build stamps package.json's version into every manifest, so a mismatch
# would publish archives whose contents disagree with the release tag.
PKG_VERSION=$(node -p "require('./package.json').version")
if [ "$PKG_VERSION" != "$VERSION" ]; then
    echo "ERROR: package.json version ($PKG_VERSION) does not match requested release ($VERSION)."
    echo "Update package.json first."
    exit 1
fi

if [ ! -f "$NOTES_FILE" ]; then
    echo "ERROR: Release notes not found: $NOTES_FILE"
    echo "Please create the release notes file first."
    exit 1
fi

# Build and package all browsers
if [ "$SKIP_BUILD" = "yes" ]; then
    echo "Skipping build (--skip-build): using existing archives in $DIST_DIR/"
else
    echo "Running tests..."
    npm test
    echo "Packaging all browser targets..."
    npm run package:all
fi

ASSETS=()
for target in "${TARGETS[@]}"; do
    asset="$DIST_DIR/content-safety-lock-$target-$VERSION.zip"
    if [ ! -f "$asset" ]; then
        echo "ERROR: Missing archive: $asset"
        echo "Run: npm run package:all"
        exit 1
    fi
    ASSETS+=("$asset#Content Safety Lock $VERSION ($target)")
done

echo "Creating GitHub Release for Content Safety Lock v$VERSION"
echo "=========================================================="
echo ""
echo "Version: $VERSION"
echo "Title:   $TITLE"
echo "Notes:   $NOTES_FILE"
echo "Latest:  ${LATEST_FLAG:-no}"
echo "Assets:"
for target in "${TARGETS[@]}"; do
    echo "  $DIST_DIR/content-safety-lock-$target-$VERSION.zip"
done
echo ""

gh release create "v$VERSION" \
    --repo "$REPO" \
    --title "Content Safety Lock v$VERSION - $TITLE" \
    --notes-file "$NOTES_FILE" \
    $LATEST_FLAG \
    "${ASSETS[@]}"

echo ""
echo "Release v$VERSION created successfully."
echo ""
echo "View release at: https://github.com/$REPO/releases/tag/v$VERSION"

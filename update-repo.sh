#!/bin/bash

# Script to update git remote and pull latest code on VPS
# Usage: ./update-repo.sh [new-repo-url] [branch-name]

set -e

NEW_REPO_URL=${1:-""}
BRANCH_NAME=${2:-"main"}
PROJECT_DIR="/home/dev/projects/evidently"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if repo URL is provided
if [ -z "$NEW_REPO_URL" ]; then
    print_error "Please provide the new repository URL"
    echo "Usage: ./update-repo.sh <new-repo-url> [branch-name]"
    echo "Example: ./update-repo.sh https://github.com/username/evidently-aeo.git main"
    exit 1
fi

# Navigate to project directory
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# Show current remote
print_info "Current remote configuration:"
git remote -v
echo ""

# Update remote URL
print_info "Updating remote URL to: $NEW_REPO_URL"
git remote set-url origin "$NEW_REPO_URL"

# Verify update
print_info "Updated remote configuration:"
git remote -v
echo ""

# Fetch from new remote
print_info "Fetching from new repository..."
git fetch origin

# Check if branch exists
if git show-ref --verify --quiet refs/remotes/origin/$BRANCH_NAME; then
    print_info "Branch '$BRANCH_NAME' found. Pulling latest code..."
    git pull origin $BRANCH_NAME
else
    print_warn "Branch '$BRANCH_NAME' not found. Available branches:"
    git branch -r
    exit 1
fi

print_info "Repository update complete!"
print_info "You can now run: ./deploy.sh all"


#!/bin/bash

# Deployment script for Evidently application
# Usage: ./deploy.sh [backend|frontend|all]

set -e  # Exit on error

DEPLOY_TYPE=${1:-all}
PROJECT_DIR="/home/dev/projects/evidently"
BACKEND_DIR="$PROJECT_DIR/backend"
LOG_DIR="/home/dev/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as correct user
if [ "$USER" != "dev" ]; then
    print_warn "This script is designed to run as 'dev' user. Current user: $USER"
fi

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Deploy backend
deploy_backend() {
    print_info "Deploying backend..."
    
    cd "$BACKEND_DIR"
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        print_error ".env file not found in backend directory!"
        print_info "Please create .env file from env.template"
        exit 1
    fi
    
    # Install dependencies
    print_info "Installing backend dependencies..."
    npm install --production
    
    # Build the project
    print_info "Building backend..."
    npm run build
    
    # Check if build was successful
    if [ ! -f "dist/app.js" ]; then
        print_error "Build failed! dist/app.js not found."
        exit 1
    fi
    
    # Restart PM2 process
    print_info "Restarting backend with PM2..."
    pm2 restart evidently-backend || pm2 start ecosystem.config.js
    
    print_info "Backend deployment complete!"
}

# Deploy frontend
deploy_frontend() {
    print_info "Deploying frontend..."
    
    cd "$PROJECT_DIR"
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        print_warn ".env file not found in frontend directory!"
        print_info "Please create .env file from env.template"
    fi
    
    # Install dependencies
    print_info "Installing frontend dependencies..."
    npm install
    
    # Build the project
    print_info "Building frontend..."
    npm run build
    
    # Check if build was successful
    if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
        print_error "Build failed! dist/index.html not found."
        exit 1
    fi
    
    print_info "Frontend deployment complete! Nginx will serve the new files."
}

# Main deployment logic
case $DEPLOY_TYPE in
    backend)
        deploy_backend
        ;;
    frontend)
        deploy_frontend
        ;;
    all)
        print_info "Deploying both backend and frontend..."
        deploy_backend
        deploy_frontend
        print_info "Full deployment complete!"
        ;;
    *)
        print_error "Invalid deployment type: $DEPLOY_TYPE"
        print_info "Usage: ./deploy.sh [backend|frontend|all]"
        exit 1
        ;;
esac

# Show PM2 status
if [ "$DEPLOY_TYPE" = "backend" ] || [ "$DEPLOY_TYPE" = "all" ]; then
    echo ""
    print_info "PM2 Status:"
    pm2 status
fi

print_info "Deployment script finished!"


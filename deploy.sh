#!/bin/bash

# KPATA AI - Production Deployment Script
# This script automates the deployment process on your production server

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/kpata-ai"
REPO_URL="https://github.com/YOUR_USERNAME/KPATA-AI.git"  # Update this
BRANCH="main"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}KPATA AI - Production Deployment${NC}"
echo -e "${BLUE}=====================================${NC}\n"

# Function to print step
print_step() {
    echo -e "\n${GREEN}[STEP]${NC} $1\n"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to print error
print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Check prerequisites
print_step "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install Git first."
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker installed: $(docker --version)"
echo -e "${GREEN}✓${NC} Docker Compose installed: $(docker-compose --version)"
echo -e "${GREEN}✓${NC} Git installed: $(git --version)"

# Create project directory if it doesn't exist
if [ ! -d "$PROJECT_DIR" ]; then
    print_step "Creating project directory..."
    mkdir -p "$PROJECT_DIR"
    echo -e "${GREEN}✓${NC} Project directory created: $PROJECT_DIR"
fi

# Clone or update repository
if [ -d "$PROJECT_DIR/.git" ]; then
    print_step "Updating repository..."
    cd "$PROJECT_DIR"
    git fetch origin
    git reset --hard origin/$BRANCH
    echo -e "${GREEN}✓${NC} Repository updated"
else
    print_step "Cloning repository..."
    git clone -b "$BRANCH" "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    echo -e "${GREEN}✓${NC} Repository cloned"
fi

# Check if .env.production files exist
print_step "Checking environment files..."

if [ ! -f "services/api/.env.production" ]; then
    print_warning "services/api/.env.production not found"
    echo "Creating from example..."
    cp services/api/.env.example services/api/.env.production
    print_error "Please edit services/api/.env.production with your production values"
    exit 1
fi

if [ ! -f "services/worker/.env.production" ]; then
    print_warning "services/worker/.env.production not found"
    echo "Creating from example..."
    cp services/worker/.env.example services/worker/.env.production
    print_error "Please edit services/worker/.env.production with your production values"
    exit 1
fi

echo -e "${GREEN}✓${NC} Environment files found"

# Set Redis password
if [ -z "$REDIS_PASSWORD" ]; then
    print_warning "REDIS_PASSWORD not set in environment"
    echo "Generating random Redis password..."
    export REDIS_PASSWORD=$(openssl rand -base64 32)
    echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> .env
    echo -e "${GREEN}✓${NC} Redis password generated and saved to .env"
fi

# Stop existing containers
print_step "Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down || true
echo -e "${GREEN}✓${NC} Containers stopped"

# Build images
print_step "Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache
echo -e "${GREEN}✓${NC} Images built"

# Start containers
print_step "Starting containers..."
docker-compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}✓${NC} Containers started"

# Wait for services to be healthy
print_step "Waiting for services to be healthy..."
sleep 10

# Check container status
print_step "Checking container status..."
docker-compose -f docker-compose.prod.yml ps

# Show logs
print_step "Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=50

echo -e "\n${GREEN}=====================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}=====================================${NC}\n"

echo -e "API running on: ${BLUE}http://$(hostname -I | awk '{print $1}'):3000${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Configure your reverse proxy (Nginx/Caddy) to point to port 3000"
echo "2. Set up SSL certificates (Let's Encrypt)"
echo "3. Configure Paystack webhook: https://your-domain.com/payments/webhook/paystack"
echo "4. Monitor logs: docker-compose -f docker-compose.prod.yml logs -f"

echo -e "\n${YELLOW}Useful commands:${NC}"
echo "  View logs:    docker-compose -f docker-compose.prod.yml logs -f"
echo "  Restart:      docker-compose -f docker-compose.prod.yml restart"
echo "  Stop:         docker-compose -f docker-compose.prod.yml down"
echo "  Update:       ./deploy.sh"

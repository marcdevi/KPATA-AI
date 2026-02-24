#!/bin/bash

# KPATA AI Production Deployment Script
# This script is called by GitHub Actions to deploy the application

set -e  # Exit on any error

echo "======================================"
echo "KPATA AI Production Deployment"
echo "======================================"

# Load environment variables
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production file not found!"
    exit 1
fi

echo "✅ Environment file found"

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.prod.yml --env-file .env.production down || true

# Pull latest images (if using external images)
echo "📦 Pulling Docker images..."
docker compose -f docker-compose.prod.yml --env-file .env.production pull || true

# Build and start containers
echo "🔨 Building and starting containers..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check container status
echo "📊 Container status:"
docker compose -f docker-compose.prod.yml ps

# Clean up old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

echo "======================================"
echo "✅ Deployment completed successfully!"
echo "======================================"

# Show running containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

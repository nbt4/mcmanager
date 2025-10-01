#!/bin/bash

# Production build script for MineCtrl
# Builds all Docker images for production deployment

set -e

echo "🏗️  Building MineCtrl production images..."

# Build all images
echo "Building backend..."
docker build -t minectrl-backend:latest ./backend

echo "Building frontend..."
docker build -t minectrl-frontend:latest ./frontend

echo "Building agent..."
docker build -t minectrl-agent:latest ./agent

echo "✅ All images built successfully!"

# Tag for registry (optional)
if [ "$1" = "--tag-registry" ]; then
    REGISTRY=${2:-"ghcr.io/your-org"}

    echo "🏷️  Tagging images for registry: $REGISTRY"

    docker tag minectrl-backend:latest $REGISTRY/minectrl-backend:latest
    docker tag minectrl-frontend:latest $REGISTRY/minectrl-frontend:latest
    docker tag minectrl-agent:latest $REGISTRY/minectrl-agent:latest

    echo "📤 Push with: docker push $REGISTRY/minectrl-*:latest"
fi

echo "🚀 Ready for production deployment!"
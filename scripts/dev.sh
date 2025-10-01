#!/bin/bash

# Development script for MineCtrl
# Starts all services in development mode

set -e

echo "🚀 Starting MineCtrl development environment..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
if ! command_exists docker; then
    echo "❌ Docker is required but not installed."
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is required but not installed."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
fi

# Start development containers
echo "🐳 Starting development containers..."

# Use development override file if it exists
if [ -f docker-compose.dev.yml ]; then
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
else
    docker-compose up --build
fi
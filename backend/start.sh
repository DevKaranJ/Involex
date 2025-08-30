#!/bin/bash

# Render.com startup script for Involex Backend
echo "🚀 Starting Involex Backend on Render..."

# Print environment info
echo "Environment: $NODE_ENV"
echo "Port: $PORT"
echo "Node Version: $(node --version)"
echo "NPM Version: $(npm --version)"

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Start the application
echo "🎯 Starting Involex API server..."
npm start

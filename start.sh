#!/usr/bin/env bash
set -e

# ====================================================================
# RESTAURO - Restaurant Management System Unified Launcher
# ====================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PORT="${PORT:-3001}"
export NODE_ENV="${NODE_ENV:-production}"

echo "===================================================================="
echo "  🍽️  RESTAURO - RESTAURANT MANAGEMENT & POS SYSTEM"
echo "===================================================================="
echo "  Target Port: ${PORT}"
echo "  Environment: ${NODE_ENV}"
echo "--------------------------------------------------------------------"

# 1. Check Node and npm
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

# 2. Build Backend if needed
if [ ! -d "${ROOT_DIR}/server/dist" ]; then
    echo "📦 Building server..."
    cd "${ROOT_DIR}/server"
    npm run build
fi

# 3. Build Client if needed
if [ ! -d "${ROOT_DIR}/client/dist" ]; then
    echo "📦 Building client SPA..."
    cd "${ROOT_DIR}/client"
    npm run build
fi

# 4. Clean any existing process on target port
echo "🧹 Releasing port ${PORT} if occupied..."
if command -v lsof &> /dev/null; then
    lsof -ti :${PORT} | xargs -r kill -9 2>/dev/null || true
fi

echo "🚀 Starting Restaurant Management Server..."
cd "${ROOT_DIR}/server"
node dist/index.js

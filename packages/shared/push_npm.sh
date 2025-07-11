#!/bin/bash

# ================================
# MoonXFarm packages/shared Service - Build & Test Script
# ================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

rm -rf dist && rm -rf node_modules
pnpm install
pnpm build

# Configuration
pnpm publish --access public --no-git-checks
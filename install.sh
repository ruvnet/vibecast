#!/bin/bash

# Vibecast Installer for Unix/Linux/Mac
# This script installs dependencies and sets up the environment

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║             Vibecast Installer v1.0.0                     ║"
echo "║       Universal Energy System Controller                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js version
echo "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version 18+ required (found v$NODE_VERSION)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Check npm
echo "Checking npm..."
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm $(npm -v) detected${NC}"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
else
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi

echo ""

# Create directories
echo "Creating directories..."
mkdir -p reports checkpoints logs
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Optional: Set up E2B API key
echo "════════════════════════════════════════════════════════════"
echo "Optional: E2B API Key Setup"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Vibecast can use E2B for federated agent simulation."
echo "If you have an E2B API key, you can set it now."
echo ""
read -p "Do you have an E2B API key? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your E2B API key: " E2B_KEY
    echo "export E2B_API_KEY='$E2B_KEY'" >> ~/.bashrc
    echo "export E2B_API_KEY='$E2B_KEY'" >> ~/.zshrc 2>/dev/null || true
    echo -e "${GREEN}✓ E2B API key saved${NC}"
    echo "Restart your terminal or run: source ~/.bashrc"
else
    echo -e "${YELLOW}⚠ Skipping E2B setup${NC}"
    echo "You can set it later with: export E2B_API_KEY=your_key"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              Installation Complete! 🎉                    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Quick Start:"
echo ""
echo "  # Run RL demo"
echo "  node examples/rl-demo.js"
echo ""
echo "  # Train a controller"
echo "  node examples/rl-training.js nuclear-fission PPO 100"
echo ""
echo "  # Run simulation"
echo "  node examples/basic-simulation.js"
echo ""
echo "Documentation: docs/getting-started.md"
echo ""

#!/bin/bash

# CUDA-Rust-WASM NPM Publishing Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Publishing CUDA-Rust-WASM to NPM...${NC}"

# Check if user is logged in to npm
if ! npm whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged in to npm${NC}"
    echo "Please run 'npm login' first"
    exit 1
fi

# Clean and build
echo -e "${BLUE}🧹 Cleaning previous builds...${NC}"
rm -rf dist build pkg target/release

echo -e "${BLUE}🔨 Building project...${NC}"
npm run build

# Run tests
echo -e "${BLUE}🧪 Running tests...${NC}"
npm test

# Check version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}📋 Current version: ${YELLOW}$CURRENT_VERSION${NC}"

# Ask for version bump
echo -e "${BLUE}Select version bump:${NC}"
echo "  1) Patch (x.x.X)"
echo "  2) Minor (x.X.0)"
echo "  3) Major (X.0.0)"
echo "  4) No bump"
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        npm version patch
        ;;
    2)
        npm version minor
        ;;
    3)
        npm version major
        ;;
    4)
        echo "Keeping current version"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

NEW_VERSION=$(node -p "require('./package.json').version")

# Create git tag
if [ "$CURRENT_VERSION" != "$NEW_VERSION" ]; then
    echo -e "${BLUE}🏷️  Creating git tag v$NEW_VERSION...${NC}"
    git add package.json package-lock.json
    git commit -m "Release v$NEW_VERSION"
    git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
fi

# Publish to npm
echo -e "${BLUE}📦 Publishing to npm...${NC}"
npm publish --access public

# Push to git
echo -e "${BLUE}📤 Pushing to git...${NC}"
git push origin main --tags

echo -e "${GREEN}✅ Successfully published cuda-rust-wasm@$NEW_VERSION${NC}"
echo -e "${BLUE}📋 Install with: ${YELLOW}npm install cuda-rust-wasm${NC}"
echo -e "${BLUE}🔧 Use with: ${YELLOW}npx cuda-rust-wasm${NC}"
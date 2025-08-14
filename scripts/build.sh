#!/bin/bash

# VibeCast Build Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project information
PROJECT_NAME="vibecast"
VERSION=${VERSION:-"v1.0.0"}
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=${GIT_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")}

# Build flags
LDFLAGS="-X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.GitCommit=${GIT_COMMIT}"

echo -e "${BLUE}🚀 Building VibeCast ${VERSION}${NC}"
echo -e "${BLUE}Build Time: ${BUILD_TIME}${NC}"
echo -e "${BLUE}Git Commit: ${GIT_COMMIT}${NC}"
echo ""

# Create bin directory
mkdir -p bin

# Build API server
echo -e "${YELLOW}📦 Building API server...${NC}"
go build -ldflags="${LDFLAGS}" -o bin/vibecast-api ./cmd/api
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API server built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build API server${NC}"
    exit 1
fi

# Build Worker
echo -e "${YELLOW}📦 Building Worker...${NC}"
go build -ldflags="${LDFLAGS}" -o bin/vibecast-worker ./cmd/worker
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Worker built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build Worker${NC}"
    exit 1
fi

# Build CLI
echo -e "${YELLOW}📦 Building CLI...${NC}"
go build -ldflags="${LDFLAGS}" -o bin/vibecast ./cmd/cli
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ CLI built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build CLI${NC}"
    exit 1
fi

# Make binaries executable
chmod +x bin/*

echo ""
echo -e "${GREEN}🎉 Build completed successfully!${NC}"
echo -e "${BLUE}Built binaries:${NC}"
ls -la bin/

echo ""
echo -e "${BLUE}📋 Usage:${NC}"
echo -e "${YELLOW}  API Server:${NC} ./bin/vibecast-api"
echo -e "${YELLOW}  Worker:${NC}     ./bin/vibecast-worker"
echo -e "${YELLOW}  CLI:${NC}        ./bin/vibecast --help"
echo ""

# Optional: Run tests
if [ "${RUN_TESTS:-false}" = "true" ]; then
    echo -e "${YELLOW}🧪 Running tests...${NC}"
    go test ./... -v
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ All tests passed${NC}"
    else
        echo -e "${RED}❌ Some tests failed${NC}"
        exit 1
    fi
fi
#!/bin/bash

# Build script for Interplanetary Communications GPU components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Interplanetary Communications GPU Build ===${NC}"

# Check for CUDA
if ! command -v nvcc &> /dev/null; then
    echo -e "${RED}Error: CUDA compiler (nvcc) not found!${NC}"
    echo "Please install CUDA Toolkit 12.0 or higher"
    exit 1
fi

# Check for CMake
if ! command -v cmake &> /dev/null; then
    echo -e "${RED}Error: CMake not found!${NC}"
    echo "Please install CMake 3.18 or higher"
    exit 1
fi

# Display CUDA version
echo -e "${YELLOW}CUDA Version:${NC}"
nvcc --version | grep "release"

# Check for GPU
echo -e "${YELLOW}Available GPUs:${NC}"
nvidia-smi --query-gpu=name --format=csv,noheader || echo "No NVIDIA GPU detected (build will continue)"

# Parse arguments
BUILD_TYPE="Release"
CLEAN_BUILD=false
RUN_TESTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --debug)
            BUILD_TYPE="Debug"
            shift
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --test)
            RUN_TESTS=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--debug] [--clean] [--test]"
            exit 1
            ;;
    esac
done

# Create build directory
BUILD_DIR="build"
if [ "$CLEAN_BUILD" = true ] && [ -d "$BUILD_DIR" ]; then
    echo -e "${YELLOW}Cleaning build directory...${NC}"
    rm -rf "$BUILD_DIR"
fi

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Configure with CMake
echo -e "${YELLOW}Configuring with CMake...${NC}"
cmake -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
      -DCMAKE_CUDA_ARCHITECTURES="70;75;80;86;89;90" \
      ..

# Build
echo -e "${YELLOW}Building...${NC}"
make -j$(nproc)

echo -e "${GREEN}Build completed successfully!${NC}"

# Run tests if requested
if [ "$RUN_TESTS" = true ]; then
    echo -e "${YELLOW}Running tests...${NC}"
    if [ -f "gpu_tests" ]; then
        ./gpu_tests
    else
        echo -e "${RED}Test executable not found!${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}=== Build Summary ===${NC}"
echo "Build type: $BUILD_TYPE"
echo "Build directory: $(pwd)"
echo "Libraries: $(find . -name "*.a" -o -name "*.so" | head -5)"
echo "Executables: $(find . -name "gpu_tests" | head -5)"

cd ..
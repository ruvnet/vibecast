# Makefile for Quantum Navigation GPU Kernels
# Author: GPUArchitect Agent

# CUDA compiler
NVCC = nvcc

# Compiler flags
NVCC_FLAGS = -O3 -arch=sm_86 -use_fast_math -lineinfo
NVCC_FLAGS += -Xcompiler -Wall -Xcompiler -Wextra
NVCC_FLAGS += -std=c++14

# Debug flags (uncomment for debugging)
# NVCC_FLAGS += -G -g

# Include paths
INCLUDES = -I.

# Source files
KERNEL_SRCS = quantum_navigation_kernels.cu kernel_launchers.cu
KERNEL_OBJS = $(KERNEL_SRCS:.cu=.o)

# Headers
HEADERS = quantum_navigation_kernels.h

# Target library
TARGET = libquantum_nav_kernels.a

# Build rules
all: $(TARGET)

$(TARGET): $(KERNEL_OBJS)
	ar rcs $@ $^
	@echo "Built quantum navigation kernel library: $@"

%.o: %.cu $(HEADERS)
	$(NVCC) $(NVCC_FLAGS) $(INCLUDES) -c $< -o $@

# Test target
test: $(TARGET)
	@echo "TODO: Add kernel tests"

# Benchmark target
benchmark: $(TARGET)
	@echo "TODO: Add performance benchmarks"

# Profile target (requires nsight compute)
profile: $(TARGET)
	@echo "Profiling kernels with Nsight Compute..."
	@echo "TODO: Add profiling commands"

# Clean
clean:
	rm -f $(KERNEL_OBJS) $(TARGET)
	@echo "Cleaned kernel build artifacts"

# Install (copies to parent directory)
install: $(TARGET)
	cp $(TARGET) ../
	cp $(HEADERS) ../
	@echo "Installed kernels to parent directory"

.PHONY: all clean test benchmark profile install
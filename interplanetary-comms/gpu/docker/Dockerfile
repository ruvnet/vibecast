# NVIDIA CUDA development image for Interplanetary Communications
FROM nvidia/cuda:12.3.1-devel-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV CUDA_HOME=/usr/local/cuda
ENV PATH=${CUDA_HOME}/bin:${PATH}
ENV LD_LIBRARY_PATH=${CUDA_HOME}/lib64:${LD_LIBRARY_PATH}

# Install development tools
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    ninja-build \
    python3 \
    python3-pip \
    gdb \
    cuda-gdb \
    cuda-nsight-compute-12-3 \
    cuda-nsight-systems-12-3 \
    libopenmpi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install NVIDIA Nsight tools
RUN apt-get update && apt-get install -y \
    nsight-compute \
    nsight-systems \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
WORKDIR /workspace/interplanetary-gpu

# Copy CMake configuration
COPY CMakeLists.txt .
COPY include/ ./include/
COPY kernels/ ./kernels/
COPY src/ ./src/
COPY tests/ ./tests/

# Build the project
RUN mkdir build && cd build && \
    cmake -G Ninja -DCMAKE_BUILD_TYPE=Release .. && \
    ninja

# Set entrypoint
CMD ["/bin/bash"]
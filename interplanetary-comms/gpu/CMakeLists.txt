cmake_minimum_required(VERSION 3.18)
project(InterplanetaryGPU CUDA CXX)

# Set CUDA standard
set(CMAKE_CUDA_STANDARD 17)
set(CMAKE_CUDA_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find CUDA
find_package(CUDAToolkit REQUIRED)

# CUDA compile flags
set(CMAKE_CUDA_FLAGS "${CMAKE_CUDA_FLAGS} -gencode arch=compute_70,code=sm_70")
set(CMAKE_CUDA_FLAGS "${CMAKE_CUDA_FLAGS} -gencode arch=compute_75,code=sm_75")
set(CMAKE_CUDA_FLAGS "${CMAKE_CUDA_FLAGS} -gencode arch=compute_80,code=sm_80")
set(CMAKE_CUDA_FLAGS "${CMAKE_CUDA_FLAGS} -gencode arch=compute_86,code=sm_86")
set(CMAKE_CUDA_FLAGS "${CMAKE_CUDA_FLAGS} -gencode arch=compute_89,code=sm_89")
set(CMAKE_CUDA_FLAGS "${CMAKE_CUDA_FLAGS} -gencode arch=compute_90,code=sm_90")

# Enable separate compilation for CUDA
set(CMAKE_CUDA_SEPARABLE_COMPILATION ON)

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)
include_directories(${CUDAToolkit_INCLUDE_DIRS})

# Source files
file(GLOB_RECURSE CUDA_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/kernels/*.cu")
file(GLOB_RECURSE CXX_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp")

# Create library
add_library(interplanetary_gpu STATIC ${CUDA_SOURCES} ${CXX_SOURCES})

# Link CUDA libraries
target_link_libraries(interplanetary_gpu 
    CUDA::cudart
    CUDA::cuda_driver
    CUDA::cufft
    CUDA::curand
    CUDA::cusparse
    CUDA::cublas
)

# Create test executable
add_executable(gpu_tests tests/main.cpp)
target_link_libraries(gpu_tests interplanetary_gpu)

# Enable testing
enable_testing()
add_test(NAME GPUTests COMMAND gpu_tests)

# Installation
install(TARGETS interplanetary_gpu DESTINATION lib)
install(DIRECTORY include/ DESTINATION include)
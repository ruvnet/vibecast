# CMake configuration for GPU Testing Framework
cmake_minimum_required(VERSION 3.18)
project(InterplanetaryCommsGPUTests CUDA CXX)

# Set C++ and CUDA standards
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CUDA_STANDARD 17)
set(CMAKE_CUDA_STANDARD_REQUIRED ON)

# Find required packages
find_package(CUDA REQUIRED)
find_package(Threads REQUIRED)

# CUDA architecture settings (adjust based on your GPU)
set(CMAKE_CUDA_ARCHITECTURES 70 75 80 86 89)

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/utils
    ${CMAKE_CURRENT_SOURCE_DIR}/../src
    ${CMAKE_CURRENT_SOURCE_DIR}/../include
    ${CUDA_INCLUDE_DIRS}
)

# CUDA compiler flags
set(CMAKE_CUDA_FLAGS "${CMAKE_CUDA_FLAGS} -O3 --use_fast_math --extended-lambda")
set(CMAKE_CUDA_FLAGS_DEBUG "${CMAKE_CUDA_FLAGS_DEBUG} -G -g")
set(CMAKE_CUDA_FLAGS_RELEASE "${CMAKE_CUDA_FLAGS_RELEASE} -O3")

# Add debug symbols in Release mode for profiling
set(CMAKE_CUDA_FLAGS_RELEASE "${CMAKE_CUDA_FLAGS_RELEASE} -lineinfo")

# C++ compiler flags
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -Wall -Wextra")
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g")

# CUDA libraries
set(CUDA_LIBRARIES
    ${CUDA_LIBRARIES}
    ${CUDA_cudart_LIBRARY}
    ${CUDA_cublas_LIBRARY}
    ${CUDA_cufft_LIBRARY}
    ${CUDA_curand_LIBRARY}
    ${CUDA_cusparse_LIBRARY}
    ${CUDA_cusolver_LIBRARY}
    cudnn
    nccl
    nvml
)

# Test framework library
add_library(cuda_test_framework INTERFACE)
target_include_directories(cuda_test_framework INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/utils)

# Unit tests
add_executable(test_quantum_compression
    unit/test_quantum_compression.cu
)
target_link_libraries(test_quantum_compression
    cuda_test_framework
    ${CUDA_LIBRARIES}
    ${CMAKE_THREAD_LIBS_INIT}
)

add_executable(test_memory_validation
    unit/test_memory_validation.cu
)
target_link_libraries(test_memory_validation
    cuda_test_framework
    ${CUDA_LIBRARIES}
    ${CMAKE_THREAD_LIBS_INIT}
)

# Performance benchmarks
add_executable(benchmark_suite
    performance/benchmark_suite.cu
)
target_link_libraries(benchmark_suite
    cuda_test_framework
    ${CUDA_LIBRARIES}
    ${CMAKE_THREAD_LIBS_INIT}
)

# Integration tests
add_executable(test_full_system
    integration/test_full_system.cu
)
target_link_libraries(test_full_system
    cuda_test_framework
    ${CUDA_LIBRARIES}
    ${CMAKE_THREAD_LIBS_INIT}
)

# Main test runner
add_executable(run_all_tests
    run_all_tests.cu
)
target_link_libraries(run_all_tests
    cuda_test_framework
    ${CUDA_LIBRARIES}
    ${CMAKE_THREAD_LIBS_INIT}
)

# Custom target to run all tests
add_custom_target(test
    COMMAND $<TARGET_FILE:run_all_tests> --output ${CMAKE_BINARY_DIR}/test_results
    DEPENDS run_all_tests test_quantum_compression test_memory_validation test_full_system
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    COMMENT "Running all GPU tests..."
)

# Custom target for unit tests only
add_custom_target(test_unit
    COMMAND $<TARGET_FILE:run_all_tests> --unit --output ${CMAKE_BINARY_DIR}/test_results
    DEPENDS run_all_tests test_quantum_compression test_memory_validation
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    COMMENT "Running unit tests..."
)

# Custom target for performance tests only
add_custom_target(test_performance
    COMMAND $<TARGET_FILE:run_all_tests> --performance --output ${CMAKE_BINARY_DIR}/test_results
    DEPENDS run_all_tests benchmark_suite
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    COMMENT "Running performance tests..."
)

# Custom target for integration tests only
add_custom_target(test_integration
    COMMAND $<TARGET_FILE:run_all_tests> --integration --output ${CMAKE_BINARY_DIR}/test_results
    DEPENDS run_all_tests test_full_system
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    COMMENT "Running integration tests..."
)

# Install targets
install(TARGETS 
    test_quantum_compression
    test_memory_validation
    benchmark_suite
    test_full_system
    run_all_tests
    RUNTIME DESTINATION bin/tests
)

# Install test scripts
install(FILES
    ${CMAKE_CURRENT_SOURCE_DIR}/run_tests.sh
    ${CMAKE_CURRENT_SOURCE_DIR}/benchmark.sh
    DESTINATION bin/tests
    PERMISSIONS OWNER_READ OWNER_WRITE OWNER_EXECUTE GROUP_READ GROUP_EXECUTE WORLD_READ WORLD_EXECUTE
)

# Enable testing
enable_testing()

# Add tests to CTest
add_test(NAME unit_quantum_compression COMMAND test_quantum_compression)
add_test(NAME unit_memory_validation COMMAND test_memory_validation)
add_test(NAME integration_full_system COMMAND test_full_system)
add_test(NAME performance_benchmark COMMAND benchmark_suite)

# Set test properties
set_tests_properties(unit_quantum_compression PROPERTIES 
    TIMEOUT 300
    LABELS "unit"
)
set_tests_properties(unit_memory_validation PROPERTIES 
    TIMEOUT 300
    LABELS "unit"
)
set_tests_properties(integration_full_system PROPERTIES 
    TIMEOUT 600
    LABELS "integration"
)
set_tests_properties(performance_benchmark PROPERTIES 
    TIMEOUT 1200
    LABELS "performance"
)

# Generate test report script
file(WRITE ${CMAKE_CURRENT_BINARY_DIR}/generate_report.sh
"#!/bin/bash
# Generate HTML test report from test results

OUTPUT_DIR=\${1:-./test_results}
REPORT_FILE=\${OUTPUT_DIR}/test_report.html

echo '<!DOCTYPE html>' > \$REPORT_FILE
echo '<html><head><title>GPU Test Report</title>' >> \$REPORT_FILE
echo '<style>' >> \$REPORT_FILE
echo 'body { font-family: Arial, sans-serif; margin: 20px; }' >> \$REPORT_FILE
echo '.passed { color: green; } .failed { color: red; }' >> \$REPORT_FILE
echo 'table { border-collapse: collapse; width: 100%; }' >> \$REPORT_FILE
echo 'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }' >> \$REPORT_FILE
echo 'th { background-color: #f2f2f2; }' >> \$REPORT_FILE
echo '</style></head><body>' >> \$REPORT_FILE
echo '<h1>GPU Test Report</h1>' >> \$REPORT_FILE
echo '<p>Generated: '$(date)'</p>' >> \$REPORT_FILE

# Parse JSON results and generate HTML
for json_file in \${OUTPUT_DIR}/*.json; do
    if [ -f \"\$json_file\" ]; then
        echo '<h2>'$(basename \$json_file .json)'</h2>' >> \$REPORT_FILE
        # Add JSON parsing logic here
    fi
done

echo '</body></html>' >> \$REPORT_FILE
echo \"Test report generated: \$REPORT_FILE\"
")

# Make the script executable
file(CHMOD ${CMAKE_CURRENT_BINARY_DIR}/generate_report.sh
    PERMISSIONS OWNER_READ OWNER_WRITE OWNER_EXECUTE GROUP_READ GROUP_EXECUTE WORLD_READ WORLD_EXECUTE
)

# Print configuration summary
message(STATUS "===== GPU Test Configuration =====")
message(STATUS "CUDA Version: ${CUDA_VERSION}")
message(STATUS "CUDA Architectures: ${CMAKE_CUDA_ARCHITECTURES}")
message(STATUS "Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "Install Prefix: ${CMAKE_INSTALL_PREFIX}")
message(STATUS "==================================")
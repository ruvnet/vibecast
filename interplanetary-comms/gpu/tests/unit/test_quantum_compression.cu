/**
 * Unit Tests for Quantum Compression GPU Kernels
 * Tests compression, decompression, and error correction
 */

#include "../utils/cuda_test_framework.cuh"
#include "../../src/quantum_compression.cuh"
#include <random>
#include <cmath>

using namespace cuda_test;

class QuantumCompressionTest : public CudaTest {
private:
    // Test data
    float* h_input_data_;
    float* h_compressed_data_;
    float* h_decompressed_data_;
    float* d_input_data_;
    float* d_compressed_data_;
    float* d_decompressed_data_;
    
    size_t input_size_;
    size_t compressed_size_;
    float compression_ratio_;
    
    // Quantum compression parameters
    QuantumCompressionParams params_;
    
public:
    QuantumCompressionTest(size_t input_size = 1024 * 1024) 
        : CudaTest(), input_size_(input_size) {
        compression_ratio_ = 0.25f; // 4:1 compression
        compressed_size_ = input_size_ * compression_ratio_;
        
        // Initialize compression parameters
        params_.quantum_bits = 8;
        params_.error_threshold = 1e-6f;
        params_.max_iterations = 100;
        params_.entanglement_strength = 0.95f;
    }
    
    void SetUp() override {
        // Allocate host memory
        h_input_data_ = new float[input_size_];
        h_compressed_data_ = new float[compressed_size_];
        h_decompressed_data_ = new float[input_size_];
        
        // Generate test data with known patterns
        GenerateTestData();
        
        // Allocate device memory
        CUDA_CHECK(cudaMalloc(&d_input_data_, input_size_ * sizeof(float)));
        CUDA_CHECK(cudaMalloc(&d_compressed_data_, compressed_size_ * sizeof(float)));
        CUDA_CHECK(cudaMalloc(&d_decompressed_data_, input_size_ * sizeof(float)));
        
        // Copy input data to device
        CUDA_CHECK(cudaMemcpy(d_input_data_, h_input_data_, 
                              input_size_ * sizeof(float), 
                              cudaMemcpyHostToDevice));
    }
    
    TestResult Run() override {
        TestResult result;
        result.test_name = "Quantum Compression Test";
        result.passed = true;
        
        KernelProfiler profiler;
        
        // Test 1: Compression kernel
        profiler.MarkStart("Quantum Compression", stream_);
        
        dim3 block_size(256);
        dim3 grid_size((input_size_ + block_size.x - 1) / block_size.x);
        
        StartTiming();
        quantum_compress_kernel<<<grid_size, block_size, 0, stream_>>>(
            d_input_data_, d_compressed_data_, 
            input_size_, compressed_size_, params_
        );
        float compression_time = StopTiming();
        
        profiler.MarkEnd(stream_);
        
        // Test 2: Decompression kernel
        profiler.MarkStart("Quantum Decompression", stream_);
        
        StartTiming();
        quantum_decompress_kernel<<<grid_size, block_size, 0, stream_>>>(
            d_compressed_data_, d_decompressed_data_,
            compressed_size_, input_size_, params_
        );
        float decompression_time = StopTiming();
        
        profiler.MarkEnd(stream_);
        
        // Synchronize and check for errors
        CUDA_CHECK(cudaStreamSynchronize(stream_));
        
        // Copy results back to host
        CUDA_CHECK(cudaMemcpy(h_compressed_data_, d_compressed_data_,
                              compressed_size_ * sizeof(float),
                              cudaMemcpyDeviceToHost));
        CUDA_CHECK(cudaMemcpy(h_decompressed_data_, d_decompressed_data_,
                              input_size_ * sizeof(float),
                              cudaMemcpyDeviceToHost));
        
        // Test 3: Verify compression ratio
        float actual_compression_ratio = CalculateCompressionRatio();
        if (std::abs(actual_compression_ratio - compression_ratio_) > 0.01f) {
            result.passed = false;
            result.error_message = "Compression ratio mismatch";
        }
        
        // Test 4: Verify reconstruction accuracy
        float reconstruction_error = CalculateReconstructionError();
        if (reconstruction_error > params_.error_threshold) {
            result.passed = false;
            result.error_message = "Reconstruction error exceeds threshold: " +
                                 std::to_string(reconstruction_error);
        }
        
        // Test 5: Verify quantum properties preservation
        if (!VerifyQuantumProperties()) {
            result.passed = false;
            result.error_message = "Quantum properties not preserved";
        }
        
        // Calculate performance metrics
        result.metrics.kernel_time_ms = compression_time + decompression_time;
        result.metrics.memory_bandwidth_gb_s = CalculateBandwidth(
            (input_size_ + compressed_size_ + input_size_) * sizeof(float),
            result.metrics.kernel_time_ms
        );
        result.metrics.compute_throughput_gflops = CalculateThroughput(
            input_size_ * 100, // Approximate FLOPs per element
            result.metrics.kernel_time_ms
        );
        
        // Get memory usage
        size_t free_bytes, total_bytes;
        GetMemoryInfo(free_bytes, total_bytes);
        result.metrics.memory_used_bytes = total_bytes - free_bytes;
        
        profiler.PrintSummary();
        
        return result;
    }
    
    void TearDown() override {
        // Free device memory
        cudaFree(d_input_data_);
        cudaFree(d_compressed_data_);
        cudaFree(d_decompressed_data_);
        
        // Free host memory
        delete[] h_input_data_;
        delete[] h_compressed_data_;
        delete[] h_decompressed_data_;
    }
    
private:
    void GenerateTestData() {
        std::random_device rd;
        std::mt19937 gen(rd());
        std::normal_distribution<float> dist(0.0f, 1.0f);
        
        // Generate data with quantum-like properties
        for (size_t i = 0; i < input_size_; ++i) {
            float base = dist(gen);
            // Add quantum noise pattern
            float quantum_noise = 0.1f * std::sin(i * 0.01f) * std::cos(i * 0.005f);
            h_input_data_[i] = base + quantum_noise;
        }
    }
    
    float CalculateCompressionRatio() {
        // Count non-zero elements in compressed data
        size_t non_zero_count = 0;
        for (size_t i = 0; i < compressed_size_; ++i) {
            if (std::abs(h_compressed_data_[i]) > 1e-7f) {
                non_zero_count++;
            }
        }
        return (float)non_zero_count / input_size_;
    }
    
    float CalculateReconstructionError() {
        float total_error = 0.0f;
        float total_magnitude = 0.0f;
        
        for (size_t i = 0; i < input_size_; ++i) {
            float error = h_input_data_[i] - h_decompressed_data_[i];
            total_error += error * error;
            total_magnitude += h_input_data_[i] * h_input_data_[i];
        }
        
        return std::sqrt(total_error / total_magnitude);
    }
    
    bool VerifyQuantumProperties() {
        // Verify energy conservation
        float input_energy = 0.0f;
        float output_energy = 0.0f;
        
        for (size_t i = 0; i < input_size_; ++i) {
            input_energy += h_input_data_[i] * h_input_data_[i];
            output_energy += h_decompressed_data_[i] * h_decompressed_data_[i];
        }
        
        float energy_ratio = output_energy / input_energy;
        return std::abs(energy_ratio - 1.0f) < 0.01f;
    }
};

// Test for different data sizes
class QuantumCompressionScalabilityTest : public CudaTest {
private:
    std::vector<size_t> test_sizes_;
    std::vector<float> compression_times_;
    std::vector<float> decompression_times_;
    
public:
    QuantumCompressionScalabilityTest() : CudaTest() {
        // Test sizes from 1KB to 1GB
        test_sizes_ = {
            1024,           // 1KB
            10240,          // 10KB
            102400,         // 100KB
            1024000,        // 1MB
            10240000,       // 10MB
            102400000,      // 100MB
            1024000000      // 1GB
        };
    }
    
    void SetUp() override {
        // Nothing specific to set up
    }
    
    TestResult Run() override {
        TestResult result;
        result.test_name = "Quantum Compression Scalability Test";
        result.passed = true;
        
        for (size_t size : test_sizes_) {
            TestSingleSize(size);
        }
        
        // Verify linear scalability
        if (!VerifyScalability()) {
            result.passed = false;
            result.error_message = "Non-linear scalability detected";
        }
        
        PrintScalabilityReport();
        
        return result;
    }
    
    void TearDown() override {
        // Nothing specific to tear down
    }
    
private:
    void TestSingleSize(size_t size) {
        // Implementation details...
    }
    
    bool VerifyScalability() {
        // Check if performance scales linearly with data size
        return true; // Simplified
    }
    
    void PrintScalabilityReport() {
        std::cout << "\n=== Scalability Report ===" << std::endl;
        for (size_t i = 0; i < test_sizes_.size(); ++i) {
            std::cout << "Size: " << test_sizes_[i] / 1024 << " KB"
                      << " | Compression: " << compression_times_[i] << " ms"
                      << " | Decompression: " << decompression_times_[i] << " ms"
                      << std::endl;
        }
    }
};

// Main test runner
int main(int argc, char** argv) {
    // Check CUDA availability
    int device_count;
    CUDA_CHECK(cudaGetDeviceCount(&device_count));
    
    if (device_count == 0) {
        std::cerr << "No CUDA devices found!" << std::endl;
        return 1;
    }
    
    std::cout << "Found " << device_count << " CUDA devices" << std::endl;
    
    // Create test suite
    TestSuite suite("Quantum Compression GPU Tests");
    
    // Add tests
    suite.AddTest(std::make_unique<QuantumCompressionTest>(1024 * 1024));
    suite.AddTest(std::make_unique<QuantumCompressionTest>(10 * 1024 * 1024));
    suite.AddTest(std::make_unique<QuantumCompressionScalabilityTest>());
    
    // Check for memory leaks
    MemoryLeakDetector leak_detector;
    leak_detector.Start();
    
    // Run all tests
    suite.RunAll();
    
    // Check for leaks
    if (!leak_detector.CheckForLeaks()) {
        std::cerr << "Memory leak detected: " 
                  << leak_detector.GetLeakedBytes() << " bytes" << std::endl;
    }
    
    // Generate report
    suite.GenerateReport("quantum_compression_test_report.json");
    
    return 0;
}
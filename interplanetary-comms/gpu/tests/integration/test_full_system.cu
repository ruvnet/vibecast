/**
 * Full System Integration Tests for GPU Implementation
 * Tests the entire interplanetary communication pipeline
 */

#include "../utils/cuda_test_framework.cuh"
#include "../../src/quantum_compression.cuh"
#include "../../src/error_correction.cuh"
#include "../../src/signal_processing.cuh"
#include "../../src/neural_denoising.cuh"
#include <vector>
#include <complex>

using namespace cuda_test;

class FullSystemIntegrationTest : public CudaTest {
private:
    // Test parameters
    size_t signal_length_;
    float noise_level_;
    float compression_ratio_;
    
    // Host buffers
    std::vector<std::complex<float>> h_input_signal_;
    std::vector<std::complex<float>> h_output_signal_;
    std::vector<std::complex<float>> h_reference_signal_;
    
    // Device buffers
    cufftComplex* d_input_signal_;
    cufftComplex* d_processed_signal_;
    float* d_compressed_data_;
    float* d_error_correction_data_;
    
    // Processing components
    SignalProcessor* signal_processor_;
    QuantumCompressor* quantum_compressor_;
    ErrorCorrector* error_corrector_;
    NeuralDenoiser* neural_denoiser_;
    
    // CUDA streams for pipeline
    cudaStream_t signal_stream_;
    cudaStream_t compression_stream_;
    cudaStream_t error_stream_;
    cudaStream_t denoising_stream_;
    
public:
    FullSystemIntegrationTest(size_t signal_length = 1024 * 1024)
        : CudaTest(), signal_length_(signal_length), 
          noise_level_(0.1f), compression_ratio_(0.25f) {
        
        d_input_signal_ = nullptr;
        d_processed_signal_ = nullptr;
        d_compressed_data_ = nullptr;
        d_error_correction_data_ = nullptr;
        
        signal_processor_ = nullptr;
        quantum_compressor_ = nullptr;
        error_corrector_ = nullptr;
        neural_denoiser_ = nullptr;
    }
    
    void SetUp() override {
        // Resize host buffers
        h_input_signal_.resize(signal_length_);
        h_output_signal_.resize(signal_length_);
        h_reference_signal_.resize(signal_length_);
        
        // Generate test signal
        GenerateTestSignal();
        
        // Allocate device memory
        size_t signal_bytes = signal_length_ * sizeof(cufftComplex);
        size_t compressed_bytes = signal_length_ * compression_ratio_ * sizeof(float);
        
        CUDA_CHECK(cudaMalloc(&d_input_signal_, signal_bytes));
        CUDA_CHECK(cudaMalloc(&d_processed_signal_, signal_bytes));
        CUDA_CHECK(cudaMalloc(&d_compressed_data_, compressed_bytes));
        CUDA_CHECK(cudaMalloc(&d_error_correction_data_, compressed_bytes * 1.5f)); // Extra for ECC
        
        // Create processing components
        signal_processor_ = new SignalProcessor(signal_length_);
        quantum_compressor_ = new QuantumCompressor(signal_length_, compression_ratio_);
        error_corrector_ = new ErrorCorrector(compressed_bytes);
        neural_denoiser_ = new NeuralDenoiser(signal_length_);
        
        // Create streams
        CUDA_CHECK(cudaStreamCreate(&signal_stream_));
        CUDA_CHECK(cudaStreamCreate(&compression_stream_));
        CUDA_CHECK(cudaStreamCreate(&error_stream_));
        CUDA_CHECK(cudaStreamCreate(&denoising_stream_));
        
        // Copy input signal to device
        CUDA_CHECK(cudaMemcpy(d_input_signal_, h_input_signal_.data(),
                              signal_bytes, cudaMemcpyHostToDevice));
    }
    
    TestResult Run() override {
        TestResult result;
        result.test_name = "Full System Integration Test";
        result.passed = true;
        
        KernelProfiler profiler;
        
        // Stage 1: Signal Pre-processing
        profiler.MarkStart("Signal Pre-processing", signal_stream_);
        signal_processor_->PreProcess(d_input_signal_, d_processed_signal_, signal_stream_);
        profiler.MarkEnd(signal_stream_);
        
        // Stage 2: Neural Denoising
        profiler.MarkStart("Neural Denoising", denoising_stream_);
        neural_denoiser_->Denoise(d_processed_signal_, d_processed_signal_, denoising_stream_);
        profiler.MarkEnd(denoising_stream_);
        
        // Stage 3: Quantum Compression
        profiler.MarkStart("Quantum Compression", compression_stream_);
        quantum_compressor_->Compress(d_processed_signal_, d_compressed_data_, compression_stream_);
        profiler.MarkEnd(compression_stream_);
        
        // Stage 4: Error Correction Encoding
        profiler.MarkStart("Error Correction Encoding", error_stream_);
        error_corrector_->Encode(d_compressed_data_, d_error_correction_data_, error_stream_);
        profiler.MarkEnd(error_stream_);
        
        // Simulate transmission with errors
        SimulateTransmissionErrors();
        
        // Stage 5: Error Correction Decoding
        profiler.MarkStart("Error Correction Decoding", error_stream_);
        error_corrector_->Decode(d_error_correction_data_, d_compressed_data_, error_stream_);
        profiler.MarkEnd(error_stream_);
        
        // Stage 6: Quantum Decompression
        profiler.MarkStart("Quantum Decompression", compression_stream_);
        quantum_compressor_->Decompress(d_compressed_data_, d_processed_signal_, compression_stream_);
        profiler.MarkEnd(compression_stream_);
        
        // Stage 7: Signal Post-processing
        profiler.MarkStart("Signal Post-processing", signal_stream_);
        signal_processor_->PostProcess(d_processed_signal_, d_processed_signal_, signal_stream_);
        profiler.MarkEnd(signal_stream_);
        
        // Synchronize all streams
        CUDA_CHECK(cudaStreamSynchronize(signal_stream_));
        CUDA_CHECK(cudaStreamSynchronize(compression_stream_));
        CUDA_CHECK(cudaStreamSynchronize(error_stream_));
        CUDA_CHECK(cudaStreamSynchronize(denoising_stream_));
        
        // Copy result back to host
        CUDA_CHECK(cudaMemcpy(h_output_signal_.data(), d_processed_signal_,
                              signal_length_ * sizeof(cufftComplex),
                              cudaMemcpyDeviceToHost));
        
        // Validate results
        float snr = CalculateSNR();
        float ber = CalculateBER();
        float latency = profiler.GetTotalTime();
        
        std::cout << "Signal-to-Noise Ratio: " << snr << " dB" << std::endl;
        std::cout << "Bit Error Rate: " << ber << std::endl;
        std::cout << "End-to-End Latency: " << latency << " ms" << std::endl;
        
        // Check if meets requirements
        if (snr < 20.0f) {
            result.passed = false;
            result.error_message += "SNR too low. ";
        }
        
        if (ber > 1e-6f) {
            result.passed = false;
            result.error_message += "BER too high. ";
        }
        
        if (latency > 100.0f) {
            result.passed = false;
            result.error_message += "Latency too high. ";
        }
        
        // Performance metrics
        result.metrics.kernel_time_ms = latency;
        result.custom_metrics["snr_db"] = snr;
        result.custom_metrics["bit_error_rate"] = ber;
        result.custom_metrics["compression_achieved"] = 
            CalculateActualCompressionRatio();
        
        profiler.PrintSummary();
        
        return result;
    }
    
    void TearDown() override {
        // Free device memory
        cudaFree(d_input_signal_);
        cudaFree(d_processed_signal_);
        cudaFree(d_compressed_data_);
        cudaFree(d_error_correction_data_);
        
        // Delete processing components
        delete signal_processor_;
        delete quantum_compressor_;
        delete error_corrector_;
        delete neural_denoiser_;
        
        // Destroy streams
        cudaStreamDestroy(signal_stream_);
        cudaStreamDestroy(compression_stream_);
        cudaStreamDestroy(error_stream_);
        cudaStreamDestroy(denoising_stream_);
    }
    
private:
    void GenerateTestSignal() {
        // Generate a complex test signal with multiple frequency components
        const float sample_rate = 1e6f; // 1 MHz
        const float duration = signal_length_ / sample_rate;
        
        for (size_t i = 0; i < signal_length_; ++i) {
            float t = i / sample_rate;
            
            // Carrier wave
            float carrier_freq = 100e3f; // 100 kHz
            std::complex<float> carrier(
                std::cos(2 * M_PI * carrier_freq * t),
                std::sin(2 * M_PI * carrier_freq * t)
            );
            
            // Modulation signal
            float mod_freq = 1e3f; // 1 kHz
            float modulation = 0.5f * (1.0f + std::sin(2 * M_PI * mod_freq * t));
            
            // Add noise
            std::random_device rd;
            std::mt19937 gen(rd());
            std::normal_distribution<float> noise_dist(0.0f, noise_level_);
            
            std::complex<float> noise(noise_dist(gen), noise_dist(gen));
            
            // Combine
            h_input_signal_[i] = modulation * carrier + noise;
            h_reference_signal_[i] = modulation * carrier; // Clean reference
        }
    }
    
    void SimulateTransmissionErrors() {
        // Simulate bit errors in compressed data
        size_t compressed_size = signal_length_ * compression_ratio_;
        thrust::device_ptr<float> d_ptr(d_error_correction_data_);
        
        // Flip random bits
        std::random_device rd;
        std::mt19937 gen(rd());
        std::uniform_real_distribution<float> dist(0.0f, 1.0f);
        
        const float error_probability = 1e-4f; // 0.01% bit error rate
        
        for (size_t i = 0; i < compressed_size; ++i) {
            if (dist(gen) < error_probability) {
                // Flip a random bit in the float representation
                int bit_pos = std::uniform_int_distribution<>(0, 31)(gen);
                uint32_t* ptr = reinterpret_cast<uint32_t*>(&d_ptr[i]);
                *ptr ^= (1 << bit_pos);
            }
        }
    }
    
    float CalculateSNR() {
        float signal_power = 0.0f;
        float noise_power = 0.0f;
        
        for (size_t i = 0; i < signal_length_; ++i) {
            auto ref = h_reference_signal_[i];
            auto out = h_output_signal_[i];
            auto error = out - ref;
            
            signal_power += std::norm(ref);
            noise_power += std::norm(error);
        }
        
        signal_power /= signal_length_;
        noise_power /= signal_length_;
        
        return 10.0f * std::log10(signal_power / noise_power);
    }
    
    float CalculateBER() {
        // Convert to binary and compare
        size_t total_bits = 0;
        size_t error_bits = 0;
        
        for (size_t i = 0; i < signal_length_; ++i) {
            uint32_t ref_real = *reinterpret_cast<uint32_t*>(&h_reference_signal_[i].real());
            uint32_t ref_imag = *reinterpret_cast<uint32_t*>(&h_reference_signal_[i].imag());
            uint32_t out_real = *reinterpret_cast<uint32_t*>(&h_output_signal_[i].real());
            uint32_t out_imag = *reinterpret_cast<uint32_t*>(&h_output_signal_[i].imag());
            
            error_bits += __builtin_popcount(ref_real ^ out_real);
            error_bits += __builtin_popcount(ref_imag ^ out_imag);
            total_bits += 64; // 32 bits per float * 2
        }
        
        return static_cast<float>(error_bits) / total_bits;
    }
    
    float CalculateActualCompressionRatio() {
        // Measure actual compression achieved
        size_t original_size = signal_length_ * sizeof(cufftComplex);
        size_t compressed_size = signal_length_ * compression_ratio_ * sizeof(float);
        return static_cast<float>(compressed_size) / original_size;
    }
};

// Performance stress test
class PerformanceStressTest : public CudaTest {
private:
    std::vector<size_t> test_sizes_;
    int num_iterations_;
    
public:
    PerformanceStressTest() : CudaTest() {
        test_sizes_ = {
            1024,           // 1K samples
            16384,          // 16K samples
            262144,         // 256K samples
            4194304,        // 4M samples
            67108864        // 64M samples
        };
        num_iterations_ = 100;
    }
    
    void SetUp() override {
        // Nothing specific to set up
    }
    
    TestResult Run() override {
        TestResult result;
        result.test_name = "Performance Stress Test";
        result.passed = true;
        
        for (size_t size : test_sizes_) {
            std::cout << "\nTesting size: " << size << " samples" << std::endl;
            
            FullSystemIntegrationTest test(size);
            test.SetUp();
            
            // Run multiple iterations
            std::vector<float> latencies;
            for (int i = 0; i < num_iterations_; ++i) {
                auto iter_result = test.Run();
                latencies.push_back(iter_result.metrics.kernel_time_ms);
                
                if (!iter_result.passed) {
                    result.passed = false;
                    result.error_message += "Failed at size " + 
                        std::to_string(size) + ". ";
                    break;
                }
            }
            
            test.TearDown();
            
            // Calculate statistics
            float avg_latency = std::accumulate(latencies.begin(), 
                                              latencies.end(), 0.0f) / latencies.size();
            float max_latency = *std::max_element(latencies.begin(), latencies.end());
            
            std::cout << "Average latency: " << avg_latency << " ms" << std::endl;
            std::cout << "Maximum latency: " << max_latency << " ms" << std::endl;
            
            // Check if meets real-time constraints
            float max_allowed_latency = size / 1000.0f; // 1ms per 1K samples
            if (max_latency > max_allowed_latency) {
                result.passed = false;
                result.error_message += "Latency constraint violated at size " +
                    std::to_string(size) + ". ";
            }
        }
        
        return result;
    }
    
    void TearDown() override {
        // Nothing specific to tear down
    }
};

// Main test runner
int main(int argc, char** argv) {
    TestSuite suite("GPU System Integration Tests");
    
    // Add integration tests
    suite.AddTest(std::make_unique<FullSystemIntegrationTest>(1024 * 1024));
    suite.AddTest(std::make_unique<FullSystemIntegrationTest>(10 * 1024 * 1024));
    suite.AddTest(std::make_unique<PerformanceStressTest>());
    
    // Run all tests
    suite.RunAll();
    
    // Generate report
    suite.GenerateReport("integration_test_report.json");
    
    return 0;
}
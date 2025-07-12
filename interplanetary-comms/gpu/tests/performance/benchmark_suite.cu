/**
 * GPU Performance Benchmarking Suite
 * Comprehensive performance testing for all GPU kernels
 */

#include "../utils/cuda_test_framework.cuh"
#include <nvml.h>
#include <cuda_profiler_api.h>
#include <cupti.h>
#include <fstream>
#include <iomanip>
#include <sstream>

namespace gpu_benchmark {

// NVML wrapper for GPU monitoring
class GPUMonitor {
private:
    nvmlDevice_t device_;
    bool initialized_;
    
public:
    GPUMonitor(int device_id = 0) : initialized_(false) {
        if (nvmlInit() == NVML_SUCCESS) {
            if (nvmlDeviceGetHandleByIndex(device_id, &device_) == NVML_SUCCESS) {
                initialized_ = true;
            }
        }
    }
    
    ~GPUMonitor() {
        if (initialized_) {
            nvmlShutdown();
        }
    }
    
    float GetPowerUsage() {
        if (!initialized_) return -1.0f;
        
        unsigned int power;
        if (nvmlDeviceGetPowerUsage(device_, &power) == NVML_SUCCESS) {
            return power / 1000.0f; // Convert to watts
        }
        return -1.0f;
    }
    
    float GetTemperature() {
        if (!initialized_) return -1.0f;
        
        unsigned int temp;
        if (nvmlDeviceGetTemperature(device_, NVML_TEMPERATURE_GPU, &temp) == NVML_SUCCESS) {
            return (float)temp;
        }
        return -1.0f;
    }
    
    void GetMemoryInfo(size_t& used, size_t& total) {
        if (!initialized_) {
            used = total = 0;
            return;
        }
        
        nvmlMemory_t memory;
        if (nvmlDeviceGetMemoryInfo(device_, &memory) == NVML_SUCCESS) {
            used = memory.used;
            total = memory.total;
        }
    }
    
    float GetUtilization() {
        if (!initialized_) return -1.0f;
        
        nvmlUtilization_t util;
        if (nvmlDeviceGetUtilizationRates(device_, &util) == NVML_SUCCESS) {
            return (float)util.gpu;
        }
        return -1.0f;
    }
};

// Benchmark configuration
struct BenchmarkConfig {
    std::string name;
    std::vector<size_t> problem_sizes;
    int warmup_iterations;
    int timing_iterations;
    bool enable_profiling;
    bool enable_monitoring;
    std::string output_format; // "json", "csv", "human"
};

// Benchmark result
struct BenchmarkResult {
    std::string kernel_name;
    size_t problem_size;
    float mean_time_ms;
    float min_time_ms;
    float max_time_ms;
    float std_dev_ms;
    float bandwidth_gb_s;
    float throughput_gflops;
    float power_efficiency_gflops_per_watt;
    float temperature_celsius;
    float gpu_utilization_percent;
    size_t memory_used_bytes;
    std::map<std::string, float> custom_metrics;
};

// Base benchmark class
class Benchmark {
protected:
    BenchmarkConfig config_;
    std::vector<BenchmarkResult> results_;
    GPUMonitor monitor_;
    cudaStream_t stream_;
    cudaEvent_t start_event_;
    cudaEvent_t stop_event_;
    
public:
    Benchmark(const BenchmarkConfig& config) 
        : config_(config), monitor_() {
        CUDA_CHECK(cudaStreamCreate(&stream_));
        CUDA_CHECK(cudaEventCreate(&start_event_));
        CUDA_CHECK(cudaEventCreate(&stop_event_));
    }
    
    virtual ~Benchmark() {
        cudaStreamDestroy(stream_);
        cudaEventDestroy(start_event_);
        cudaEventDestroy(stop_event_);
    }
    
    // Virtual methods to be implemented by specific benchmarks
    virtual void Initialize(size_t problem_size) = 0;
    virtual void RunKernel() = 0;
    virtual void Cleanup() = 0;
    virtual size_t GetBytesTransferred() const = 0;
    virtual size_t GetFLOPCount() const = 0;
    
    void Run() {
        std::cout << "\n=== Running Benchmark: " << config_.name << " ===" << std::endl;
        
        for (size_t size : config_.problem_sizes) {
            BenchmarkResult result;
            result.kernel_name = config_.name;
            result.problem_size = size;
            
            // Initialize for this problem size
            Initialize(size);
            
            // Warmup runs
            for (int i = 0; i < config_.warmup_iterations; ++i) {
                RunKernel();
                CUDA_CHECK(cudaStreamSynchronize(stream_));
            }
            
            // Timing runs
            std::vector<float> times;
            float total_power = 0.0f;
            float total_temp = 0.0f;
            float total_util = 0.0f;
            
            for (int i = 0; i < config_.timing_iterations; ++i) {
                // Start profiling if enabled
                if (config_.enable_profiling && i == 0) {
                    cudaProfilerStart();
                }
                
                // Record start
                CUDA_CHECK(cudaEventRecord(start_event_, stream_));
                
                // Run kernel
                RunKernel();
                
                // Record stop
                CUDA_CHECK(cudaEventRecord(stop_event_, stream_));
                CUDA_CHECK(cudaEventSynchronize(stop_event_));
                
                // Get timing
                float time_ms;
                CUDA_CHECK(cudaEventElapsedTime(&time_ms, start_event_, stop_event_));
                times.push_back(time_ms);
                
                // Collect monitoring data
                if (config_.enable_monitoring) {
                    total_power += monitor_.GetPowerUsage();
                    total_temp += monitor_.GetTemperature();
                    total_util += monitor_.GetUtilization();
                }
                
                // Stop profiling after first iteration
                if (config_.enable_profiling && i == 0) {
                    cudaProfilerStop();
                }
            }
            
            // Calculate statistics
            result.mean_time_ms = CalculateMean(times);
            result.min_time_ms = *std::min_element(times.begin(), times.end());
            result.max_time_ms = *std::max_element(times.begin(), times.end());
            result.std_dev_ms = CalculateStdDev(times, result.mean_time_ms);
            
            // Calculate performance metrics
            result.bandwidth_gb_s = GetBytesTransferred() / (1024.0 * 1024.0 * 1024.0) / 
                                  (result.mean_time_ms / 1000.0);
            result.throughput_gflops = GetFLOPCount() / 1e9 / (result.mean_time_ms / 1000.0);
            
            // Average monitoring data
            if (config_.enable_monitoring) {
                float avg_power = total_power / config_.timing_iterations;
                result.power_efficiency_gflops_per_watt = 
                    avg_power > 0 ? result.throughput_gflops / avg_power : 0;
                result.temperature_celsius = total_temp / config_.timing_iterations;
                result.gpu_utilization_percent = total_util / config_.timing_iterations;
                
                size_t mem_used, mem_total;
                monitor_.GetMemoryInfo(mem_used, mem_total);
                result.memory_used_bytes = mem_used;
            }
            
            results_.push_back(result);
            
            // Print summary
            PrintResultSummary(result);
            
            // Cleanup for this size
            Cleanup();
        }
    }
    
    void SaveResults(const std::string& filename) {
        if (config_.output_format == "json") {
            SaveResultsJSON(filename);
        } else if (config_.output_format == "csv") {
            SaveResultsCSV(filename);
        } else {
            SaveResultsHuman(filename);
        }
    }
    
private:
    float CalculateMean(const std::vector<float>& values) {
        float sum = 0.0f;
        for (float v : values) sum += v;
        return sum / values.size();
    }
    
    float CalculateStdDev(const std::vector<float>& values, float mean) {
        float sum_sq = 0.0f;
        for (float v : values) {
            float diff = v - mean;
            sum_sq += diff * diff;
        }
        return std::sqrt(sum_sq / values.size());
    }
    
    void PrintResultSummary(const BenchmarkResult& result) {
        std::cout << std::fixed << std::setprecision(2);
        std::cout << "Problem Size: " << result.problem_size << std::endl;
        std::cout << "  Time: " << result.mean_time_ms << " ms"
                  << " (min: " << result.min_time_ms 
                  << ", max: " << result.max_time_ms << ")" << std::endl;
        std::cout << "  Bandwidth: " << result.bandwidth_gb_s << " GB/s" << std::endl;
        std::cout << "  Throughput: " << result.throughput_gflops << " GFLOPS" << std::endl;
        
        if (config_.enable_monitoring) {
            std::cout << "  Power Efficiency: " 
                      << result.power_efficiency_gflops_per_watt 
                      << " GFLOPS/W" << std::endl;
            std::cout << "  Temperature: " << result.temperature_celsius << " C" << std::endl;
            std::cout << "  GPU Utilization: " << result.gpu_utilization_percent << "%" << std::endl;
        }
    }
    
    void SaveResultsJSON(const std::string& filename) {
        std::ofstream file(filename);
        file << "{\n";
        file << "  \"benchmark\": \"" << config_.name << "\",\n";
        file << "  \"results\": [\n";
        
        for (size_t i = 0; i < results_.size(); ++i) {
            const auto& r = results_[i];
            file << "    {\n";
            file << "      \"problem_size\": " << r.problem_size << ",\n";
            file << "      \"mean_time_ms\": " << r.mean_time_ms << ",\n";
            file << "      \"min_time_ms\": " << r.min_time_ms << ",\n";
            file << "      \"max_time_ms\": " << r.max_time_ms << ",\n";
            file << "      \"std_dev_ms\": " << r.std_dev_ms << ",\n";
            file << "      \"bandwidth_gb_s\": " << r.bandwidth_gb_s << ",\n";
            file << "      \"throughput_gflops\": " << r.throughput_gflops << ",\n";
            file << "      \"power_efficiency_gflops_per_watt\": " 
                 << r.power_efficiency_gflops_per_watt << ",\n";
            file << "      \"temperature_celsius\": " << r.temperature_celsius << ",\n";
            file << "      \"gpu_utilization_percent\": " << r.gpu_utilization_percent << ",\n";
            file << "      \"memory_used_bytes\": " << r.memory_used_bytes << "\n";
            file << "    }" << (i < results_.size() - 1 ? "," : "") << "\n";
        }
        
        file << "  ]\n";
        file << "}\n";
        file.close();
    }
    
    void SaveResultsCSV(const std::string& filename) {
        std::ofstream file(filename);
        
        // Header
        file << "benchmark,problem_size,mean_time_ms,min_time_ms,max_time_ms,"
             << "std_dev_ms,bandwidth_gb_s,throughput_gflops,"
             << "power_efficiency_gflops_per_watt,temperature_celsius,"
             << "gpu_utilization_percent,memory_used_bytes\n";
        
        // Data
        for (const auto& r : results_) {
            file << config_.name << ","
                 << r.problem_size << ","
                 << r.mean_time_ms << ","
                 << r.min_time_ms << ","
                 << r.max_time_ms << ","
                 << r.std_dev_ms << ","
                 << r.bandwidth_gb_s << ","
                 << r.throughput_gflops << ","
                 << r.power_efficiency_gflops_per_watt << ","
                 << r.temperature_celsius << ","
                 << r.gpu_utilization_percent << ","
                 << r.memory_used_bytes << "\n";
        }
        
        file.close();
    }
    
    void SaveResultsHuman(const std::string& filename) {
        std::ofstream file(filename);
        
        file << "Benchmark Report: " << config_.name << "\n";
        file << "=====================================\n\n";
        
        for (const auto& r : results_) {
            file << "Problem Size: " << r.problem_size << "\n";
            file << "  Performance Metrics:\n";
            file << "    - Mean Time: " << r.mean_time_ms << " ms\n";
            file << "    - Min Time: " << r.min_time_ms << " ms\n";
            file << "    - Max Time: " << r.max_time_ms << " ms\n";
            file << "    - Std Dev: " << r.std_dev_ms << " ms\n";
            file << "    - Bandwidth: " << r.bandwidth_gb_s << " GB/s\n";
            file << "    - Throughput: " << r.throughput_gflops << " GFLOPS\n";
            
            if (config_.enable_monitoring) {
                file << "  Power/Thermal Metrics:\n";
                file << "    - Power Efficiency: " 
                     << r.power_efficiency_gflops_per_watt << " GFLOPS/W\n";
                file << "    - Temperature: " << r.temperature_celsius << " °C\n";
                file << "    - GPU Utilization: " << r.gpu_utilization_percent << "%\n";
                file << "    - Memory Used: " << r.memory_used_bytes / (1024*1024) << " MB\n";
            }
            
            file << "\n";
        }
        
        file.close();
    }
};

} // namespace gpu_benchmark

#endif // BENCHMARK_SUITE_CU
/**
 * Automated Test Runner for GPU Testing Framework
 * Runs all unit, performance, and integration tests
 */

#include <iostream>
#include <vector>
#include <memory>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <cuda_runtime.h>
#include "utils/cuda_test_framework.cuh"

// Test categories
enum TestCategory {
    UNIT_TESTS,
    PERFORMANCE_TESTS,
    INTEGRATION_TESTS,
    STRESS_TESTS,
    ALL_TESTS
};

struct TestConfiguration {
    TestCategory category;
    bool enable_profiling;
    bool enable_monitoring;
    bool generate_reports;
    std::string output_directory;
    int device_id;
    bool verbose;
};

class TestRunner {
private:
    TestConfiguration config_;
    std::vector<std::unique_ptr<cuda_test::TestSuite>> test_suites_;
    std::chrono::time_point<std::chrono::high_resolution_clock> start_time_;
    
public:
    TestRunner(const TestConfiguration& config) : config_(config) {
        // Set CUDA device
        CUDA_CHECK(cudaSetDevice(config_.device_id));
        
        // Print device info
        cudaDeviceProp props;
        CUDA_CHECK(cudaGetDeviceProperties(&props, config_.device_id));
        
        std::cout << "=== GPU Test Runner ===" << std::endl;
        std::cout << "Device: " << props.name << std::endl;
        std::cout << "Compute Capability: " << props.major << "." << props.minor << std::endl;
        std::cout << "Memory: " << props.totalGlobalMem / (1024*1024) << " MB" << std::endl;
        std::cout << "SM Count: " << props.multiProcessorCount << std::endl;
        std::cout << "============================\n" << std::endl;
    }
    
    void AddTestSuite(std::unique_ptr<cuda_test::TestSuite> suite) {
        test_suites_.push_back(std::move(suite));
    }
    
    void RunAllTests() {
        start_time_ = std::chrono::high_resolution_clock::now();
        
        // Create output directory if needed
        if (config_.generate_reports) {
            std::string mkdir_cmd = "mkdir -p " + config_.output_directory;
            system(mkdir_cmd.c_str());
        }
        
        // Run test suites based on category
        if (config_.category == ALL_TESTS || config_.category == UNIT_TESTS) {
            RunUnitTests();
        }
        
        if (config_.category == ALL_TESTS || config_.category == PERFORMANCE_TESTS) {
            RunPerformanceTests();
        }
        
        if (config_.category == ALL_TESTS || config_.category == INTEGRATION_TESTS) {
            RunIntegrationTests();
        }
        
        if (config_.category == ALL_TESTS || config_.category == STRESS_TESTS) {
            RunStressTests();
        }
        
        // Generate summary report
        GenerateSummaryReport();
    }
    
private:
    void RunUnitTests() {
        std::cout << "\n=== UNIT TESTS ===" << std::endl;
        
        auto suite = std::make_unique<cuda_test::TestSuite>("Unit Tests");
        
        // Add unit tests
        // Note: In real implementation, these would include the actual test classes
        // suite->AddTest(std::make_unique<QuantumCompressionTest>());
        // suite->AddTest(std::make_unique<MemoryPatternTest>());
        // etc.
        
        suite->RunAll();
        
        if (config_.generate_reports) {
            suite->GenerateReport(config_.output_directory + "/unit_test_results.json");
        }
        
        test_suites_.push_back(std::move(suite));
    }
    
    void RunPerformanceTests() {
        std::cout << "\n=== PERFORMANCE TESTS ===" << std::endl;
        
        auto suite = std::make_unique<cuda_test::TestSuite>("Performance Tests");
        
        // Add performance benchmarks
        // suite->AddTest(std::make_unique<BandwidthBenchmark>());
        // suite->AddTest(std::make_unique<ThroughputBenchmark>());
        // etc.
        
        suite->RunAll();
        
        if (config_.generate_reports) {
            suite->GenerateReport(config_.output_directory + "/performance_results.json");
        }
        
        test_suites_.push_back(std::move(suite));
    }
    
    void RunIntegrationTests() {
        std::cout << "\n=== INTEGRATION TESTS ===" << std::endl;
        
        auto suite = std::make_unique<cuda_test::TestSuite>("Integration Tests");
        
        // Add integration tests
        // suite->AddTest(std::make_unique<FullSystemIntegrationTest>());
        // etc.
        
        suite->RunAll();
        
        if (config_.generate_reports) {
            suite->GenerateReport(config_.output_directory + "/integration_results.json");
        }
        
        test_suites_.push_back(std::move(suite));
    }
    
    void RunStressTests() {
        std::cout << "\n=== STRESS TESTS ===" << std::endl;
        
        auto suite = std::make_unique<cuda_test::TestSuite>("Stress Tests");
        
        // Add stress tests
        // suite->AddTest(std::make_unique<MemoryStressTest>());
        // suite->AddTest(std::make_unique<ConcurrencyStressTest>());
        // etc.
        
        suite->RunAll();
        
        if (config_.generate_reports) {
            suite->GenerateReport(config_.output_directory + "/stress_test_results.json");
        }
        
        test_suites_.push_back(std::move(suite));
    }
    
    void GenerateSummaryReport() {
        auto end_time = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::seconds>(end_time - start_time_);
        
        int total_tests = 0;
        int passed_tests = 0;
        int failed_tests = 0;
        
        // Collect results from all suites
        for (const auto& suite : test_suites_) {
            for (const auto& result : suite->GetResults()) {
                total_tests++;
                if (result.passed) {
                    passed_tests++;
                } else {
                    failed_tests++;
                }
            }
        }
        
        // Print summary
        std::cout << "\n=== TEST SUMMARY ===" << std::endl;
        std::cout << "Total Tests: " << total_tests << std::endl;
        std::cout << "Passed: " << passed_tests << " (" 
                  << (100.0 * passed_tests / total_tests) << "%)" << std::endl;
        std::cout << "Failed: " << failed_tests << " (" 
                  << (100.0 * failed_tests / total_tests) << "%)" << std::endl;
        std::cout << "Total Time: " << duration.count() << " seconds" << std::endl;
        
        // Generate HTML report if requested
        if (config_.generate_reports) {
            GenerateHTMLReport(total_tests, passed_tests, failed_tests, duration.count());
        }
        
        // Exit with appropriate code
        exit(failed_tests > 0 ? 1 : 0);
    }
    
    void GenerateHTMLReport(int total, int passed, int failed, int duration) {
        std::ofstream html(config_.output_directory + "/test_report.html");
        
        html << "<!DOCTYPE html>\n<html>\n<head>\n";
        html << "<title>GPU Test Report</title>\n";
        html << "<style>\n";
        html << "body { font-family: Arial, sans-serif; margin: 20px; }\n";
        html << ".passed { color: green; }\n";
        html << ".failed { color: red; }\n";
        html << "table { border-collapse: collapse; width: 100%; }\n";
        html << "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n";
        html << "th { background-color: #f2f2f2; }\n";
        html << "</style>\n</head>\n<body>\n";
        
        html << "<h1>GPU Test Report</h1>\n";
        html << "<p>Generated: " << GetCurrentDateTime() << "</p>\n";
        
        html << "<h2>Summary</h2>\n";
        html << "<table>\n";
        html << "<tr><th>Metric</th><th>Value</th></tr>\n";
        html << "<tr><td>Total Tests</td><td>" << total << "</td></tr>\n";
        html << "<tr><td>Passed</td><td class='passed'>" << passed << "</td></tr>\n";
        html << "<tr><td>Failed</td><td class='failed'>" << failed << "</td></tr>\n";
        html << "<tr><td>Pass Rate</td><td>" << std::fixed << std::setprecision(1) 
             << (100.0 * passed / total) << "%</td></tr>\n";
        html << "<tr><td>Duration</td><td>" << duration << " seconds</td></tr>\n";
        html << "</table>\n";
        
        html << "<h2>Detailed Results</h2>\n";
        for (const auto& suite : test_suites_) {
            html << "<h3>" << suite->GetName() << "</h3>\n";
            html << "<table>\n";
            html << "<tr><th>Test</th><th>Status</th><th>Time (ms)</th><th>Details</th></tr>\n";
            
            for (const auto& result : suite->GetResults()) {
                html << "<tr>";
                html << "<td>" << result.test_name << "</td>";
                html << "<td class='" << (result.passed ? "passed" : "failed") << "'>"
                     << (result.passed ? "PASSED" : "FAILED") << "</td>";
                html << "<td>" << result.metrics.kernel_time_ms << "</td>";
                html << "<td>" << (result.passed ? "-" : result.error_message) << "</td>";
                html << "</tr>\n";
            }
            
            html << "</table>\n";
        }
        
        html << "</body>\n</html>\n";
        html.close();
    }
    
    std::string GetCurrentDateTime() {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        std::stringstream ss;
        ss << std::put_time(std::localtime(&time_t), "%Y-%m-%d %H:%M:%S");
        return ss.str();
    }
};

// Command line argument parser
TestConfiguration ParseArguments(int argc, char** argv) {
    TestConfiguration config;
    config.category = ALL_TESTS;
    config.enable_profiling = false;
    config.enable_monitoring = false;
    config.generate_reports = true;
    config.output_directory = "./test_results";
    config.device_id = 0;
    config.verbose = false;
    
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        
        if (arg == "--unit") {
            config.category = UNIT_TESTS;
        } else if (arg == "--performance") {
            config.category = PERFORMANCE_TESTS;
        } else if (arg == "--integration") {
            config.category = INTEGRATION_TESTS;
        } else if (arg == "--stress") {
            config.category = STRESS_TESTS;
        } else if (arg == "--profile") {
            config.enable_profiling = true;
        } else if (arg == "--monitor") {
            config.enable_monitoring = true;
        } else if (arg == "--no-reports") {
            config.generate_reports = false;
        } else if (arg == "--device" && i + 1 < argc) {
            config.device_id = std::stoi(argv[++i]);
        } else if (arg == "--output" && i + 1 < argc) {
            config.output_directory = argv[++i];
        } else if (arg == "--verbose" || arg == "-v") {
            config.verbose = true;
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "Usage: " << argv[0] << " [options]\n";
            std::cout << "Options:\n";
            std::cout << "  --unit           Run unit tests only\n";
            std::cout << "  --performance    Run performance tests only\n";
            std::cout << "  --integration    Run integration tests only\n";
            std::cout << "  --stress         Run stress tests only\n";
            std::cout << "  --profile        Enable CUDA profiling\n";
            std::cout << "  --monitor        Enable GPU monitoring\n";
            std::cout << "  --no-reports     Disable report generation\n";
            std::cout << "  --device N       Use CUDA device N (default: 0)\n";
            std::cout << "  --output DIR     Output directory (default: ./test_results)\n";
            std::cout << "  --verbose, -v    Verbose output\n";
            std::cout << "  --help, -h       Show this help\n";
            exit(0);
        }
    }
    
    return config;
}

int main(int argc, char** argv) {
    // Parse command line arguments
    TestConfiguration config = ParseArguments(argc, argv);
    
    try {
        // Create test runner
        TestRunner runner(config);
        
        // Run all tests
        runner.RunAllTests();
        
    } catch (const std::exception& e) {
        std::cerr << "Test runner error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}
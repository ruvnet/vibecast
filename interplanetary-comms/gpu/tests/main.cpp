#include <iostream>
#include <vector>
#include <chrono>
#include <cmath>
#include <random>
#include "gpu_common.cuh"
#include "signal_processing.cuh"

using namespace interplanetary::gpu;
using namespace std::chrono;

// Test GPU device detection and selection
bool testDeviceSelection() {
    std::cout << "\n=== Testing Device Selection ===" << std::endl;
    
    try {
        int bestDevice = gpu::selectBestDevice();
        gpu::DeviceInfo info = gpu::getDeviceInfo(bestDevice);
        gpu::printDeviceInfo(info);
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Device selection failed: " << e.what() << std::endl;
        return false;
    }
}

// Test signal modulation
bool testSignalModulation() {
    std::cout << "\n=== Testing Signal Modulation ===" << std::endl;
    
    const int numSymbols = 10000;
    const float carrierFreq = 2.4e9f; // 2.4 GHz
    const float sampleRate = 10e6f;   // 10 MHz
    
    // Generate random symbols
    std::vector<float> symbols(numSymbols);
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 7); // 8-PSK
    
    for (int i = 0; i < numSymbols; ++i) {
        symbols[i] = static_cast<float>(dis(gen));
    }
    
    // Allocate device memory
    gpu::DeviceMemory<float> d_symbols(numSymbols);
    gpu::DeviceMemory<cuComplex> d_modulated(numSymbols);
    
    // Copy to device
    d_symbols.copyFromHost(symbols.data());
    
    // Time the modulation
    auto start = high_resolution_clock::now();
    modulatePSK(d_symbols.get(), d_modulated.get(), numSymbols, carrierFreq, sampleRate);
    CUDA_CHECK(cudaDeviceSynchronize());
    auto end = high_resolution_clock::now();
    
    auto duration = duration_cast<microseconds>(end - start);
    std::cout << "Modulated " << numSymbols << " symbols in " 
              << duration.count() << " microseconds" << std::endl;
    std::cout << "Throughput: " << (numSymbols * 1e6 / duration.count()) / 1e6 
              << " Msymbols/sec" << std::endl;
    
    return true;
}

// Test Doppler shift compensation
bool testDopplerShift() {
    std::cout << "\n=== Testing Doppler Shift Compensation ===" << std::endl;
    
    const int signalLength = 100000;
    const float sampleRate = 10e6f;
    const float dopplerShift = 1000.0f; // 1 kHz Doppler shift
    
    // Create test signal
    std::vector<cuComplex> signal(signalLength);
    for (int i = 0; i < signalLength; ++i) {
        float t = i / sampleRate;
        signal[i].x = cosf(2.0f * M_PI * 1e6f * t); // 1 MHz signal
        signal[i].y = sinf(2.0f * M_PI * 1e6f * t);
    }
    
    // Allocate device memory
    gpu::DeviceMemory<cuComplex> d_signal(signalLength);
    d_signal.copyFromHost(signal.data());
    
    // Apply Doppler shift
    auto start = high_resolution_clock::now();
    applyDopplerShift(d_signal.get(), signalLength, dopplerShift, sampleRate);
    CUDA_CHECK(cudaDeviceSynchronize());
    auto end = high_resolution_clock::now();
    
    auto duration = duration_cast<microseconds>(end - start);
    std::cout << "Applied Doppler shift to " << signalLength << " samples in " 
              << duration.count() << " microseconds" << std::endl;
    
    return true;
}

// Test signal correlation
bool testSignalCorrelation() {
    std::cout << "\n=== Testing Signal Correlation ===" << std::endl;
    
    const int signalLength = 10000;
    
    // Create two test signals
    std::vector<cuComplex> signal1(signalLength);
    std::vector<cuComplex> signal2(signalLength);
    
    // Generate correlated signals
    for (int i = 0; i < signalLength; ++i) {
        float t = i / 10000.0f;
        signal1[i].x = cosf(2.0f * M_PI * 100.0f * t);
        signal1[i].y = sinf(2.0f * M_PI * 100.0f * t);
        
        // Second signal with phase shift
        signal2[i].x = cosf(2.0f * M_PI * 100.0f * t + M_PI/4);
        signal2[i].y = sinf(2.0f * M_PI * 100.0f * t + M_PI/4);
    }
    
    // Allocate device memory
    gpu::DeviceMemory<cuComplex> d_signal1(signalLength);
    gpu::DeviceMemory<cuComplex> d_signal2(signalLength);
    gpu::DeviceMemory<cuComplex> d_correlation(1);
    
    d_signal1.copyFromHost(signal1.data());
    d_signal2.copyFromHost(signal2.data());
    
    // Perform correlation
    auto start = high_resolution_clock::now();
    correlateSignals(d_signal1.get(), d_signal2.get(), 
                    d_correlation.get(), signalLength);
    CUDA_CHECK(cudaDeviceSynchronize());
    auto end = high_resolution_clock::now();
    
    // Get result
    cuComplex correlation;
    d_correlation.copyToHost(&correlation);
    
    auto duration = duration_cast<microseconds>(end - start);
    std::cout << "Correlation completed in " << duration.count() << " microseconds" << std::endl;
    std::cout << "Correlation value: " << correlation.x << " + " << correlation.y << "i" << std::endl;
    std::cout << "Magnitude: " << sqrtf(correlation.x * correlation.x + correlation.y * correlation.y) << std::endl;
    
    return true;
}

// Test FEC encoding
bool testFECEncoding() {
    std::cout << "\n=== Testing FEC Encoding ===" << std::endl;
    
    const int dataLength = 223 * 100; // 100 RS blocks
    const int encodedLength = 255 * 100;
    
    // Generate random data
    std::vector<uint8_t> data(dataLength);
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 255);
    
    for (int i = 0; i < dataLength; ++i) {
        data[i] = static_cast<uint8_t>(dis(gen));
    }
    
    // Allocate device memory
    gpu::DeviceMemory<uint8_t> d_data(dataLength);
    gpu::DeviceMemory<uint8_t> d_encoded(encodedLength);
    
    d_data.copyFromHost(data.data());
    
    // Perform encoding
    auto start = high_resolution_clock::now();
    applyFECEncoding(d_data.get(), d_encoded.get(), dataLength, encodedLength);
    CUDA_CHECK(cudaDeviceSynchronize());
    auto end = high_resolution_clock::now();
    
    auto duration = duration_cast<microseconds>(end - start);
    std::cout << "Encoded " << dataLength << " bytes in " 
              << duration.count() << " microseconds" << std::endl;
    std::cout << "Encoding rate: " << (dataLength * 1e6 / duration.count()) / 1e6 
              << " MB/sec" << std::endl;
    
    return true;
}

// Test complete signal processing pipeline
bool testSignalPipeline() {
    std::cout << "\n=== Testing Complete Signal Pipeline ===" << std::endl;
    
    SignalConfig config;
    config.carrierFrequency = 2.4e9f;
    config.sampleRate = 10e6f;
    config.symbolRate = 1e6f;
    config.modulationType = 2; // 8-PSK
    config.expectedDopplerRange = 10e3f;
    config.enableFEC = true;
    config.fecRate = 223;
    
    const size_t maxBufferSize = 1024 * 1024; // 1M samples
    
    try {
        SignalProcessor processor(config, maxBufferSize);
        
        // Test data
        const size_t dataLength = 1000;
        std::vector<uint8_t> testData(dataLength);
        for (size_t i = 0; i < dataLength; ++i) {
            testData[i] = static_cast<uint8_t>(i % 256);
        }
        
        // Transmit
        gpu::DeviceMemory<cuComplex> d_transmitSignal(maxBufferSize);
        size_t signalLength;
        
        auto start = high_resolution_clock::now();
        processor.transmitData(testData.data(), dataLength, 
                             d_transmitSignal.get(), signalLength);
        CUDA_CHECK(cudaDeviceSynchronize());
        auto end = high_resolution_clock::now();
        
        auto duration = duration_cast<microseconds>(end - start);
        std::cout << "Transmitted " << dataLength << " bytes as " 
                  << signalLength << " samples in " 
                  << duration.count() << " microseconds" << std::endl;
        
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Pipeline test failed: " << e.what() << std::endl;
        return false;
    }
}

int main() {
    std::cout << "=== Interplanetary Communications GPU Tests ===" << std::endl;
    
    int testsRun = 0;
    int testsPassed = 0;
    
    // Run tests
    std::vector<std::pair<std::string, std::function<bool()>>> tests = {
        {"Device Selection", testDeviceSelection},
        {"Signal Modulation", testSignalModulation},
        {"Doppler Shift", testDopplerShift},
        {"Signal Correlation", testSignalCorrelation},
        {"FEC Encoding", testFECEncoding},
        {"Signal Pipeline", testSignalPipeline}
    };
    
    for (const auto& test : tests) {
        testsRun++;
        std::cout << "\nRunning: " << test.first << std::endl;
        
        try {
            if (test.second()) {
                testsPassed++;
                std::cout << "✓ PASSED" << std::endl;
            } else {
                std::cout << "✗ FAILED" << std::endl;
            }
        } catch (const std::exception& e) {
            std::cout << "✗ FAILED with exception: " << e.what() << std::endl;
        }
    }
    
    // Summary
    std::cout << "\n=== Test Summary ===" << std::endl;
    std::cout << "Tests run: " << testsRun << std::endl;
    std::cout << "Tests passed: " << testsPassed << std::endl;
    std::cout << "Tests failed: " << (testsRun - testsPassed) << std::endl;
    
    return (testsRun == testsPassed) ? 0 : 1;
}
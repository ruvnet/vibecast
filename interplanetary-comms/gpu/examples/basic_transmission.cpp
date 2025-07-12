#include <iostream>
#include <vector>
#include <cstring>
#include "signal_processing.cuh"
#include "gpu_common.cuh"

using namespace interplanetary::gpu;

int main() {
    std::cout << "=== Interplanetary Communication GPU Example ===" << std::endl;
    
    try {
        // Select best GPU
        int device = gpu::selectBestDevice();
        gpu::DeviceInfo info = gpu::getDeviceInfo(device);
        std::cout << "Using GPU: " << info.name << std::endl;
        
        // Configure signal processing
        SignalConfig config;
        config.carrierFrequency = 8.4e9f;     // X-band (8.4 GHz)
        config.sampleRate = 50e6f;            // 50 MHz sampling
        config.symbolRate = 5e6f;             // 5 Msymbols/sec
        config.modulationType = 2;            // 8-PSK
        config.expectedDopplerRange = 100e3f; // ±100 kHz Doppler
        config.enableFEC = true;
        config.fecRate = 223;                 // RS(255,223)
        
        // Create signal processor
        const size_t maxBufferSize = 10 * 1024 * 1024; // 10M samples
        SignalProcessor processor(config, maxBufferSize);
        
        // Prepare test message
        const char* message = "Hello from Earth! This is a test transmission to Mars.";
        std::vector<uint8_t> data(message, message + strlen(message) + 1);
        
        std::cout << "\nTransmitting message: \"" << message << "\"" << std::endl;
        std::cout << "Message size: " << data.size() << " bytes" << std::endl;
        
        // Allocate GPU memory for output signal
        size_t signalLength;
        gpu::DeviceMemory<cuComplex> d_signal(maxBufferSize);
        
        // Transmit data
        auto start = std::chrono::high_resolution_clock::now();
        processor.transmitData(data.data(), data.size(), d_signal.get(), signalLength);
        CUDA_CHECK(cudaDeviceSynchronize());
        auto end = std::chrono::high_resolution_clock::now();
        
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end - start);
        
        std::cout << "\nTransmission complete!" << std::endl;
        std::cout << "Signal length: " << signalLength << " samples" << std::endl;
        std::cout << "Processing time: " << duration.count() << " microseconds" << std::endl;
        std::cout << "Effective data rate: " 
                  << (data.size() * 8.0 * 1e6 / duration.count()) / 1e6 
                  << " Mbps" << std::endl;
        
        // Simulate reception with Doppler shift
        std::cout << "\nSimulating reception with Doppler shift..." << std::endl;
        
        // Apply simulated Doppler shift
        float simulatedDoppler = 50e3f; // 50 kHz Doppler shift
        applyDopplerShift(d_signal.get(), signalLength, simulatedDoppler, config.sampleRate);
        
        // Estimate Doppler shift
        float estimatedDoppler = processor.estimateDopplerShift(d_signal.get(), signalLength);
        std::cout << "Estimated Doppler shift: " << estimatedDoppler << " Hz" << std::endl;
        
        // Calculate signal quality
        float snr = processor.calculateSNR(d_signal.get(), signalLength);
        std::cout << "Signal-to-Noise Ratio: " << snr << " dB" << std::endl;
        
        std::cout << "\n=== Transmission simulation complete ===" << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}
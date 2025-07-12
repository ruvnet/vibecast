#ifndef SIGNAL_PROCESSING_CUH
#define SIGNAL_PROCESSING_CUH

#include <cuda_runtime.h>
#include <cufft.h>
#include <cuComplex.h>
#include <cstdint>

namespace interplanetary {
namespace gpu {

// Signal modulation functions
void modulatePSK(const float* data, cuComplex* modulated, int numSymbols,
                 float carrierFreq, float sampleRate);

// Doppler shift compensation
void applyDopplerShift(cuComplex* signal, int signalLength,
                      float dopplerShift, float sampleRate);

// Signal correlation for synchronization
void correlateSignals(const cuComplex* signal1, const cuComplex* signal2,
                     cuComplex* correlation, int length, cudaStream_t stream = 0);

// Forward Error Correction
void applyFECEncoding(const uint8_t* data, uint8_t* encoded,
                     int dataLength, int codeLength);

// Signal processing pipeline configuration
struct SignalConfig {
    float carrierFrequency;      // Hz
    float sampleRate;            // Hz
    float symbolRate;            // symbols/sec
    int modulationType;          // 0=BPSK, 1=QPSK, 2=8PSK
    float expectedDopplerRange;  // Hz
    bool enableFEC;
    int fecRate;                 // 223/255 for RS(255,223)
};

// Complete signal processing pipeline
class SignalProcessor {
private:
    SignalConfig config_;
    cufftHandle fftPlan_;
    cudaStream_t stream_;
    
    // Device memory buffers
    cuComplex* d_signalBuffer_;
    cuComplex* d_fftBuffer_;
    float* d_symbolBuffer_;
    uint8_t* d_dataBuffer_;
    
    size_t bufferSize_;
    
public:
    SignalProcessor(const SignalConfig& config, size_t maxBufferSize);
    ~SignalProcessor();
    
    // Delete copy operations
    SignalProcessor(const SignalProcessor&) = delete;
    SignalProcessor& operator=(const SignalProcessor&) = delete;
    
    // Process incoming signal
    void processSignal(const cuComplex* inputSignal, size_t signalLength,
                      float* decodedSymbols, size_t& numSymbols);
    
    // Transmit data
    void transmitData(const uint8_t* data, size_t dataLength,
                     cuComplex* outputSignal, size_t& signalLength);
    
    // Doppler estimation
    float estimateDopplerShift(const cuComplex* signal, size_t length);
    
    // Signal quality metrics
    float calculateSNR(const cuComplex* signal, size_t length);
    float calculateBER(const float* receivedSymbols, const float* expectedSymbols, 
                      size_t numSymbols);
};

} // namespace gpu
} // namespace interplanetary

#endif // SIGNAL_PROCESSING_CUH
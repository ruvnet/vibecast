// Vector Addition Kernel
// Adds two vectors element-wise: c[i] = a[i] + b[i]

__global__ void vectorAdd(float* a, float* b, float* c, int n) {
    // Calculate global thread ID
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    
    // Ensure we don't go out of bounds
    if (tid < n) {
        c[tid] = a[tid] + b[tid];
    }
}

// Optimized version with grid-stride loop
__global__ void vectorAddGridStride(float* a, float* b, float* c, int n) {
    // Calculate initial thread ID
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    int stride = blockDim.x * gridDim.x;
    
    // Grid-stride loop handles any vector size
    for (int i = tid; i < n; i += stride) {
        c[i] = a[i] + b[i];
    }
}

// Vector addition with bounds checking
__global__ void vectorAddSafe(float* a, float* b, float* c, int n) {
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    
    if (tid < n) {
        // Optional: Add bounds checking for input arrays
        float val_a = a[tid];
        float val_b = b[tid];
        
        // Check for NaN or infinity
        if (isfinite(val_a) && isfinite(val_b)) {
            c[tid] = val_a + val_b;
        } else {
            c[tid] = 0.0f; // Default value for invalid inputs
        }
    }
}
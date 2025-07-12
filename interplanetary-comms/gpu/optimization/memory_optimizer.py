"""
Memory Access Pattern Optimizer for CUDA Kernels
Implements advanced memory optimization techniques for GPU performance
"""

import numpy as np
import cupy as cp
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import matplotlib.pyplot as plt
import seaborn as sns

@dataclass
class MemoryPattern:
    """Memory access pattern analysis"""
    pattern_type: str  # coalesced, strided, random
    stride: int
    alignment: int
    bank_conflicts: int
    efficiency: float
    recommendations: List[str]

@dataclass 
class SharedMemoryConfig:
    """Shared memory configuration optimization"""
    bank_size_bytes: int = 4
    num_banks: int = 32
    padding_strategy: str = "dynamic"
    bank_conflict_free: bool = True
    allocation_size: int = 0

class MemoryOptimizer:
    """Advanced memory optimization for CUDA kernels"""
    
    def __init__(self, device_id: int = 0):
        self.device = cp.cuda.Device(device_id)
        self.device_props = self._get_device_memory_properties()
        self.optimization_templates = self._load_optimization_templates()
        
    def _get_device_memory_properties(self) -> Dict:
        """Get detailed memory properties of GPU"""
        with self.device:
            props = {
                'global_memory_gb': self.device.mem_info[1] / (1024**3),
                'available_memory_gb': self.device.mem_info[0] / (1024**3),
                'l2_cache_size_kb': 6144,  # Architecture dependent
                'l1_cache_size_kb': 128,   # Per SM
                'shared_memory_per_block_kb': 48,
                'shared_memory_per_sm_kb': 164,
                'memory_bus_width_bits': 384,
                'memory_clock_rate_ghz': 19.5,
                'bank_size_bytes': 4,
                'num_banks': 32,
                'warp_size': 32
            }
            
            # Calculate theoretical bandwidth
            props['theoretical_bandwidth_gb_s'] = (
                props['memory_bus_width_bits'] * 
                props['memory_clock_rate_ghz'] * 2 / 8
            )
            
        return props
    
    def _load_optimization_templates(self) -> Dict[str, str]:
        """Load CUDA optimization templates"""
        return {
            'coalesced_access': '''
// Coalesced memory access pattern
__global__ void optimized_kernel(float* data, int n) {
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    int stride = blockDim.x * gridDim.x;
    
    // Ensure coalesced access
    for (int i = tid; i < n; i += stride) {
        // All threads in warp access consecutive addresses
        float val = data[i];
        // Process val...
        data[i] = val * 2.0f;
    }
}
''',
            'shared_memory_tiling': '''
// Shared memory tiling for data reuse
#define TILE_SIZE 32
__global__ void tiled_kernel(float* in, float* out, int n) {
    __shared__ float tile[TILE_SIZE][TILE_SIZE + 1]; // +1 for bank conflict avoidance
    
    int tx = threadIdx.x, ty = threadIdx.y;
    int bx = blockIdx.x, by = blockIdx.y;
    
    int row = by * TILE_SIZE + ty;
    int col = bx * TILE_SIZE + tx;
    
    // Load tile into shared memory
    if (row < n && col < n) {
        tile[ty][tx] = in[row * n + col];
    }
    __syncthreads();
    
    // Process tile in shared memory
    // ... computation ...
    
    // Write back to global memory
    if (row < n && col < n) {
        out[row * n + col] = tile[ty][tx];
    }
}
''',
            'texture_memory': '''
// Texture memory for spatial locality
texture<float, 2D, cudaReadModeElementType> tex_ref;

__global__ void texture_kernel(float* out, int width, int height) {
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;
    
    if (x < width && y < height) {
        // Texture fetch with automatic caching
        float val = tex2D(tex_ref, x + 0.5f, y + 0.5f);
        out[y * width + x] = val;
    }
}
''',
            'constant_memory': '''
// Constant memory for broadcast reads
__constant__ float c_params[256];

__global__ void constant_kernel(float* data, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    
    if (idx < n) {
        // All threads read same constant memory - broadcasted
        data[idx] *= c_params[0];
        data[idx] += c_params[1];
    }
}
''',
            'prefetching': '''
// Prefetching for latency hiding
__global__ void prefetch_kernel(float* data, int n) {
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    int stride = blockDim.x * gridDim.x;
    
    // Prefetch next data while processing current
    float curr = 0.0f, next = 0.0f;
    
    if (tid < n) curr = data[tid];
    
    for (int i = tid; i < n - stride; i += stride) {
        // Prefetch next iteration's data
        next = data[i + stride];
        
        // Process current data
        curr = curr * 2.0f + 1.0f;
        data[i] = curr;
        
        // Swap for next iteration
        curr = next;
    }
    
    // Handle last element
    if (tid + stride >= n && tid < n) {
        data[tid] = curr * 2.0f + 1.0f;
    }
}
''',
            'bank_conflict_free': '''
// Bank conflict free shared memory access
#define BANK_SIZE 32
__global__ void bank_conflict_free_kernel(float* data, int n) {
    // Padding to avoid bank conflicts
    __shared__ float smem[256][BANK_SIZE + 1];
    
    int tid = threadIdx.x;
    int bid = blockIdx.x;
    int idx = bid * blockDim.x + tid;
    
    // Load with padding - no bank conflicts
    if (idx < n) {
        smem[tid][tid % BANK_SIZE] = data[idx];
    }
    __syncthreads();
    
    // Access pattern that would cause conflicts without padding
    float sum = 0.0f;
    for (int i = 0; i < BANK_SIZE; i++) {
        sum += smem[tid][(tid + i) % BANK_SIZE];
    }
    
    if (idx < n) {
        data[idx] = sum;
    }
}
'''
        }
    
    def analyze_memory_pattern(self, kernel_code: str) -> MemoryPattern:
        """Analyze memory access pattern in kernel code"""
        pattern_type = "unknown"
        stride = 1
        alignment = 4
        bank_conflicts = 0
        efficiency = 0.0
        recommendations = []
        
        # Simple pattern detection (in production would use more sophisticated analysis)
        if "threadIdx.x" in kernel_code and "[tid]" in kernel_code:
            pattern_type = "coalesced"
            efficiency = 0.9
        elif "stride" in kernel_code and "blockDim.x * gridDim.x" in kernel_code:
            pattern_type = "strided" 
            stride = 32  # Warp size
            efficiency = 0.7
            recommendations.append("Consider coalesced access pattern")
        elif "__shared__" in kernel_code:
            if "+ 1]" in kernel_code:  # Padding detected
                pattern_type = "shared_optimized"
                efficiency = 0.85
            else:
                pattern_type = "shared_basic"
                efficiency = 0.6
                bank_conflicts = 16  # Estimated
                recommendations.append("Add padding to avoid bank conflicts")
        else:
            pattern_type = "random"
            efficiency = 0.3
            recommendations.append("Implement coalesced memory access")
            recommendations.append("Consider using shared memory tiling")
        
        # Check alignment
        if "float4" in kernel_code or "alignas(16)" in kernel_code:
            alignment = 16
            efficiency += 0.05
        
        # Check for optimization opportunities
        if "texture" not in kernel_code and pattern_type == "random":
            recommendations.append("Consider texture memory for spatial locality")
        
        if "__constant__" not in kernel_code and "params" in kernel_code:
            recommendations.append("Use constant memory for kernel parameters")
        
        return MemoryPattern(
            pattern_type=pattern_type,
            stride=stride,
            alignment=alignment,
            bank_conflicts=bank_conflicts,
            efficiency=efficiency,
            recommendations=recommendations
        )
    
    def optimize_shared_memory_layout(self, data_type: str, 
                                    dimensions: Tuple[int, ...],
                                    access_pattern: str) -> SharedMemoryConfig:
        """Optimize shared memory layout to avoid bank conflicts"""
        config = SharedMemoryConfig()
        
        element_size = {
            'float': 4,
            'double': 8,
            'int': 4,
            'char': 1,
            'float2': 8,
            'float4': 16
        }.get(data_type, 4)
        
        # Calculate base allocation
        total_elements = np.prod(dimensions)
        base_size = total_elements * element_size
        
        # Determine padding strategy based on access pattern
        if access_pattern == 'row_major':
            # Add padding to avoid bank conflicts in row access
            if len(dimensions) >= 2:
                row_size = dimensions[-1]
                if row_size % config.num_banks == 0:
                    # Add padding element per row
                    padding_elements = dimensions[0] if len(dimensions) == 2 else np.prod(dimensions[:-1])
                    config.allocation_size = base_size + padding_elements * element_size
                    config.padding_strategy = "row_padding"
                else:
                    config.allocation_size = base_size
        
        elif access_pattern == 'column_major':
            # Different padding for column access
            if len(dimensions) >= 2:
                col_size = dimensions[0]
                if col_size % config.num_banks == 0:
                    config.padding_strategy = "column_padding"
                    # Restructure layout
                
        elif access_pattern == 'diagonal':
            # Special padding for diagonal access patterns
            config.padding_strategy = "diagonal_shift"
            
        # Ensure alignment
        config.allocation_size = ((config.allocation_size + 127) // 128) * 128
        
        return config
    
    def generate_optimized_kernel(self, original_kernel: str,
                                optimization_type: str) -> str:
        """Generate optimized version of kernel"""
        if optimization_type not in self.optimization_templates:
            return original_kernel
            
        template = self.optimization_templates[optimization_type]
        
        # Extract kernel signature from original
        import re
        sig_match = re.search(r'__global__\s+void\s+(\w+)\s*\((.*?)\)', original_kernel)
        if sig_match:
            kernel_name = sig_match.group(1)
            params = sig_match.group(2)
            
            # Adapt template to match original signature
            optimized = template.replace('optimized_kernel', kernel_name)
            # More sophisticated parameter matching would be done here
            
            return optimized
        
        return template
    
    def calculate_memory_bandwidth(self, bytes_read: int, bytes_written: int,
                                 execution_time_ms: float) -> float:
        """Calculate achieved memory bandwidth"""
        total_bytes = bytes_read + bytes_written
        bandwidth_gb_s = (total_bytes / (1024**3)) / (execution_time_ms / 1000)
        return bandwidth_gb_s
    
    def optimize_data_layout(self, data_shape: Tuple[int, ...],
                           access_pattern: str) -> Dict[str, any]:
        """Optimize data layout for GPU access patterns"""
        recommendations = {
            'layout': 'row_major',
            'padding': None,
            'transpose': False,
            'blocking': None
        }
        
        if access_pattern == 'column_wise':
            recommendations['transpose'] = True
            recommendations['layout'] = 'column_major'
        
        # Check for optimal blocking
        if len(data_shape) >= 2:
            rows, cols = data_shape[-2:]
            
            # Tile size optimization
            warp_size = self.device_props['warp_size']
            if cols % warp_size != 0:
                padding = warp_size - (cols % warp_size)
                recommendations['padding'] = (0, padding)
            
            # Suggest blocking for cache optimization
            l1_size = self.device_props['l1_cache_size_kb'] * 1024
            element_size = 4  # float
            
            optimal_tile = int(np.sqrt(l1_size / element_size))
            recommendations['blocking'] = (optimal_tile, optimal_tile)
        
        return recommendations
    
    def profile_memory_usage(self, kernel_func, *args) -> Dict[str, float]:
        """Profile actual memory usage of kernel"""
        # Get initial memory state
        self.device.synchronize()
        start_mem = self.device.mem_info[0]
        
        # Allocate memory for profiling
        allocated_arrays = []
        for arg in args:
            if isinstance(arg, np.ndarray):
                gpu_array = cp.asarray(arg)
                allocated_arrays.append(gpu_array)
        
        # Run kernel
        start_time = cp.cuda.Event()
        end_time = cp.cuda.Event()
        
        start_time.record()
        kernel_func(*allocated_arrays)
        end_time.record()
        
        end_time.synchronize()
        execution_time = cp.cuda.get_elapsed_time(start_time, end_time)
        
        # Get memory usage
        self.device.synchronize()
        end_mem = self.device.mem_info[0]
        
        memory_used = start_mem - end_mem
        
        # Calculate bandwidth
        total_data = sum(arr.nbytes for arr in allocated_arrays)
        bandwidth = self.calculate_memory_bandwidth(total_data, total_data, execution_time)
        
        return {
            'execution_time_ms': execution_time,
            'memory_used_mb': memory_used / (1024**2),
            'bandwidth_gb_s': bandwidth,
            'bandwidth_utilization': bandwidth / self.device_props['theoretical_bandwidth_gb_s']
        }
    
    def visualize_memory_patterns(self, patterns: List[MemoryPattern], 
                                output_path: str):
        """Visualize memory access patterns and efficiency"""
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle('Memory Access Pattern Analysis', fontsize=16)
        
        # Pattern distribution
        ax = axes[0, 0]
        pattern_types = [p.pattern_type for p in patterns]
        pattern_counts = {pt: pattern_types.count(pt) for pt in set(pattern_types)}
        ax.pie(pattern_counts.values(), labels=pattern_counts.keys(), autopct='%1.1f%%')
        ax.set_title('Memory Pattern Distribution')
        
        # Efficiency comparison
        ax = axes[0, 1]
        pattern_names = [f"{p.pattern_type}_{i}" for i, p in enumerate(patterns)]
        efficiencies = [p.efficiency for p in patterns]
        bars = ax.bar(pattern_names, efficiencies)
        
        # Color bars based on efficiency
        for bar, eff in zip(bars, efficiencies):
            if eff < 0.5:
                bar.set_color('red')
            elif eff < 0.7:
                bar.set_color('orange')
            else:
                bar.set_color('green')
        
        ax.set_title('Memory Access Efficiency')
        ax.set_ylabel('Efficiency')
        ax.set_ylim(0, 1.0)
        ax.axhline(y=0.7, color='black', linestyle='--', alpha=0.5)
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45)
        
        # Bank conflicts
        ax = axes[1, 0]
        conflicts = [p.bank_conflicts for p in patterns]
        ax.bar(pattern_names, conflicts)
        ax.set_title('Bank Conflicts per Pattern')
        ax.set_ylabel('Number of Conflicts')
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45)
        
        # Stride analysis
        ax = axes[1, 1]
        strides = [p.stride for p in patterns]
        ax.scatter(strides, efficiencies, s=100)
        
        # Add labels for each point
        for i, (stride, eff) in enumerate(zip(strides, efficiencies)):
            ax.annotate(pattern_names[i], (stride, eff), fontsize=8)
        
        ax.set_title('Stride vs Efficiency')
        ax.set_xlabel('Memory Stride')
        ax.set_ylabel('Efficiency')
        ax.set_xscale('log')
        
        # Add optimal stride line
        ax.axvline(x=1, color='green', linestyle='--', label='Optimal (coalesced)')
        ax.axvline(x=32, color='orange', linestyle='--', label='Warp size')
        ax.legend()
        
        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
    
    def generate_optimization_report(self, patterns: List[MemoryPattern]) -> str:
        """Generate detailed optimization report"""
        report = ["Memory Optimization Report", "=" * 50, ""]
        
        # Summary statistics
        avg_efficiency = np.mean([p.efficiency for p in patterns])
        total_conflicts = sum(p.bank_conflicts for p in patterns)
        
        report.append(f"Average Memory Efficiency: {avg_efficiency:.2%}")
        report.append(f"Total Bank Conflicts: {total_conflicts}")
        report.append(f"Patterns Analyzed: {len(patterns)}")
        report.append("")
        
        # Device capabilities
        report.append("Device Memory Capabilities:")
        report.append(f"- Theoretical Bandwidth: {self.device_props['theoretical_bandwidth_gb_s']:.1f} GB/s")
        report.append(f"- L2 Cache: {self.device_props['l2_cache_size_kb']} KB")
        report.append(f"- Shared Memory per Block: {self.device_props['shared_memory_per_block_kb']} KB")
        report.append("")
        
        # Pattern-specific recommendations
        report.append("Pattern-Specific Optimizations:")
        for i, pattern in enumerate(patterns):
            report.append(f"\nPattern {i+1} ({pattern.pattern_type}):")
            report.append(f"  Efficiency: {pattern.efficiency:.2%}")
            report.append(f"  Stride: {pattern.stride}")
            report.append(f"  Bank Conflicts: {pattern.bank_conflicts}")
            
            if pattern.recommendations:
                report.append("  Recommendations:")
                for rec in pattern.recommendations:
                    report.append(f"    - {rec}")
        
        # General optimization strategies
        report.append("\nGeneral Optimization Strategies:")
        report.append("1. Coalesced Access: Ensure consecutive threads access consecutive memory")
        report.append("2. Shared Memory: Use for data reuse within thread blocks")
        report.append("3. Bank Conflicts: Add padding to shared memory arrays")
        report.append("4. Data Layout: Consider AoS vs SoA based on access patterns")
        report.append("5. Prefetching: Hide memory latency with computation")
        
        return "\n".join(report)


# Test the memory optimizer
if __name__ == "__main__":
    optimizer = MemoryOptimizer()
    
    # Example kernel patterns
    test_kernels = [
        '''__global__ void test_kernel(float* data, int n) {
            int tid = blockIdx.x * blockDim.x + threadIdx.x;
            if (tid < n) data[tid] = data[tid] * 2.0f;
        }''',
        
        '''__global__ void strided_kernel(float* data, int n) {
            int tid = threadIdx.x;
            int stride = blockDim.x;
            for (int i = tid; i < n; i += stride) {
                data[i] = data[i] + 1.0f;
            }
        }''',
        
        '''__global__ void shared_kernel(float* data, int n) {
            __shared__ float smem[256];
            int tid = threadIdx.x;
            int gid = blockIdx.x * blockDim.x + tid;
            if (gid < n) smem[tid] = data[gid];
            __syncthreads();
            if (gid < n) data[gid] = smem[tid] * 2.0f;
        }'''
    ]
    
    # Analyze patterns
    patterns = []
    for kernel in test_kernels:
        pattern = optimizer.analyze_memory_pattern(kernel)
        patterns.append(pattern)
    
    # Generate report
    report = optimizer.generate_optimization_report(patterns)
    print(report)
    
    # Visualize patterns
    optimizer.visualize_memory_patterns(patterns, 
        "/workspaces/vibecast/interplanetary-comms/gpu/optimization/memory_patterns.png")
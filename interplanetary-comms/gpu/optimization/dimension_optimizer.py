"""
Block and Grid Dimension Optimizer for CUDA Kernels
Automatically tunes block and grid dimensions for optimal performance
"""

import numpy as np
import itertools
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import seaborn as sns

@dataclass
class DimensionConfig:
    """Configuration for kernel dimensions"""
    block_dim: Tuple[int, int, int]
    grid_dim: Tuple[int, int, int]
    occupancy: float
    theoretical_bandwidth: float
    shared_memory_per_block: int
    registers_per_thread: int
    
@dataclass
class OptimalConfig:
    """Optimal configuration result"""
    config: DimensionConfig
    performance_metric: float
    execution_time_ms: float
    bandwidth_utilization: float
    bottleneck: str

class DimensionOptimizer:
    """Optimize CUDA kernel block and grid dimensions"""
    
    def __init__(self, device_properties: Dict):
        self.device_props = device_properties
        self.warp_size = 32
        self.max_threads_per_block = device_properties.get('max_threads_per_block', 1024)
        self.max_blocks_per_sm = device_properties.get('max_blocks_per_sm', 32)
        self.max_threads_per_sm = device_properties.get('max_threads_per_sm', 2048)
        self.num_sms = device_properties.get('multiprocessor_count', 80)
        self.max_shared_memory_per_block = device_properties.get('max_shared_memory_per_block', 49152)
        self.max_registers_per_block = device_properties.get('max_registers_per_block', 65536)
        
    def calculate_occupancy(self, block_size: int, registers_per_thread: int,
                          shared_memory_per_block: int) -> float:
        """Calculate theoretical occupancy for given configuration"""
        # Thread limit
        max_blocks_thread = self.max_threads_per_sm // block_size
        
        # Register limit
        if registers_per_thread > 0:
            max_blocks_reg = self.max_registers_per_block // (registers_per_thread * block_size)
        else:
            max_blocks_reg = self.max_blocks_per_sm
        
        # Shared memory limit
        if shared_memory_per_block > 0:
            max_blocks_smem = self.max_shared_memory_per_block // shared_memory_per_block
        else:
            max_blocks_smem = self.max_blocks_per_sm
        
        # Hardware limit
        max_blocks_hw = self.max_blocks_per_sm
        
        # Actual blocks per SM
        blocks_per_sm = min(max_blocks_thread, max_blocks_reg, 
                           max_blocks_smem, max_blocks_hw)
        
        # Calculate occupancy
        active_warps = (blocks_per_sm * block_size) // self.warp_size
        max_warps = self.max_threads_per_sm // self.warp_size
        
        occupancy = active_warps / max_warps if max_warps > 0 else 0
        return min(1.0, occupancy)
    
    def generate_dimension_candidates(self, data_size: int, 
                                    kernel_type: str = "general") -> List[Tuple[int, int, int]]:
        """Generate candidate block dimensions based on kernel type"""
        candidates = []
        
        if kernel_type == "general":
            # Common block sizes for general kernels
            base_sizes = [32, 64, 128, 256, 512, 1024]
            for size in base_sizes:
                if size <= self.max_threads_per_block:
                    candidates.append((size, 1, 1))
        
        elif kernel_type == "matrix":
            # 2D block configurations for matrix operations
            tile_sizes = [8, 16, 32]
            for tile in tile_sizes:
                if tile * tile <= self.max_threads_per_block:
                    candidates.append((tile, tile, 1))
                # Rectangular tiles
                if tile * tile * 2 <= self.max_threads_per_block:
                    candidates.append((tile * 2, tile, 1))
                    candidates.append((tile, tile * 2, 1))
        
        elif kernel_type == "reduction":
            # Powers of 2 for efficient reduction
            size = 32
            while size <= min(1024, self.max_threads_per_block):
                candidates.append((size, 1, 1))
                size *= 2
        
        elif kernel_type == "stencil":
            # 2D/3D configurations for stencil operations
            for x in [8, 16, 32]:
                for y in [8, 16, 32]:
                    if x * y <= self.max_threads_per_block:
                        candidates.append((x, y, 1))
                    # 3D stencils
                    for z in [2, 4, 8]:
                        if x * y * z <= self.max_threads_per_block:
                            candidates.append((x, y, z))
        
        return candidates
    
    def calculate_grid_dimensions(self, data_size: int, 
                                block_dim: Tuple[int, int, int],
                                data_shape: Optional[Tuple[int, ...]] = None) -> Tuple[int, int, int]:
        """Calculate optimal grid dimensions for data size and block dimensions"""
        block_size = block_dim[0] * block_dim[1] * block_dim[2]
        
        if data_shape is None:
            # 1D data
            grid_x = (data_size + block_size - 1) // block_size
            return (grid_x, 1, 1)
        
        elif len(data_shape) == 2:
            # 2D data
            grid_x = (data_shape[1] + block_dim[0] - 1) // block_dim[0]
            grid_y = (data_shape[0] + block_dim[1] - 1) // block_dim[1]
            return (grid_x, grid_y, 1)
        
        elif len(data_shape) == 3:
            # 3D data
            grid_x = (data_shape[2] + block_dim[0] - 1) // block_dim[0]
            grid_y = (data_shape[1] + block_dim[1] - 1) // block_dim[1]
            grid_z = (data_shape[0] + block_dim[2] - 1) // block_dim[2]
            return (grid_x, grid_y, grid_z)
        
        else:
            # Default to 1D
            return ((data_size + block_size - 1) // block_size, 1, 1)
    
    def estimate_performance_metric(self, config: DimensionConfig,
                                  memory_accesses: int,
                                  compute_operations: int) -> float:
        """Estimate performance metric for configuration"""
        # Base score from occupancy
        score = config.occupancy
        
        # Penalize low occupancy severely
        if config.occupancy < 0.25:
            score *= 0.5
        
        # Consider memory vs compute balance
        compute_intensity = compute_operations / max(1, memory_accesses)
        
        if compute_intensity > 10:
            # Compute bound - occupancy matters more
            score *= (1 + config.occupancy * 0.5)
        else:
            # Memory bound - bandwidth utilization matters more
            bandwidth_efficiency = min(1.0, config.theoretical_bandwidth / 
                                     self.device_props.get('theoretical_bandwidth_gb_s', 1000))
            score *= (0.7 + 0.3 * bandwidth_efficiency)
        
        # Penalize excessive grid dimensions (launch overhead)
        total_blocks = config.grid_dim[0] * config.grid_dim[1] * config.grid_dim[2]
        if total_blocks > self.num_sms * 16:
            score *= 0.9
        
        # Bonus for warp-aligned block sizes
        block_size = config.block_dim[0] * config.block_dim[1] * config.block_dim[2]
        if block_size % self.warp_size == 0:
            score *= 1.1
        
        return min(1.0, score)
    
    def analyze_bottleneck(self, config: DimensionConfig,
                         memory_bandwidth_gb_s: float,
                         compute_throughput_gflops: float) -> str:
        """Identify performance bottleneck for configuration"""
        # Check occupancy bottleneck
        if config.occupancy < 0.5:
            if config.registers_per_thread > 32:
                return "register_pressure"
            elif config.shared_memory_per_block > 16384:
                return "shared_memory"
            else:
                return "low_occupancy"
        
        # Check memory bottleneck
        bandwidth_utilization = memory_bandwidth_gb_s / self.device_props.get('theoretical_bandwidth_gb_s', 1000)
        if bandwidth_utilization > 0.8:
            return "memory_bandwidth"
        
        # Check compute bottleneck
        theoretical_compute = self.device_props.get('theoretical_flops_tflops', 20) * 1000
        compute_utilization = compute_throughput_gflops / theoretical_compute
        if compute_utilization > 0.8:
            return "compute_bound"
        
        # Check launch overhead
        total_blocks = config.grid_dim[0] * config.grid_dim[1] * config.grid_dim[2]
        if total_blocks < self.num_sms:
            return "insufficient_parallelism"
        
        return "balanced"
    
    def optimize_dimensions(self, data_size: int,
                          kernel_type: str = "general",
                          registers_per_thread: int = 32,
                          shared_memory_per_block: int = 0,
                          memory_accesses: int = 1,
                          compute_operations: int = 1,
                          data_shape: Optional[Tuple[int, ...]] = None) -> OptimalConfig:
        """Find optimal block and grid dimensions"""
        candidates = self.generate_dimension_candidates(data_size, kernel_type)
        best_config = None
        best_score = -1
        
        for block_dim in candidates:
            # Calculate grid dimensions
            grid_dim = self.calculate_grid_dimensions(data_size, block_dim, data_shape)
            
            # Skip if grid is too large
            total_blocks = grid_dim[0] * grid_dim[1] * grid_dim[2]
            if total_blocks > 65535:  # CUDA limit
                continue
            
            # Calculate occupancy
            block_size = block_dim[0] * block_dim[1] * block_dim[2]
            occupancy = self.calculate_occupancy(block_size, registers_per_thread,
                                               shared_memory_per_block)
            
            # Estimate bandwidth
            threads_per_block = block_size
            memory_per_thread = memory_accesses * 4  # Assume float
            bandwidth_per_sm = threads_per_block * memory_per_thread * occupancy
            theoretical_bandwidth = bandwidth_per_sm * self.num_sms / 1e9  # GB/s
            
            config = DimensionConfig(
                block_dim=block_dim,
                grid_dim=grid_dim,
                occupancy=occupancy,
                theoretical_bandwidth=theoretical_bandwidth,
                shared_memory_per_block=shared_memory_per_block,
                registers_per_thread=registers_per_thread
            )
            
            # Calculate performance metric
            score = self.estimate_performance_metric(config, memory_accesses, 
                                                   compute_operations)
            
            if score > best_score:
                best_score = score
                best_config = config
        
        # Analyze bottleneck
        memory_bandwidth = best_config.theoretical_bandwidth
        compute_throughput = (compute_operations * best_config.occupancy * 
                            self.num_sms * 1000) / 1e9  # GFLOPs
        
        bottleneck = self.analyze_bottleneck(best_config, memory_bandwidth,
                                            compute_throughput)
        
        return OptimalConfig(
            config=best_config,
            performance_metric=best_score,
            execution_time_ms=0.0,  # Would be measured in practice
            bandwidth_utilization=memory_bandwidth / 
                                self.device_props.get('theoretical_bandwidth_gb_s', 1000),
            bottleneck=bottleneck
        )
    
    def generate_occupancy_heatmap(self, kernel_type: str = "general",
                                 output_path: str = "occupancy_heatmap.png"):
        """Generate occupancy heatmap for different configurations"""
        # Parameter ranges
        register_counts = [16, 24, 32, 40, 48, 56, 64]
        block_sizes = [32, 64, 128, 256, 512, 1024]
        
        # Calculate occupancy matrix
        occupancy_matrix = np.zeros((len(register_counts), len(block_sizes)))
        
        for i, regs in enumerate(register_counts):
            for j, block_size in enumerate(block_sizes):
                if block_size <= self.max_threads_per_block:
                    occupancy = self.calculate_occupancy(block_size, regs, 0)
                    occupancy_matrix[i, j] = occupancy
        
        # Create heatmap
        plt.figure(figsize=(10, 8))
        sns.heatmap(occupancy_matrix, 
                   xticklabels=block_sizes,
                   yticklabels=register_counts,
                   annot=True, 
                   fmt='.2f',
                   cmap='YlOrRd',
                   cbar_kws={'label': 'Occupancy'})
        
        plt.title(f'Occupancy Heatmap - {kernel_type.capitalize()} Kernel')
        plt.xlabel('Block Size (threads)')
        plt.ylabel('Registers per Thread')
        
        # Add optimal region
        optimal_mask = occupancy_matrix >= 0.5
        for i in range(len(register_counts)):
            for j in range(len(block_sizes)):
                if optimal_mask[i, j]:
                    plt.text(j + 0.5, i + 0.5, '✓', 
                           ha='center', va='center', 
                           color='green', fontsize=20, weight='bold')
        
        plt.tight_layout()
        plt.savefig(output_path, dpi=150)
        plt.close()
    
    def visualize_dimension_space(self, data_size: int,
                                kernel_type: str = "matrix",
                                output_path: str = "dimension_space.png"):
        """Visualize performance across dimension space"""
        if kernel_type != "matrix":
            return self.generate_occupancy_heatmap(kernel_type, output_path)
        
        # For matrix kernels, show 2D block dimension space
        fig = plt.figure(figsize=(15, 5))
        
        # Subplot 1: Occupancy
        ax1 = fig.add_subplot(131)
        tile_sizes = [4, 8, 16, 32]
        occupancy_data = []
        
        for tx in tile_sizes:
            row = []
            for ty in tile_sizes:
                if tx * ty <= self.max_threads_per_block:
                    occupancy = self.calculate_occupancy(tx * ty, 32, 0)
                    row.append(occupancy)
                else:
                    row.append(0)
            occupancy_data.append(row)
        
        im1 = ax1.imshow(occupancy_data, cmap='YlOrRd', aspect='auto')
        ax1.set_xticks(range(len(tile_sizes)))
        ax1.set_yticks(range(len(tile_sizes)))
        ax1.set_xticklabels(tile_sizes)
        ax1.set_yticklabels(tile_sizes)
        ax1.set_xlabel('Block X')
        ax1.set_ylabel('Block Y')
        ax1.set_title('Occupancy')
        plt.colorbar(im1, ax=ax1)
        
        # Subplot 2: Memory efficiency
        ax2 = fig.add_subplot(132)
        memory_data = []
        
        for tx in tile_sizes:
            row = []
            for ty in tile_sizes:
                if tx * ty <= self.max_threads_per_block:
                    # Estimate memory efficiency based on tile size
                    efficiency = min(1.0, (tx * ty) / 256)  # Optimal around 256 threads
                    row.append(efficiency)
                else:
                    row.append(0)
            memory_data.append(row)
        
        im2 = ax2.imshow(memory_data, cmap='Blues', aspect='auto')
        ax2.set_xticks(range(len(tile_sizes)))
        ax2.set_yticks(range(len(tile_sizes)))
        ax2.set_xticklabels(tile_sizes)
        ax2.set_yticklabels(tile_sizes)
        ax2.set_xlabel('Block X')
        ax2.set_ylabel('Block Y')
        ax2.set_title('Memory Efficiency')
        plt.colorbar(im2, ax=ax2)
        
        # Subplot 3: Combined score
        ax3 = fig.add_subplot(133)
        combined_data = []
        
        for i, tx in enumerate(tile_sizes):
            row = []
            for j, ty in enumerate(tile_sizes):
                if tx * ty <= self.max_threads_per_block:
                    score = 0.7 * occupancy_data[i][j] + 0.3 * memory_data[i][j]
                    row.append(score)
                else:
                    row.append(0)
            combined_data.append(row)
        
        im3 = ax3.imshow(combined_data, cmap='Greens', aspect='auto')
        ax3.set_xticks(range(len(tile_sizes)))
        ax3.set_yticks(range(len(tile_sizes)))
        ax3.set_xticklabels(tile_sizes)
        ax3.set_yticklabels(tile_sizes)
        ax3.set_xlabel('Block X')
        ax3.set_ylabel('Block Y')
        ax3.set_title('Combined Performance Score')
        plt.colorbar(im3, ax=ax3)
        
        # Mark optimal configuration
        optimal_idx = np.unravel_index(np.argmax(combined_data), 
                                      (len(tile_sizes), len(tile_sizes)))
        ax3.scatter(optimal_idx[1], optimal_idx[0], marker='*', 
                   s=500, c='red', edgecolors='black')
        
        plt.suptitle(f'Block Dimension Analysis for {kernel_type.capitalize()} Kernels')
        plt.tight_layout()
        plt.savefig(output_path, dpi=150)
        plt.close()
    
    def generate_optimization_report(self, configs: Dict[str, OptimalConfig]) -> str:
        """Generate comprehensive dimension optimization report"""
        report = ["Block and Grid Dimension Optimization Report", "=" * 50, ""]
        
        # Device configuration
        report.append("Device Configuration:")
        report.append(f"- Max threads per block: {self.max_threads_per_block}")
        report.append(f"- Max threads per SM: {self.max_threads_per_sm}")
        report.append(f"- Number of SMs: {self.num_sms}")
        report.append(f"- Warp size: {self.warp_size}")
        report.append("")
        
        # Optimal configurations by kernel type
        report.append("Optimal Configurations by Kernel Type:")
        
        for kernel_type, config in configs.items():
            report.append(f"\n{kernel_type.upper()} Kernel:")
            report.append(f"  Block dimensions: {config.config.block_dim}")
            report.append(f"  Grid dimensions: {config.config.grid_dim}")
            report.append(f"  Occupancy: {config.config.occupancy:.1%}")
            report.append(f"  Performance score: {config.performance_metric:.2f}")
            report.append(f"  Bottleneck: {config.bottleneck}")
            
            # Recommendations based on bottleneck
            if config.bottleneck == "register_pressure":
                report.append("  Recommendation: Reduce register usage or decrease block size")
            elif config.bottleneck == "shared_memory":
                report.append("  Recommendation: Reduce shared memory usage or use dynamic allocation")
            elif config.bottleneck == "memory_bandwidth":
                report.append("  Recommendation: Optimize memory access patterns, use shared memory")
            elif config.bottleneck == "insufficient_parallelism":
                report.append("  Recommendation: Increase data size or reduce block size")
        
        # General guidelines
        report.append("\nGeneral Optimization Guidelines:")
        report.append("1. Aim for at least 50% occupancy")
        report.append("2. Use multiples of warp size (32) for block dimensions")
        report.append("3. Balance register and shared memory usage")
        report.append("4. Consider memory access patterns when choosing 2D/3D blocks")
        report.append("5. Profile actual performance to validate theoretical predictions")
        
        return "\n".join(report)


# Test dimension optimizer
if __name__ == "__main__":
    # Example device properties
    device_props = {
        'max_threads_per_block': 1024,
        'max_blocks_per_sm': 32,
        'max_threads_per_sm': 2048,
        'multiprocessor_count': 80,
        'max_shared_memory_per_block': 49152,
        'max_registers_per_block': 65536,
        'theoretical_bandwidth_gb_s': 1555
    }
    
    optimizer = DimensionOptimizer(device_props)
    
    # Test different kernel types
    kernel_types = ["general", "matrix", "reduction", "stencil"]
    configs = {}
    
    for kernel_type in kernel_types:
        print(f"\nOptimizing {kernel_type} kernel...")
        
        data_size = 1024 * 1024  # 1M elements
        if kernel_type == "matrix":
            data_shape = (1024, 1024)
        else:
            data_shape = None
        
        optimal = optimizer.optimize_dimensions(
            data_size=data_size,
            kernel_type=kernel_type,
            registers_per_thread=32,
            shared_memory_per_block=4096,
            memory_accesses=2,
            compute_operations=10,
            data_shape=data_shape
        )
        
        configs[kernel_type] = optimal
        
        print(f"  Optimal block: {optimal.config.block_dim}")
        print(f"  Optimal grid: {optimal.config.grid_dim}")
        print(f"  Occupancy: {optimal.config.occupancy:.1%}")
        print(f"  Bottleneck: {optimal.bottleneck}")
    
    # Generate visualizations
    optimizer.generate_occupancy_heatmap(
        "general",
        "/workspaces/vibecast/interplanetary-comms/gpu/optimization/occupancy_general.png"
    )
    
    optimizer.visualize_dimension_space(
        1024 * 1024, "matrix",
        "/workspaces/vibecast/interplanetary-comms/gpu/optimization/dimension_matrix.png"
    )
    
    # Generate report
    report = optimizer.generate_optimization_report(configs)
    with open("/workspaces/vibecast/interplanetary-comms/gpu/optimization/dimension_report.txt", "w") as f:
        f.write(report)
"""
Kernel Fusion Optimizer for CUDA
Implements automatic kernel fusion to reduce memory transfers and improve performance
"""

import ast
import re
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass
import networkx as nx
import matplotlib.pyplot as plt

@dataclass
class KernelInfo:
    """Information about a CUDA kernel"""
    name: str
    code: str
    inputs: List[str]
    outputs: List[str]
    shared_memory_size: int
    register_count: int
    block_size: Tuple[int, int, int]
    grid_size: Tuple[int, int, int]
    
@dataclass
class FusionCandidate:
    """Candidate kernels for fusion"""
    kernel1: KernelInfo
    kernel2: KernelInfo
    fusion_benefit: float
    fusion_type: str  # vertical, horizontal, nested
    shared_data: List[str]
    
@dataclass
class FusedKernel:
    """Result of kernel fusion"""
    name: str
    code: str
    original_kernels: List[str]
    performance_gain: float
    memory_savings: float

class KernelFusionOptimizer:
    """Automatic kernel fusion for GPU optimization"""
    
    def __init__(self):
        self.kernel_graph = nx.DiGraph()
        self.fusion_rules = self._initialize_fusion_rules()
        self.fusion_templates = self._load_fusion_templates()
        
    def _initialize_fusion_rules(self) -> Dict[str, callable]:
        """Initialize rules for kernel fusion eligibility"""
        return {
            'data_dependency': self._check_data_dependency,
            'resource_limits': self._check_resource_limits,
            'memory_pattern': self._check_memory_pattern_compatibility,
            'computation_intensity': self._check_computation_intensity,
            'synchronization': self._check_synchronization_requirements
        }
    
    def _load_fusion_templates(self) -> Dict[str, str]:
        """Load templates for different fusion patterns"""
        return {
            'vertical_fusion': '''
// Vertically fused kernel - sequential operations
__global__ void {fused_name}({parameters}) {{
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    int total_threads = blockDim.x * gridDim.x;
    
    // Shared memory for intermediate results
    extern __shared__ float shared_mem[];
    
    for (int i = idx; i < {data_size}; i += total_threads) {{
        // First kernel computation
        {kernel1_body}
        
        // Store intermediate result in registers or shared memory
        float intermediate = {intermediate_calc};
        
        // Second kernel computation using intermediate
        {kernel2_body}
    }}
}}
''',
            'horizontal_fusion': '''
// Horizontally fused kernel - independent operations
__global__ void {fused_name}({parameters}) {{
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    int total_threads = blockDim.x * gridDim.x;
    
    // Process multiple independent data streams
    for (int i = idx; i < {data_size}; i += total_threads) {{
        // First operation stream
        if (i < {stream1_size}) {{
            {kernel1_body}
        }}
        
        // Second operation stream (independent)
        if (i < {stream2_size}) {{
            {kernel2_body}
        }}
    }}
}}
''',
            'nested_fusion': '''
// Nested loop fusion
__global__ void {fused_name}({parameters}) {{
    int tx = threadIdx.x, ty = threadIdx.y;
    int bx = blockIdx.x, by = blockIdx.y;
    
    // Shared memory tiles
    __shared__ float tile1[{tile_size}][{tile_size}];
    __shared__ float tile2[{tile_size}][{tile_size}];
    
    // Fused nested loops
    int row = by * {tile_size} + ty;
    int col = bx * {tile_size} + tx;
    
    if (row < {rows} && col < {cols}) {{
        // Load and process in single pass
        {fused_loop_body}
    }}
}}
''',
            'reduction_fusion': '''
// Fused reduction operations
__global__ void {fused_name}({parameters}) {{
    extern __shared__ float sdata[];
    
    int tid = threadIdx.x;
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    
    // Load and initial reduction
    float val1 = 0, val2 = 0;
    if (idx < {data_size}) {{
        val1 = {load_op1};
        val2 = {load_op2};
    }}
    
    // Store in shared memory
    sdata[tid] = val1;
    sdata[tid + blockDim.x] = val2;
    __syncthreads();
    
    // Parallel reduction for both values
    for (int s = blockDim.x/2; s > 0; s >>= 1) {{
        if (tid < s) {{
            sdata[tid] += sdata[tid + s];
            sdata[tid + blockDim.x] += sdata[tid + blockDim.x + s];
        }}
        __syncthreads();
    }}
    
    // Write results
    if (tid == 0) {{
        {store_results}
    }}
}}
'''
        }
    
    def analyze_kernel(self, kernel_code: str) -> KernelInfo:
        """Analyze kernel to extract information"""
        # Extract kernel name
        name_match = re.search(r'__global__\s+void\s+(\w+)', kernel_code)
        kernel_name = name_match.group(1) if name_match else "unknown"
        
        # Extract parameters
        param_match = re.search(r'__global__\s+void\s+\w+\s*\((.*?)\)', kernel_code, re.DOTALL)
        params = param_match.group(1) if param_match else ""
        
        # Parse inputs and outputs
        inputs = []
        outputs = []
        for param in params.split(','):
            param = param.strip()
            if 'const' in param or not '*' in param:
                # Input parameter
                var_name = re.search(r'(\w+)$', param)
                if var_name:
                    inputs.append(var_name.group(1))
            elif '*' in param and 'const' not in param:
                # Output parameter
                var_name = re.search(r'(\w+)$', param)
                if var_name:
                    outputs.append(var_name.group(1))
        
        # Estimate resource usage
        shared_mem_size = 0
        if '__shared__' in kernel_code:
            # Simple estimation based on declarations
            shared_matches = re.findall(r'__shared__.*?\[(\d+)\]', kernel_code)
            for match in shared_matches:
                shared_mem_size += int(match) * 4  # Assume float
        
        # Estimate register count (simplified)
        local_vars = len(re.findall(r'(float|int|double)\s+\w+\s*=', kernel_code))
        register_count = max(16, local_vars * 2)  # Rough estimate
        
        # Default block/grid sizes
        block_size = (256, 1, 1)
        grid_size = (256, 1, 1)
        
        return KernelInfo(
            name=kernel_name,
            code=kernel_code,
            inputs=inputs,
            outputs=outputs,
            shared_memory_size=shared_mem_size,
            register_count=register_count,
            block_size=block_size,
            grid_size=grid_size
        )
    
    def build_kernel_dependency_graph(self, kernels: List[KernelInfo]):
        """Build dependency graph between kernels"""
        self.kernel_graph.clear()
        
        # Add nodes
        for kernel in kernels:
            self.kernel_graph.add_node(kernel.name, info=kernel)
        
        # Add edges based on data dependencies
        for i, k1 in enumerate(kernels):
            for j, k2 in enumerate(kernels):
                if i != j:
                    # Check if output of k1 is input to k2
                    shared_data = set(k1.outputs) & set(k2.inputs)
                    if shared_data:
                        self.kernel_graph.add_edge(k1.name, k2.name, 
                                                 data=list(shared_data))
    
    def _check_data_dependency(self, k1: KernelInfo, k2: KernelInfo) -> bool:
        """Check if kernels have compatible data dependencies"""
        # Direct producer-consumer relationship
        if set(k1.outputs) & set(k2.inputs):
            return True
        
        # No conflicting writes
        if set(k1.outputs) & set(k2.outputs):
            return False
        
        return True
    
    def _check_resource_limits(self, k1: KernelInfo, k2: KernelInfo) -> bool:
        """Check if fused kernel would exceed resource limits"""
        # Combined register usage
        total_registers = k1.register_count + k2.register_count
        if total_registers > 255:  # Max registers per thread
            return False
        
        # Combined shared memory
        total_shared = k1.shared_memory_size + k2.shared_memory_size
        if total_shared > 49152:  # 48KB shared memory limit
            return False
        
        return True
    
    def _check_memory_pattern_compatibility(self, k1: KernelInfo, k2: KernelInfo) -> bool:
        """Check if memory access patterns are compatible"""
        # Simple heuristic: check for similar array access patterns
        pattern1 = re.findall(r'\[.*?\]', k1.code)
        pattern2 = re.findall(r'\[.*?\]', k2.code)
        
        # If patterns are too different, fusion might hurt cache performance
        if len(pattern1) > 0 and len(pattern2) > 0:
            similarity = len(set(pattern1) & set(pattern2)) / max(len(pattern1), len(pattern2))
            return similarity > 0.3
        
        return True
    
    def _check_computation_intensity(self, k1: KernelInfo, k2: KernelInfo) -> bool:
        """Check if computation intensity justifies fusion"""
        # Count arithmetic operations
        ops1 = len(re.findall(r'[\+\-\*\/]', k1.code))
        ops2 = len(re.findall(r'[\+\-\*\/]', k2.code))
        
        # Count memory operations
        mem_ops1 = len(re.findall(r'\[.*?\]', k1.code))
        mem_ops2 = len(re.findall(r'\[.*?\]', k2.code))
        
        # Compute intensity
        intensity1 = ops1 / max(1, mem_ops1)
        intensity2 = ops2 / max(1, mem_ops2)
        
        # Similar intensity kernels fuse better
        return abs(intensity1 - intensity2) < 2.0
    
    def _check_synchronization_requirements(self, k1: KernelInfo, k2: KernelInfo) -> bool:
        """Check synchronization compatibility"""
        # Check for __syncthreads() calls
        sync1 = '__syncthreads()' in k1.code
        sync2 = '__syncthreads()' in k2.code
        
        # If both have sync, need careful fusion
        if sync1 and sync2:
            # Check if they can be merged
            return 'shared' in k1.code and 'shared' in k2.code
        
        return True
    
    def identify_fusion_candidates(self, kernels: List[KernelInfo]) -> List[FusionCandidate]:
        """Identify pairs of kernels that can be fused"""
        candidates = []
        
        self.build_kernel_dependency_graph(kernels)
        
        # Check all pairs
        for i, k1 in enumerate(kernels):
            for j, k2 in enumerate(kernels[i+1:], i+1):
                # Check all fusion rules
                can_fuse = all(rule(k1, k2) for rule in self.fusion_rules.values())
                
                if can_fuse:
                    # Determine fusion type and benefit
                    fusion_type, benefit = self._determine_fusion_type(k1, k2)
                    
                    if benefit > 0.1:  # At least 10% benefit threshold
                        shared_data = list(set(k1.outputs) & set(k2.inputs))
                        
                        candidates.append(FusionCandidate(
                            kernel1=k1,
                            kernel2=k2,
                            fusion_benefit=benefit,
                            fusion_type=fusion_type,
                            shared_data=shared_data
                        ))
        
        # Sort by benefit
        candidates.sort(key=lambda x: x.fusion_benefit, reverse=True)
        
        return candidates
    
    def _determine_fusion_type(self, k1: KernelInfo, k2: KernelInfo) -> Tuple[str, float]:
        """Determine the best fusion type and estimated benefit"""
        # Check for vertical fusion (producer-consumer)
        if set(k1.outputs) & set(k2.inputs):
            # Benefit from eliminating intermediate memory transfers
            benefit = 0.3 + (len(set(k1.outputs) & set(k2.inputs)) * 0.1)
            return 'vertical_fusion', min(benefit, 0.8)
        
        # Check for horizontal fusion (independent operations)
        elif not (set(k1.outputs) & set(k2.outputs)):
            # Benefit from kernel launch overhead reduction
            benefit = 0.2
            return 'horizontal_fusion', benefit
        
        # Check for reduction fusion
        elif 'reduction' in k1.code or 'reduction' in k2.code:
            benefit = 0.4
            return 'reduction_fusion', benefit
        
        # Default to nested fusion for complex patterns
        else:
            benefit = 0.15
            return 'nested_fusion', benefit
    
    def generate_fused_kernel(self, candidate: FusionCandidate) -> FusedKernel:
        """Generate fused kernel from candidate pair"""
        template = self.fusion_templates.get(candidate.fusion_type, 
                                           self.fusion_templates['vertical_fusion'])
        
        # Create fused kernel name
        fused_name = f"{candidate.kernel1.name}_{candidate.kernel2.name}_fused"
        
        # Merge parameters
        all_params = self._merge_parameters(candidate.kernel1, candidate.kernel2)
        
        # Extract kernel bodies
        body1 = self._extract_kernel_body(candidate.kernel1.code)
        body2 = self._extract_kernel_body(candidate.kernel2.code)
        
        # Apply optimizations based on fusion type
        if candidate.fusion_type == 'vertical_fusion':
            # Optimize for data reuse
            fused_code = self._optimize_vertical_fusion(
                template, fused_name, all_params, body1, body2, 
                candidate.shared_data
            )
        elif candidate.fusion_type == 'horizontal_fusion':
            # Optimize for parallel execution
            fused_code = self._optimize_horizontal_fusion(
                template, fused_name, all_params, body1, body2
            )
        else:
            # Generic fusion
            fused_code = template.format(
                fused_name=fused_name,
                parameters=all_params,
                kernel1_body=body1,
                kernel2_body=body2,
                data_size='n'  # Placeholder
            )
        
        # Estimate performance gain
        memory_savings = len(candidate.shared_data) * 0.15  # 15% per eliminated transfer
        launch_overhead_savings = 0.1  # 10% from reduced kernel launches
        performance_gain = candidate.fusion_benefit
        
        return FusedKernel(
            name=fused_name,
            code=fused_code,
            original_kernels=[candidate.kernel1.name, candidate.kernel2.name],
            performance_gain=performance_gain,
            memory_savings=memory_savings
        )
    
    def _merge_parameters(self, k1: KernelInfo, k2: KernelInfo) -> str:
        """Merge parameters from two kernels, eliminating duplicates"""
        # Extract full parameter declarations
        params1 = self._extract_parameters(k1.code)
        params2 = self._extract_parameters(k2.code)
        
        # Merge, keeping unique parameters
        all_params = params1.copy()
        param_names = {p.split()[-1]: p for p in params1}
        
        for param in params2:
            param_name = param.split()[-1]
            if param_name not in param_names:
                all_params.append(param)
        
        return ', '.join(all_params)
    
    def _extract_parameters(self, kernel_code: str) -> List[str]:
        """Extract parameter list from kernel signature"""
        param_match = re.search(r'__global__\s+void\s+\w+\s*\((.*?)\)', 
                               kernel_code, re.DOTALL)
        if param_match:
            params = param_match.group(1).split(',')
            return [p.strip() for p in params]
        return []
    
    def _extract_kernel_body(self, kernel_code: str) -> str:
        """Extract kernel body without signature"""
        # Find the opening brace after kernel signature
        match = re.search(r'__global__\s+void\s+\w+\s*\(.*?\)\s*{(.*)}', 
                         kernel_code, re.DOTALL)
        if match:
            body = match.group(1).strip()
            # Remove thread index calculations (will be in template)
            body = re.sub(r'int\s+\w+\s*=\s*blockIdx.*?;', '', body)
            body = re.sub(r'int\s+\w+\s*=\s*threadIdx.*?;', '', body)
            return body
        return ""
    
    def _optimize_vertical_fusion(self, template: str, fused_name: str,
                                parameters: str, body1: str, body2: str,
                                shared_data: List[str]) -> str:
        """Optimize vertical fusion by eliminating intermediate stores"""
        # Identify intermediate calculations
        intermediate_calc = f"{shared_data[0]}_temp" if shared_data else "intermediate"
        
        # Modify body1 to store result in register instead of global memory
        optimized_body1 = body1
        for var in shared_data:
            # Replace global writes with register assignments
            optimized_body1 = re.sub(f'{var}\[.*?\]\s*=', f'float {intermediate_calc} =', 
                                   optimized_body1)
        
        # Modify body2 to use register instead of global reads
        optimized_body2 = body2
        for var in shared_data:
            # Replace global reads with register access
            optimized_body2 = re.sub(f'{var}\[.*?\]', intermediate_calc, optimized_body2)
        
        return template.format(
            fused_name=fused_name,
            parameters=parameters,
            data_size='n',
            kernel1_body=optimized_body1,
            kernel2_body=optimized_body2,
            intermediate_calc=intermediate_calc
        )
    
    def _optimize_horizontal_fusion(self, template: str, fused_name: str,
                                  parameters: str, body1: str, body2: str) -> str:
        """Optimize horizontal fusion for independent operations"""
        return template.format(
            fused_name=fused_name,
            parameters=parameters,
            data_size='max(n1, n2)',
            stream1_size='n1',
            stream2_size='n2',
            kernel1_body=body1,
            kernel2_body=body2
        )
    
    def visualize_fusion_opportunities(self, candidates: List[FusionCandidate],
                                     output_path: str):
        """Visualize kernel fusion opportunities"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
        
        # Dependency graph
        if self.kernel_graph.nodes():
            pos = nx.spring_layout(self.kernel_graph)
            nx.draw(self.kernel_graph, pos, ax=ax1, with_labels=True, 
                   node_color='lightblue', node_size=2000, font_size=10,
                   edge_color='gray', arrows=True)
            ax1.set_title('Kernel Dependency Graph')
        
        # Fusion benefit analysis
        if candidates:
            names = [f"{c.kernel1.name}\n+\n{c.kernel2.name}" for c in candidates[:10]]
            benefits = [c.fusion_benefit for c in candidates[:10]]
            types = [c.fusion_type for c in candidates[:10]]
            
            # Color by fusion type
            colors = {'vertical_fusion': 'green', 'horizontal_fusion': 'blue',
                     'nested_fusion': 'orange', 'reduction_fusion': 'red'}
            bar_colors = [colors.get(t, 'gray') for t in types]
            
            bars = ax2.bar(range(len(names)), benefits, color=bar_colors)
            ax2.set_xticks(range(len(names)))
            ax2.set_xticklabels(names, rotation=45, ha='right')
            ax2.set_ylabel('Fusion Benefit')
            ax2.set_title('Top Kernel Fusion Opportunities')
            ax2.set_ylim(0, 1.0)
            
            # Add value labels
            for bar, benefit in zip(bars, benefits):
                height = bar.get_height()
                ax2.text(bar.get_x() + bar.get_width()/2., height + 0.01,
                        f'{benefit:.1%}', ha='center', va='bottom')
        
        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
    
    def generate_fusion_report(self, candidates: List[FusionCandidate],
                             fused_kernels: List[FusedKernel]) -> str:
        """Generate comprehensive fusion optimization report"""
        report = ["Kernel Fusion Optimization Report", "=" * 50, ""]
        
        # Summary
        report.append(f"Total Fusion Candidates: {len(candidates)}")
        report.append(f"Kernels Fused: {len(fused_kernels)}")
        
        if fused_kernels:
            avg_gain = sum(k.performance_gain for k in fused_kernels) / len(fused_kernels)
            avg_memory = sum(k.memory_savings for k in fused_kernels) / len(fused_kernels)
            report.append(f"Average Performance Gain: {avg_gain:.1%}")
            report.append(f"Average Memory Savings: {avg_memory:.1%}")
        
        report.append("")
        
        # Fusion type distribution
        report.append("Fusion Type Distribution:")
        type_counts = {}
        for c in candidates:
            type_counts[c.fusion_type] = type_counts.get(c.fusion_type, 0) + 1
        
        for fusion_type, count in type_counts.items():
            report.append(f"  {fusion_type}: {count}")
        
        report.append("")
        
        # Top fusion opportunities
        report.append("Top Fusion Opportunities:")
        for i, candidate in enumerate(candidates[:5]):
            report.append(f"\n{i+1}. {candidate.kernel1.name} + {candidate.kernel2.name}")
            report.append(f"   Type: {candidate.fusion_type}")
            report.append(f"   Benefit: {candidate.fusion_benefit:.1%}")
            report.append(f"   Shared Data: {', '.join(candidate.shared_data)}")
        
        # Generated fused kernels
        if fused_kernels:
            report.append("\nGenerated Fused Kernels:")
            for kernel in fused_kernels:
                report.append(f"\n- {kernel.name}")
                report.append(f"  Original: {' + '.join(kernel.original_kernels)}")
                report.append(f"  Performance Gain: {kernel.performance_gain:.1%}")
                report.append(f"  Memory Savings: {kernel.memory_savings:.1%}")
        
        # Optimization strategies
        report.append("\nRecommended Optimization Strategies:")
        report.append("1. Prioritize vertical fusion for producer-consumer patterns")
        report.append("2. Apply horizontal fusion for independent kernel streams")
        report.append("3. Consider nested fusion for matrix operations")
        report.append("4. Validate resource usage after fusion")
        report.append("5. Profile fused kernels to verify performance gains")
        
        return "\n".join(report)


# Test kernel fusion
if __name__ == "__main__":
    optimizer = KernelFusionOptimizer()
    
    # Example kernels
    test_kernels = [
        '''__global__ void compute_squares(float* input, float* output, int n) {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < n) {
                output[idx] = input[idx] * input[idx];
            }
        }''',
        
        '''__global__ void add_constant(float* data, float constant, int n) {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < n) {
                data[idx] = data[idx] + constant;
            }
        }''',
        
        '''__global__ void scale_values(float* input, float* output, float scale, int n) {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < n) {
                output[idx] = input[idx] * scale;
            }
        }'''
    ]
    
    # Analyze kernels
    kernel_infos = [optimizer.analyze_kernel(k) for k in test_kernels]
    
    # Find fusion candidates
    candidates = optimizer.identify_fusion_candidates(kernel_infos)
    
    # Generate fused kernels
    fused_kernels = []
    for candidate in candidates[:3]:  # Top 3 candidates
        fused = optimizer.generate_fused_kernel(candidate)
        fused_kernels.append(fused)
        print(f"\nFused kernel: {fused.name}")
        print(fused.code)
    
    # Generate report
    report = optimizer.generate_fusion_report(candidates, fused_kernels)
    print("\n" + report)
    
    # Visualize
    optimizer.visualize_fusion_opportunities(candidates,
        "/workspaces/vibecast/interplanetary-comms/gpu/optimization/fusion_opportunities.png")
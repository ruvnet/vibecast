# Coordination Modes for Swarm Operations

## Centralized Mode
**Best for**: Simple tasks, controlled operations, safety-critical maintenance

### Characteristics
- Single coordinator manages all agents
- Sequential task assignment and monitoring
- Centralized decision making and error handling
- Clear hierarchy and command structure

### Batch Tool Usage
- TodoWrite creates master task list
- Coordinator assigns tasks to agents sequentially
- Memory stores central state and decisions
- All agents report back to central coordinator

### Use Cases
- System maintenance and updates
- Critical production deployments
- Security-sensitive operations
- Small-scale, well-defined tasks

## Distributed Mode
**Best for**: Complex, parallelizable tasks, research, large-scale analysis

### Characteristics
- Multiple coordinators manage agent groups
- Parallel task execution across coordinators
- Distributed decision making with coordination
- Fault tolerance through redundancy

### Batch Tool Usage
- TodoWrite creates distributed task segments
- Multiple Task launches for parallel agent groups
- Memory enables inter-coordinator communication
- Shared state through distributed memory

### Use Cases
- Large-scale research projects
- Distributed data analysis
- Multi-domain problem solving
- High-throughput operations

## Hierarchical Mode
**Best for**: Structured development, organized workflows, complex projects

### Characteristics
- Tree-like organization with team leads
- Clear reporting structure and delegation
- Specialized teams for different components
- Organized communication channels

### Batch Tool Usage
- TodoWrite creates hierarchical task breakdown
- Task creates team leads, then team members
- Memory maintains hierarchy and team boundaries
- Structured reporting up the hierarchy

### Use Cases
- Software development projects
- Structured analysis workflows
- Large team coordination
- Multi-phase project execution

## Mesh Mode
**Best for**: Dynamic tasks, peer-to-peer collaboration, adaptive workflows

### Characteristics
- Peer-to-peer agent communication
- Self-organizing task distribution
- Dynamic adaptation to changing requirements
- Emergent coordination patterns

### Batch Tool Usage
- TodoWrite creates shared task pool
- Agents claim tasks dynamically from pool
- Memory enables peer discovery and communication
- Adaptive coordination through shared state

### Use Cases
- Dynamic problem solving
- Adaptive testing strategies
- Exploratory research
- Flexible workflow execution

## Hybrid Mode
**Best for**: Complex workflows, adaptive requirements, multi-phase operations

### Characteristics
- Combines multiple coordination patterns
- Adaptive mode switching based on task phase
- Flexible coordination based on requirements
- Optimal efficiency for complex operations

### Batch Tool Usage
- TodoWrite creates phase-based coordination plan
- Task adapts agent launching based on current phase
- Memory tracks coordination mode changes
- Dynamic coordination pattern selection

### Use Cases
- Complex multi-phase projects
- Adaptive optimization workflows
- Large-scale system migrations
- Research and development projects

## Choosing the Right Mode

### Simple Tasks → Centralized
- Single objective, clear requirements
- Safety and control are priorities
- Small team or simple workflow

### Complex Tasks → Distributed/Hierarchical
- Multiple objectives or domains
- Parallel execution beneficial
- Large team or complex workflow

### Dynamic Tasks → Mesh/Hybrid
- Changing requirements
- Adaptive coordination needed
- Emergent or exploratory work

### Multi-Phase Tasks → Hybrid
- Different phases need different coordination
- Changing complexity over time
- Need for adaptive optimization

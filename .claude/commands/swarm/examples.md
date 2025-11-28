# Claude-Flow Swarm Examples with Batch Tools

## Quick Start Commands with Batch Operations

### Research Tasks with Parallel Execution
```bash
# Distributed research with parallel agents
claude-flow swarm "Research modern web frameworks" --strategy research --mode distributed --parallel --max-agents 6

# Market analysis with coordinated batch operations
claude-flow swarm "Analyze AI market trends" --strategy research --parallel --monitor --timeout 120
```

### Development Tasks with Batch Coordination
```bash
# Hierarchical development with batch file operations
claude-flow swarm "Build microservice API" --strategy development --mode hierarchical --parallel --max-agents 8

# React dashboard with coordinated component development
claude-flow swarm "Create React dashboard" --strategy development --parallel --monitor --output sqlite
```

### Analysis Tasks with Batch Processing
```bash
# Mesh-coordinated data analysis
claude-flow swarm "Analyze user behavior data" --strategy analysis --mode mesh --parallel --max-agents 10

# Performance analysis with monitoring
claude-flow swarm "Performance analysis of application" --strategy analysis --monitor --output csv
```

### Testing Tasks with Parallel Validation
```bash
# Comprehensive parallel testing
claude-flow swarm "Comprehensive testing suite" --strategy testing --parallel --max-agents 12

# Security testing with distributed coordination
claude-flow swarm "Security testing analysis" --strategy testing --mode distributed --monitor
```

### Optimization Tasks with Hybrid Coordination
```bash
# Database optimization with hybrid approach
claude-flow swarm "Optimize database queries" --strategy optimization --mode hybrid --parallel

# Frontend optimization with batch processing
claude-flow swarm "Frontend performance optimization" --strategy optimization --monitor --max-agents 6
```

### Maintenance Tasks with Centralized Control
```bash
# Dependency updates with centralized coordination
claude-flow swarm "Update dependencies safely" --strategy maintenance --mode centralized --monitor

# System health checks with batch operations
claude-flow swarm "System health check" --strategy maintenance --parallel --output json
```

See individual strategy files for detailed documentation and best practices.

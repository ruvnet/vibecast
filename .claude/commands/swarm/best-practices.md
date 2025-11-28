# Swarm Operation Best Practices

## Task Planning and Coordination

### Use TodoWrite Effectively
- Create comprehensive task breakdowns before starting
- Assign priorities based on dependencies and importance
- Include rollback and error handling tasks
- Update task status in real-time for progress tracking

### Optimize Agent Coordination
- Use appropriate coordination mode for task complexity
- Balance agent count with task complexity
- Enable monitoring for long-running operations
- Set realistic timeouts based on task scope

## Batch Tool Optimization

### Parallel Execution
- Identify independent tasks for parallel execution
- Use batch file operations for I/O-intensive tasks
- Coordinate through Memory for shared state
- Avoid sequential dependencies where possible

### Memory Management
- Store intermediate results for agent coordination
- Use descriptive keys for easy retrieval
- Clean up memory after task completion
- Share patterns and insights across agents

### Error Handling
- Plan rollback strategies in advance
- Use TodoWrite to track error recovery tasks
- Store error states in Memory for debugging
- Implement graceful degradation for partial failures

## Performance Optimization

### Resource Management
- Monitor system resources during execution
- Adjust agent count based on available resources
- Use appropriate output formats for efficiency
- Implement resource pooling for repeated operations

### Scaling Strategies
- Start with fewer agents and scale up as needed
- Use distributed mode for large-scale operations
- Implement load balancing across agents
- Monitor performance metrics in real-time

## Monitoring and Debugging

### Real-Time Monitoring
- Use --monitor flag for long-running operations
- Track progress through TodoRead checks
- Monitor resource usage and performance
- Set up alerts for critical failures

### Output Management
- Choose appropriate output formats for use case
- Use structured formats (JSON, SQLite) for analysis
- Generate human-readable reports for stakeholders
- Implement proper logging and audit trails

## Security and Safety

### Safe Operations
- Implement proper validation and verification
- Use centralized mode for safety-critical operations
- Plan and test rollback procedures
- Implement proper authentication and authorization

### Data Protection
- Secure sensitive data in Memory storage
- Implement proper access controls
- Use encryption for sensitive operations
- Follow data retention and cleanup policies

## Common Patterns

### Research and Analysis
1. TodoWrite creates research plan
2. Task launches parallel research agents
3. Memory stores and cross-references findings
4. Batch operations generate comprehensive reports

### Development and Implementation
1. TodoWrite creates development roadmap
2. Hierarchical coordination for organized development
3. Parallel implementation with Memory coordination
4. Integrated testing and validation

### Testing and Validation
1. TodoWrite creates comprehensive test matrix
2. Mesh coordination for distributed testing
3. Parallel test execution across environments
4. Memory aggregates results and identifies patterns

### Optimization and Performance
1. TodoWrite defines optimization strategy
2. Hybrid coordination adapts to optimization phases
3. Parallel profiling and optimization implementation
4. Memory tracks performance improvements

## Troubleshooting

### Common Issues
- Agent coordination failures: Check Memory state and connectivity
- Performance bottlenecks: Reduce agent count or adjust coordination mode
- Task failures: Review TodoWrite breakdown and dependencies
- Resource exhaustion: Monitor system resources and scale appropriately

### Debugging Strategies
- Use dry-run mode to validate configuration
- Enable detailed monitoring and logging
- Check Memory state for coordination issues
- Review task dependencies and sequencing

### Recovery Procedures
- Implement proper error handling in TodoWrite tasks
- Use Memory to store recovery state
- Plan rollback procedures for critical operations
- Test recovery procedures in safe environments

# Development Swarm Command

## Usage
```bash
claude-flow swarm "Build application" --strategy development --mode hierarchical --parallel
```

## Description
Coordinated software development with specialized agents using batch operations.

## Strategy Features
- **Architecture Design**: System planning and component specification
- **Parallel Implementation**: Multiple agents work on different modules
- **Code Integration**: Coordinated merge and integration processes
- **Testing & Validation**: Automated testing across all components

## Batch Tool Integration
- **TodoWrite**: Creates development phases and component breakdown
- **Task Tool**: Launches specialized development agents (frontend, backend, database)
- **Read/Write/Edit**: Batch file operations for coordinated code generation
- **Bash Tool**: Automated build, test, and deployment operations
- **Memory Tool**: Shares architecture decisions and component interfaces

## Best Practices
- Use hierarchical mode for organized, structured development
- Enable parallel execution for independent modules/components
- Set higher agent count (`--max-agents 8+`) for large projects
- Monitor progress with `--monitor` for real-time updates
- Use `--output sqlite` for detailed development metrics

## Example Workflow
1. **Planning**: TodoWrite creates development roadmap
2. **Architecture**: Lead agent designs system architecture
3. **Implementation**: Task launches parallel development agents
4. **Integration**: Memory coordinates interface contracts
5. **Testing**: Batch testing across all components
6. **Deployment**: Automated deployment pipeline

## Coordination Patterns
- **Frontend Team**: React/Vue components, styling, UX
- **Backend Team**: APIs, services, business logic
- **Database Team**: Schema, queries, optimization
- **DevOps Team**: CI/CD, infrastructure, monitoring

# Research Swarm Command

## Usage
```bash
claude-flow swarm "Research objective" --strategy research --mode distributed --parallel
```

## Description
Multi-agent research coordination with distributed intelligence gathering using batch tools.

## Strategy Features
- **Parallel Web Search**: Multiple agents search different sources simultaneously
- **Source Credibility Analysis**: Automated fact-checking and source validation
- **Knowledge Synthesis**: AI agents combine findings from multiple sources
- **Report Generation**: Structured output with citations and references

## Batch Tool Integration
- **TodoWrite**: Creates research task breakdown (sources, topics, validation)
- **Task Tool**: Launches parallel research agents for different domains
- **Memory Tool**: Stores findings for cross-agent knowledge sharing
- **WebSearch/WebFetch**: Batch web operations for comprehensive coverage

## Best Practices
- Use distributed mode for complex, multi-domain research
- Enable parallel execution with `--parallel` for faster results
- Set appropriate timeout with `--timeout` for comprehensive research
- Use `--monitor` for real-time progress tracking
- Increase agent count with `--max-agents` for broad topics

## Example Workflow
1. **Initialize**: TodoWrite creates research plan with subtopics
2. **Search**: Task launches agents for parallel domain research
3. **Validate**: Cross-reference findings using Memory coordination
4. **Synthesize**: Combine results into comprehensive report
5. **Output**: Generate formatted report with citations

## Output Formats
- `--output json`: Structured data with metadata
- `--output sqlite`: Queryable database format
- `--output html`: Human-readable report with links

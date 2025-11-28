# Analysis Swarm Command

## Usage
```bash
claude-flow swarm "Analyze data" --strategy analysis --parallel --max-agents 10
```

## Description
Data analysis and insights generation with coordinated batch processing.

## Strategy Features
- **Data Collection**: Automated data gathering from multiple sources
- **Statistical Analysis**: Parallel statistical computations
- **Pattern Recognition**: AI-powered pattern and anomaly detection
- **Visualization**: Automated chart and dashboard generation

## Batch Tool Integration
- **TodoWrite**: Creates analysis phases (collection, processing, visualization)
- **Task Tool**: Launches specialized analysis agents for different data types
- **Read Tool**: Batch file reading for large datasets
- **Memory Tool**: Stores intermediate results and discovered patterns
- **Bash Tool**: Runs analysis scripts and data processing pipelines

## Best Practices
- Use mesh mode for peer-to-peer data sharing and validation
- Enable parallel execution for large datasets
- Increase agent count for complex, multi-dimensional analysis
- Use `--monitor` for long-running analysis tasks
- Choose appropriate output format (`json`, `csv`, `sqlite`)

## Example Workflow
1. **Data Collection**: TodoWrite defines data sources and collection strategy
2. **Preprocessing**: Task launches data cleaning and preparation agents
3. **Analysis**: Parallel statistical and ML analysis across data segments
4. **Pattern Discovery**: Memory coordinates pattern sharing between agents
5. **Visualization**: Generate charts, dashboards, and reports
6. **Insights**: Synthesize findings into actionable recommendations

## Analysis Types
- **Statistical Analysis**: Descriptive and inferential statistics
- **Time Series Analysis**: Trend analysis and forecasting
- **Machine Learning**: Classification, clustering, regression
- **Text Analysis**: NLP, sentiment analysis, topic modeling
- **Performance Analysis**: System metrics and optimization

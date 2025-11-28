# Reports Directory

This directory stores output reports from swarm operations and orchestration tasks.

## Structure
- Swarm reports are stored by operation ID
- Reports include execution logs, results, and metrics
- Multiple output formats supported (JSON, SQLite, CSV, HTML)

## Usage
Reports are generated automatically by swarm operations:
- View recent reports with `claude-flow swarm list`
- Check specific reports with `claude-flow swarm status <id>`
- Export reports in different formats using `--output` flags

## File Types
- `*.json`: Structured operation data
- `*.sqlite`: Database format for complex queries
- `*.csv`: Tabular data for analysis
- `*.html`: Human-readable reports

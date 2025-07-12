# SCC Usage Examples and Best Practices

## Installation and Setup

### Installing SCC as a Go Library

```go
// Import the SCC library
import "github.com/boyter/scc/v3/processor"

// Example: Using SCC programmatically in Go
package main

import (
    "fmt"
    "github.com/boyter/scc/v3/processor"
)

func main() {
    // Create a new processor instance
    proc := processor.New()
    
    // Configure options
    proc.DirectoryWalker = []string{"."}
    proc.ExcludeDir = []string{"node_modules", ".git"}
    
    // Run the analysis
    fileResults := proc.ProcessPaths()
    
    // Process results
    for _, result := range fileResults {
        fmt.Printf("File: %s, Lines: %d, Code: %d\n", 
            result.Filename, result.Lines, result.Code)
    }
}
```

## Command-Line Usage Examples

### Basic Analysis

```bash
# Simple analysis of current directory
scc .

# Analyze specific directory
scc /path/to/project

# Analyze with human-readable output
scc . --format wide
```

### Filtering and Exclusions

```bash
# Exclude specific directories
scc . --exclude-dir vendor,node_modules,dist

# Include only specific file extensions
scc . --include-ext go,rs,py

# Exclude file extensions
scc . --exclude-ext md,txt,json

# Use .gitignore patterns
scc . --gitignore
```

### Output Formats

```bash
# JSON output for programmatic processing
scc . --format json > stats.json

# CSV output for spreadsheet analysis
scc . --format csv > stats.csv

# HTML output for reports
scc . --format html > report.html

# Wide format with all metrics
scc . --format wide

# Summary only (no file details)
scc . --format summary
```

### Advanced Analysis

```bash
# Show files sorted by complexity
scc . --sort complexity

# Show files sorted by lines of code
scc . --sort code

# Get file-by-file breakdown
scc . --by-file

# Count duplicate files
scc . --dupe-detect

# Set custom size classifications
scc . --size-unit binary  # or si
```

## Practical Use Cases

### 1. Project Health Monitoring

```bash
#!/bin/bash
# Monitor code complexity growth

echo "Code Health Report for $(date)"
echo "================================"

# Overall statistics
scc . --format wide --exclude-dir node_modules

# High complexity files (potential refactoring targets)
echo -e "\n\nHigh Complexity Files:"
scc . --by-file --sort complexity --exclude-dir node_modules | head -20

# Large files
echo -e "\n\nLargest Files:"
scc . --by-file --sort lines --exclude-dir node_modules | head -20
```

### 2. Language Distribution Analysis

```bash
# Get language breakdown as JSON
scc . --format json | jq '.[] | {Name, Count, Lines, Code}'

# Compare two branches
git checkout main
scc . --format json > main.json
git checkout feature
scc . --format json > feature.json

# Use jq to compare
jq -s '.[0] as $main | .[1] as $feature | 
  ($feature | map({(.Name): .Lines}) | add) as $f |
  ($main | map({(.Name): .Lines}) | add) as $m |
  $f | to_entries | map({
    language: .key,
    feature: .value,
    main: ($m[.key] // 0),
    diff: (.value - ($m[.key] // 0))
  })' main.json feature.json
```

### 3. CI/CD Integration

```yaml
# GitHub Actions example
name: Code Analysis
on: [push, pull_request]

jobs:
  scc-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Install SCC
        run: go install github.com/boyter/scc/v3@latest
      
      - name: Run Analysis
        run: |
          scc . --format json > scc-report.json
          scc . --format wide
      
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: scc-report
          path: scc-report.json
      
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('scc-report.json', 'utf8'));
            
            let comment = '## Code Statistics\n\n';
            comment += '| Language | Files | Lines | Code | Comments |\n';
            comment += '|----------|-------|-------|------|----------|\n';
            
            report.forEach(lang => {
              comment += `| ${lang.Name} | ${lang.Count} | ${lang.Lines} | ${lang.Code} | ${lang.Comment} |\n`;
            });
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### 4. Documentation Coverage

```bash
#!/bin/bash
# Calculate documentation ratio

# Get code lines
CODE_LINES=$(scc . --format json --exclude-ext md,txt,rst | \
  jq '[.[] | .Code] | add')

# Get documentation lines
DOC_LINES=$(scc . --format json --include-ext md,txt,rst | \
  jq '[.[] | .Code] | add')

# Calculate ratio
RATIO=$(echo "scale=2; $DOC_LINES / $CODE_LINES * 100" | bc)

echo "Documentation Coverage: ${RATIO}%"
echo "Code Lines: $CODE_LINES"
echo "Documentation Lines: $DOC_LINES"
```

### 5. Team Performance Metrics

```bash
# Analyze code changes by author (requires git)
#!/bin/bash

echo "Code Contributions by Author"
echo "============================"

for author in $(git log --format='%ae' | sort -u); do
  echo -e "\n$author:"
  
  # Create temporary directory with author's files
  TMPDIR=$(mktemp -d)
  git log --author="$author" --name-only --pretty=format: | \
    sort -u | grep -v '^$' | \
    xargs -I {} cp --parents {} $TMPDIR 2>/dev/null || true
  
  # Analyze author's contributions
  scc $TMPDIR --format summary 2>/dev/null || echo "No files"
  
  rm -rf $TMPDIR
done
```

## Integration with Development Tools

### VS Code Task

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Code Statistics",
      "type": "shell",
      "command": "scc",
      "args": [
        ".",
        "--format", "wide",
        "--exclude-dir", "node_modules,dist"
      ],
      "group": {
        "kind": "test",
        "isDefault": false
      },
      "problemMatcher": []
    }
  ]
}
```

### Pre-commit Hook

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: scc-complexity-check
        name: Check Code Complexity
        entry: bash -c 'scc . --format json | jq -e "all(.[]; .Complexity < 100)"'
        language: system
        pass_filenames: false
```

### Makefile Integration

```makefile
.PHONY: stats
stats:
	@echo "=== Code Statistics ==="
	@scc . --exclude-dir vendor,node_modules

.PHONY: complexity
complexity:
	@echo "=== High Complexity Files ==="
	@scc . --by-file --sort complexity | head -20

.PHONY: report
report:
	@scc . --format html > code-report.html
	@echo "Report generated: code-report.html"
```

## Performance Optimization

### Large Repositories

```bash
# Use .sccignore file for better performance
echo "node_modules/" > .sccignore
echo "vendor/" >> .sccignore
echo "*.min.js" >> .sccignore

# Parallel processing (automatic, but can be tuned)
scc . --threads 8

# Disable features for speed
scc . --no-complexity --no-duplicates
```

### Memory Usage

```bash
# For very large repos, process in chunks
find . -type d -maxdepth 2 -mindepth 2 | \
  while read dir; do
    echo "Processing $dir"
    scc "$dir" --format json >> results.jsonl
  done
```

## Custom Scripts

### Language Trend Analysis

```python
#!/usr/bin/env python3
import subprocess
import json
import matplotlib.pyplot as plt
from datetime import datetime

def get_stats_for_commit(commit):
    subprocess.run(['git', 'checkout', commit], capture_output=True)
    result = subprocess.run(['scc', '.', '--format', 'json'], 
                          capture_output=True, text=True)
    return json.loads(result.stdout)

# Get commits from last 30 days
commits = subprocess.run(
    ['git', 'log', '--since=30.days', '--format=%H'],
    capture_output=True, text=True
).stdout.strip().split('\n')

# Analyze each commit
language_trends = {}
for commit in commits:
    stats = get_stats_for_commit(commit)
    for lang in stats:
        if lang['Name'] not in language_trends:
            language_trends[lang['Name']] = []
        language_trends[lang['Name']].append(lang['Code'])

# Plot trends
for language, trend in language_trends.items():
    plt.plot(trend, label=language)

plt.xlabel('Commits (newest to oldest)')
plt.ylabel('Lines of Code')
plt.title('Language Trends Over Last 30 Days')
plt.legend()
plt.show()
```

## Troubleshooting

### Common Issues

```bash
# Debug file detection
scc . --debug

# Verbose output
scc . --verbose

# Check which files are being processed
scc . --files

# Verify file type detection
scc . --languages
```

### Custom Language Definitions

```json
// Create .scc/languages.json
{
  "CustomLang": {
    "extensions": ["cst", "custom"],
    "line_comment": ["//"],
    "multi_line_comments": [["/*", "*/"]],
    "quotes": [["\"", "\""], ["'", "'"]],
    "complexity": ["if", "for", "while", "case"]
  }
}
```

Then use:
```bash
scc . --languages .scc/languages.json
```

## Conclusion

SCC is a powerful tool for code analysis that can be integrated into various parts of your development workflow. From simple command-line usage to complex CI/CD integrations, it provides valuable insights into your codebase's health and evolution.
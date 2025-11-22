# Swarm Scalability Benchmark Report

**Generated:** 2025-11-22T14:25:28.784Z

## System Information

- **Platform:** linux
- **CPUs:** 16 cores
- **Total Memory:** 13312 MB
- **Node.js:** v22.21.1

## Test Scenario

- **Name:** Scalability Test Scenario
- **Tasks:** 15
- **Complexity:** medium

## Results Summary

| Agents | Duration | Throughput | Max Concurrency | Utilization | Memory |
|--------|----------|------------|-----------------|-------------|--------|
| 2 | 1.54s | 9.74 t/s | 3 | 100.00% | 1.88 MB |
| 5 | 1.48s | 10.14 t/s | 6 | 100.00% | -0.41 MB |
| 10 | 1.63s | 9.23 t/s | 11 | 100.00% | 7.04 MB |
| 15 | 1.75s | 8.55 t/s | 15 | 93.75% | 7.36 MB |
| 20 | 1.76s | 8.54 t/s | 15 | 71.43% | 1.27 MB |
| 25 | 1.76s | 8.52 t/s | 15 | 57.69% | -17.05 MB |
| 30 | 1.76s | 8.54 t/s | 15 | 48.39% | 10.09 MB |
| 40 | 1.76s | 8.54 t/s | 15 | 36.59% | 2.42 MB |
| 50 | 1.76s | 8.54 t/s | 15 | 29.41% | 2.91 MB |

## Optimal Configurations

### Fastest Execution

- **Agents:** 5
- **Duration:** 1.48s
- **Throughput:** 10.14 tasks/sec

### Efficiency Sweet Spot

- **Agents:** 2
- **Efficiency Score:** 1.7270
- **Utilization:** 100.00%
- **Memory:** 1.88 MB

## Recommendations

### Optimal Configuration for Maximum Speed

**Priority:** HIGH

Provides fastest execution time at 1.48s

### Efficiency Sweet Spot

**Priority:** HIGH

Best balance of speed, resource usage, and agent utilization at 100.00%

### Diminishing Returns Threshold

**Priority:** MEDIUM

Adding more agents beyond 2 shows diminishing returns

### Performance Bottleneck Detected

**Priority:** HIGH

Performance degrades with 10+ agents

### Recommended for Most Use Cases

**Priority:** MEDIUM

Provides excellent performance with reasonable resource usage


# Anomaly Detector Documentation

This directory contains documentation for the Anomaly Detection System.

## Contents

- **API Documentation**: REST API endpoint specifications
- **Architecture**: System design and component overview
- **Deployment**: Deployment guides and configurations
- **Development**: Development setup and contribution guidelines
- **User Guide**: End-user documentation for CLI and API usage

## Quick Start

See the main project [README](../README.md) for quick start instructions.

## API Documentation

The system provides a RESTful API for text anomaly detection:

### Endpoints

- `POST /api/v1/analyze` - Analyze text for anomalies
- `GET /api/v1/health` - Health check endpoint
- `GET /api/v1/metrics` - System metrics

### Example Usage

```bash
curl -X POST http://localhost:8080/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Your text to analyze here"}'
```

## CLI Usage

```bash
# Analyze a file
./anomaly-detector-cli analyze path/to/file.txt

# Analyze text directly
echo "Your text here" | ./anomaly-detector-cli analyze -
```

## Architecture Overview

The system consists of:

1. **API Server** (`cmd/api`) - HTTP REST API
2. **Worker** (`cmd/worker`) - Background processing
3. **CLI** (`cmd/cli`) - Command-line interface
4. **Core Engine** (`internal/core`) - Main detection logic
5. **Analyzers** (`internal/analyzers`) - Individual detection algorithms
6. **Storage** (`internal/storage`) - Data persistence
7. **Queue** (`internal/queue`) - Message queue handling

## Analysis Methods

The system uses multiple analysis techniques:

- **Entropy Analysis** - Text randomness and predictability patterns
- **Compression Analysis** - Compressibility patterns in text
- **Linguistic Analysis** - Language structure and patterns
- **Embedding Analysis** - Semantic similarity patterns
- **Cryptographic Analysis** - Statistical randomness tests
- **Cross-Model Analysis** - Consensus across multiple models

## Deployment

See the deployment directory for:
- Docker configurations
- Kubernetes manifests
- Environment-specific configs

## Contributing

Please read the development documentation before contributing to the project.
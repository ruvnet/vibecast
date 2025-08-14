# Anomaly Detection System

A high-performance, Go-based anomaly detection system with machine learning capabilities, cryptographic security, and real-time processing.

## Features

- **Real-time Anomaly Detection**: Process streaming data with low latency
- **Machine Learning Integration**: Support for multiple ML models and ensemble methods
- **Cryptographic Security**: Secure data processing and model protection
- **RESTful API**: Comprehensive API for detection, training, and management
- **WebSocket Support**: Real-time updates and streaming
- **Scalable Architecture**: Designed for high throughput and horizontal scaling
- **Comprehensive Monitoring**: Built-in metrics and health checks

## Quick Start

### Prerequisites

- Go 1.21 or higher
- PostgreSQL 12+ (for persistent storage)
- Redis 6+ (for caching and real-time features)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/vibecast/anomaly-detector.git
cd anomaly-detector
```

2. Install dependencies:
```bash
make deps
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
make migrate-up
```

5. Build and run:
```bash
make build
make run
```

## Development

### Project Structure

```
├── cmd/                    # Application entrypoints
│   └── api/               # API server
├── internal/              # Private application code
│   ├── config/           # Configuration management
│   ├── handlers/         # HTTP handlers
│   ├── middleware/       # HTTP middleware
│   ├── storage/          # Data persistence layer
│   └── auth/             # Authentication & authorization
├── pkg/                   # Public libraries
│   ├── detector/         # Core anomaly detection engine
│   ├── models/           # Data models and types
│   ├── utils/            # Utility functions
│   ├── metrics/          # Metrics collection
│   └── crypto/           # Cryptographic functions
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── deployments/           # Deployment configurations
│   ├── docker/           # Docker configurations
│   ├── k8s/              # Kubernetes manifests
│   └── terraform/        # Infrastructure as code
├── docs/                  # Documentation
├── scripts/               # Build and utility scripts
└── benchmarks/            # Performance benchmarks
```

### Available Commands

```bash
# Development
make dev                   # Run in development mode
make build                 # Build the application
make test                  # Run all tests
make test-unit            # Run unit tests
make test-integration     # Run integration tests
make benchmark            # Run performance benchmarks

# Code Quality
make fmt                  # Format code
make vet                  # Vet code
make lint                 # Lint code
make security            # Security scan

# Deployment
make docker-build        # Build Docker image
make docker-run          # Run Docker container
make k8s-deploy          # Deploy to Kubernetes
```

## API Documentation

The API provides endpoints for:

- **Anomaly Detection**: `/api/v1/detect` - Detect anomalies in data
- **Model Management**: `/api/v1/models` - Train and manage ML models
- **Data Management**: `/api/v1/anomalies` - CRUD operations for anomalies
- **Metrics**: `/api/v1/metrics` - System and model metrics
- **Health**: `/api/v1/health` - Health checks

For detailed API documentation, see [API Documentation](docs/api/README.md).

## Configuration

The system can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | HTTP server port | `8080` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `REDIS_HOST` | Redis host | `localhost` |
| `DETECTOR_THRESHOLD` | Anomaly detection threshold | `0.8` |
| `DETECTOR_ENABLE_ML` | Enable ML detection | `true` |

See [Configuration Guide](docs/configuration.md) for full configuration options.

## Architecture

The system uses a modular architecture with clear separation of concerns:

- **Detector Package**: Core anomaly detection algorithms
- **Models Package**: Data models and business logic
- **Internal Packages**: Application-specific implementations
- **Storage Layer**: Abstracted data persistence
- **API Layer**: HTTP handlers and middleware

For detailed architecture documentation, see [Architecture Guide](docs/architecture.md).

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run tests: `make test`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/vibecast/anomaly-detector/issues)
- Discussions: [GitHub Discussions](https://github.com/vibecast/anomaly-detector/discussions)

---

## vibecast
Weekly Vibecast Live coding sessions with rUv. Check branches for each week. 

# VibeCast API Test Suite

This directory contains comprehensive integration tests for the VibeCast API.

## Test Structure

```
tests/
├── integration/
│   └── api_test.go          # Comprehensive API integration tests
└── README.md               # This file
```

## Running Tests

### Prerequisites

1. Make sure you have Go modules initialized
2. Install test dependencies:
   ```bash
   go mod tidy
   ```

### Run All Integration Tests

```bash
# From the project root
go test ./tests/integration -v

# Or from the tests directory
cd tests
go test ./integration -v
```

### Run Specific Test Suites

```bash
# Run only health endpoint tests
go test ./tests/integration -v -run TestAPITestSuite/TestHealthEndpoints

# Run authentication tests
go test ./tests/integration -v -run TestAPITestSuite/TestAuthenticationEndpoints

# Run anomaly detection tests
go test ./tests/integration -v -run TestAPITestSuite/TestAnomalyDetectionEndpoints
```

### Run Performance Benchmarks

```bash
# Run all benchmarks
go test ./tests/integration -bench=.

# Run specific benchmark
go test ./tests/integration -bench=BenchmarkHealthEndpoint

# Run benchmarks with memory allocation stats
go test ./tests/integration -bench=. -benchmem
```

## Test Coverage

### API Endpoints Tested

#### Health Endpoints
- `GET /api/v1/health` - Main health check
- `GET /api/v1/health/ready` - Readiness probe
- `GET /api/v1/health/live` - Liveness probe

#### Authentication Endpoints
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh
- `POST /api/v1/auth/logout` - User logout

#### User Management Endpoints
- `GET /api/v1/users/me` - Get current user
- `PUT /api/v1/users/me` - Update current user
- `POST /api/v1/users/me/change-password` - Change password

#### Anomaly Detection Endpoints
- `POST /api/v1/anomaly/detect` - Detect anomalies
- `POST /api/v1/anomaly/analyze/text` - Analyze text
- `POST /api/v1/anomaly/analyze/batch` - Batch text analysis
- `GET /api/v1/anomaly/history` - Anomaly history

#### Admin Endpoints
- `GET /api/v1/admin/system` - System information
- `GET /api/v1/admin/metrics` - System metrics
- `POST /api/v1/admin/system/action` - Execute system actions
- `GET /api/v1/admin/logs` - System logs

#### WebSocket Endpoints
- `WS /ws` - Real-time WebSocket connection

### Features Tested

#### Authentication & Authorization
- JWT token validation
- Role-based access control (admin vs user)
- Token refresh mechanism
- Authentication required endpoints

#### Rate Limiting
- Request rate limiting
- Rate limit header validation
- Rate limit threshold enforcement

#### Input Validation
- Request payload validation
- Field-specific validation rules
- Error response format validation

#### Error Handling
- HTTP error status codes
- Error response structure
- Malformed request handling
- Invalid authentication handling

#### WebSocket Communication
- Connection establishment with authentication
- Message subscription
- Real-time message handling

#### API Gateway
- Service registration
- Health checking
- Load balancing
- Service discovery

#### Performance
- Response time validation
- Concurrent request handling
- Load testing capabilities

#### Security
- Security header validation
- CORS handling
- Authentication enforcement

#### Data Consistency
- Consistent responses across endpoints
- Data integrity validation

## Test Configuration

### Environment Variables

The tests use the following configuration:

- JWT Secret: `test-jwt-secret-key`
- Rate Limit: 1000 requests per minute
- Test Timeout: 2 minutes per test
- WebSocket Timeout: 5 seconds

### Mock Data

Tests use mock JWT tokens:
- Admin user: `admin-user-id` with role `admin`
- Regular user: `regular-user-id` with role `user`

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```bash
# CI-friendly test run with coverage
go test ./tests/integration -v -race -coverprofile=coverage.out

# Generate coverage report
go tool cover -html=coverage.out -o coverage.html
```

## Test Development Guidelines

### Adding New Tests

1. Follow the existing test suite structure
2. Use the `APITestSuite` struct for integration tests
3. Use the `makeRequest` helper for HTTP requests
4. Include both positive and negative test cases
5. Test authentication and authorization where applicable

### Test Naming Convention

- Test functions: `TestFeatureName`
- Benchmark functions: `BenchmarkFeatureName`
- Helper functions: `helperFunctionName`

### Test Data

- Use realistic test data
- Include edge cases
- Test boundary conditions
- Validate error scenarios

## Troubleshooting

### Common Issues

1. **Import errors**: Ensure all dependencies are installed with `go mod tidy`
2. **Port conflicts**: Tests use `httptest.Server` which allocates random ports
3. **WebSocket failures**: WebSocket tests are skipped if connection fails
4. **Rate limiting**: Tests may fail if external rate limiting is applied

### Debug Mode

Enable detailed logging by setting the test logger to debug level:

```bash
go test ./tests/integration -v -args -debug
```

## Contributing

When adding new API endpoints:

1. Add corresponding tests to the integration suite
2. Include authentication tests if applicable
3. Test rate limiting if enabled
4. Add performance benchmarks for critical endpoints
5. Update this README with new test coverage
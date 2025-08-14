.PHONY: build test run docker clean lint fmt vet

# Variables
BINARY_NAME=anomaly-detector
DOCKER_IMAGE=vibecast/anomaly-detector
VERSION=$(shell git describe --tags --always --dirty)
GO_FILES=$(shell find . -type f -name '*.go' -not -path "./vendor/*")

# Build the binary
build:
	@echo "Building $(BINARY_NAME)..."
	@go build -ldflags "-X main.Version=$(VERSION)" -o bin/$(BINARY_NAME) cmd/api/main.go

# Run tests
test:
	@echo "Running tests..."
	@go test -v -race -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html

# Run unit tests only
test-unit:
	@echo "Running unit tests..."
	@go test -v -short ./...

# Run integration tests
test-integration:
	@echo "Running integration tests..."
	@go test -v -tags=integration ./tests/integration/...

# Run E2E tests
test-e2e:
	@echo "Running E2E tests..."
	@go test -v ./tests/e2e/...

# Run benchmarks
bench:
	@echo "Running benchmarks..."
	@go test -bench=. -benchmem ./benchmarks/...

# Run the application
run:
	@echo "Running $(BINARY_NAME)..."
	@go run cmd/api/main.go

# Build Docker image
docker:
	@echo "Building Docker image..."
	@docker build -t $(DOCKER_IMAGE):$(VERSION) .
	@docker tag $(DOCKER_IMAGE):$(VERSION) $(DOCKER_IMAGE):latest

# Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf bin/ coverage.out coverage.html

# Format code
fmt:
	@echo "Formatting code..."
	@gofmt -s -w $(GO_FILES)
	@goimports -w $(GO_FILES)

# Lint code
lint:
	@echo "Linting code..."
	@golangci-lint run

# Run go vet
vet:
	@echo "Running go vet..."
	@go vet ./...

# Install dependencies
deps:
	@echo "Installing dependencies..."
	@go mod download
	@go mod tidy

# Generate mocks
mocks:
	@echo "Generating mocks..."
	@go generate ./...

# Run all checks
check: fmt vet lint test

# Run development server with hot reload
dev:
	@echo "Starting development server..."
	@air -c .air.toml
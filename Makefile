# Makefile for Anomaly Detector

# Variables
BINARY_NAME=anomaly-detector
VERSION=1.0.0
BUILD_DIR=build
CMD_DIR=cmd
INTERNAL_DIR=internal
PKG_DIR=pkg

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod
GOTOOL=$(GOCMD) tool
GOFMT=gofmt

# Docker parameters
DOCKER_IMAGE=$(BINARY_NAME)
DOCKER_TAG=$(VERSION)

# Build flags
BUILD_FLAGS=-ldflags="-X main.Version=$(VERSION)"

.PHONY: all build test clean run docker-build docker-run deploy help

all: clean test build

## Build commands
build: build-api build-worker build-cli ## Build all binaries

build-api: ## Build API server
	@echo "Building API server..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(BUILD_FLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-api ./$(CMD_DIR)/api

build-worker: ## Build worker
	@echo "Building worker..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(BUILD_FLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-worker ./$(CMD_DIR)/worker

build-cli: ## Build CLI
	@echo "Building CLI..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(BUILD_FLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-cli ./$(CMD_DIR)/cli

## Test commands
test: ## Run tests
	@echo "Running tests..."
	$(GOTEST) -v ./...

test-unit: ## Run unit tests only
	@echo "Running unit tests..."
	$(GOTEST) -v ./tests/unit/...

test-integration: ## Run integration tests only
	@echo "Running integration tests..."
	$(GOTEST) -v ./tests/integration/...

test-e2e: ## Run end-to-end tests only
	@echo "Running end-to-end tests..."
	$(GOTEST) -v ./tests/e2e/...

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	$(GOTEST) -coverprofile=coverage.out ./...
	$(GOTOOL) cover -html=coverage.out -o coverage.html

## Run commands
run: run-api ## Run API server (default)

run-api: ## Run API server
	@echo "Running API server..."
	$(GOCMD) run ./$(CMD_DIR)/api

run-worker: ## Run worker
	@echo "Running worker..."
	$(GOCMD) run ./$(CMD_DIR)/worker

run-cli: ## Run CLI with sample text
	@echo "Running CLI..."
	$(GOCMD) run ./$(CMD_DIR)/cli analyze "This is sample text for analysis."

## Development commands
fmt: ## Format code
	@echo "Formatting code..."
	$(GOFMT) -s -w .

vet: ## Run go vet
	@echo "Running go vet..."
	$(GOCMD) vet ./...

lint: ## Run linter (requires golangci-lint)
	@echo "Running linter..."
	golangci-lint run

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	$(GOMOD) download

tidy: ## Tidy dependencies
	@echo "Tidying dependencies..."
	$(GOMOD) tidy

vendor: ## Create vendor directory
	@echo "Creating vendor directory..."
	$(GOMOD) vendor

## Docker commands
docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .
	docker tag $(DOCKER_IMAGE):$(DOCKER_TAG) $(DOCKER_IMAGE):latest

docker-run: ## Run Docker container
	@echo "Running Docker container..."
	docker run -p 8080:8080 $(DOCKER_IMAGE):latest

docker-push: ## Push Docker image
	@echo "Pushing Docker image..."
	docker push $(DOCKER_IMAGE):$(DOCKER_TAG)
	docker push $(DOCKER_IMAGE):latest

## Deployment commands
deploy: ## Deploy to production
	@echo "Deploying to production..."
	kubectl apply -f deployments/kubernetes/

deploy-dev: ## Deploy to development
	@echo "Deploying to development..."
	kubectl apply -f deployments/kubernetes/dev/

## Benchmark commands
benchmark: ## Run benchmarks
	@echo "Running benchmarks..."
	$(GOTEST) -bench=. -benchmem ./benchmarks/...

benchmark-cpu: ## Run CPU benchmarks
	@echo "Running CPU benchmarks..."
	$(GOTEST) -bench=. -benchmem -cpuprofile=cpu.prof ./benchmarks/...

benchmark-mem: ## Run memory benchmarks
	@echo "Running memory benchmarks..."
	$(GOTEST) -bench=. -benchmem -memprofile=mem.prof ./benchmarks/...

## Utility commands
clean: ## Clean build files
	@echo "Cleaning..."
	$(GOCLEAN)
	rm -rf $(BUILD_DIR)
	rm -f coverage.out coverage.html
	rm -f *.prof

install: build ## Install binaries
	@echo "Installing binaries..."
	cp $(BUILD_DIR)/$(BINARY_NAME)-api $(GOPATH)/bin/
	cp $(BUILD_DIR)/$(BINARY_NAME)-worker $(GOPATH)/bin/
	cp $(BUILD_DIR)/$(BINARY_NAME)-cli $(GOPATH)/bin/

uninstall: ## Uninstall binaries
	@echo "Uninstalling binaries..."
	rm -f $(GOPATH)/bin/$(BINARY_NAME)-api
	rm -f $(GOPATH)/bin/$(BINARY_NAME)-worker
	rm -f $(GOPATH)/bin/$(BINARY_NAME)-cli

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'
#!/bin/bash

# Setup script for Anomaly Detector development environment

set -e

echo "Setting up Anomaly Detector development environment..."

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "Error: Go is not installed. Please install Go 1.21 or later."
    exit 1
fi

# Check Go version
GO_VERSION=$(go version | cut -d' ' -f3 | sed 's/go//')
REQUIRED_VERSION="1.21"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$GO_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "Error: Go version $REQUIRED_VERSION or higher is required. Found: $GO_VERSION"
    exit 1
fi

echo "✓ Go version $GO_VERSION detected"

# Create necessary directories
echo "Creating project directories..."
mkdir -p {build,logs,data}

# Download dependencies
echo "Downloading Go dependencies..."
go mod download
go mod tidy

# Install development tools
echo "Installing development tools..."

# golangci-lint for linting
if ! command -v golangci-lint &> /dev/null; then
    echo "Installing golangci-lint..."
    curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin v1.54.2
fi

# air for live reloading (optional)
if ! command -v air &> /dev/null; then
    echo "Installing air for live reloading..."
    go install github.com/cosmtrek/air@latest
fi

# Set up pre-commit hooks
echo "Setting up pre-commit hooks..."
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Pre-commit hook for Go projects

echo "Running pre-commit checks..."

# Format code
echo "Formatting code..."
gofmt -s -w .

# Run tests
echo "Running tests..."
go test ./... || exit 1

# Run linter
echo "Running linter..."
golangci-lint run || exit 1

echo "Pre-commit checks passed!"
EOF

chmod +x .git/hooks/pre-commit

# Build the project
echo "Building project..."
make build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Quick start:"
echo "  make run          # Start API server"
echo "  make test         # Run tests"
echo "  make help         # Show all available commands"
echo ""
echo "API will be available at: http://localhost:8080"
echo ""
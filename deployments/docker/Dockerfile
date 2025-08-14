# Build stage for Go backend
FROM golang:1.21-alpine AS go-builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy Go mod files
COPY go.mod go.sum ./

# Download Go dependencies
RUN go mod download

# Copy source code
COPY cmd/ cmd/
COPY internal/ internal/
COPY pkg/ pkg/

# Build arguments
ARG VERSION=dev
ARG COMMIT=unknown

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.version=${VERSION} -X main.commit=${COMMIT}" \
    -a -installsuffix cgo \
    -o vibecast-server \
    ./cmd/server

# Build stage for Node.js frontend
FROM node:18-alpine AS node-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ src/
COPY public/ public/
COPY *.config.js ./

# Build frontend
RUN npm run build

# Final stage
FROM alpine:3.18

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata curl

# Create non-root user
RUN addgroup -g 1001 -S vibecast && \
    adduser -S vibecast -u 1001 -G vibecast

# Set working directory
WORKDIR /app

# Copy certificates
COPY --from=go-builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy built binaries and assets
COPY --from=go-builder /app/vibecast-server .
COPY --from=node-builder /app/dist ./static/
COPY --chown=vibecast:vibecast deployments/docker/entrypoint.sh .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Switch to non-root user
USER vibecast

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# Set entrypoint
ENTRYPOINT ["./entrypoint.sh"]
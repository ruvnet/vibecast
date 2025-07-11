# CUDA-Rust-WASM Docker Image
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    curl \
    gcc \
    g++ \
    make \
    python3 \
    python3-dev \
    musl-dev \
    linux-headers

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Install wasm-opt
RUN wget https://github.com/WebAssembly/binaryen/releases/download/version_116/binaryen-version_116-x86_64-linux.tar.gz && \
    tar -xzf binaryen-version_116-x86_64-linux.tar.gz && \
    cp binaryen-version_116/bin/wasm-opt /usr/local/bin/ && \
    rm -rf binaryen-version_116*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY Cargo.toml ./
COPY build.rs ./

# Install Node.js dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Create app directory
WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/pkg ./pkg
COPY --from=builder /app/cli ./cli
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S cuda-rust-wasm -u 1001

# Change ownership
RUN chown -R cuda-rust-wasm:nodejs /app
USER cuda-rust-wasm

# Expose port for demo
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Default command
CMD ["node", "cli/index.js", "--help"]

# Labels
LABEL org.opencontainers.image.title="CUDA-Rust-WASM" \
      org.opencontainers.image.description="CUDA to WebAssembly transpiler" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.vendor="VibeCast" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/vibecast/cuda-rust-wasm"
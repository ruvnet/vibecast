# Rust WASM Modules

This directory contains Rust code that compiles to WebAssembly for performance-critical operations.

## Structure

```
src/wasm/
├── README.md          # This file
├── rust/              # Rust source code
│   ├── Cargo.toml     # Rust dependencies
│   ├── src/
│   │   └── lib.rs     # Main library entry
│   └── pkg/           # Compiled WASM output
└── bindings/          # TypeScript bindings
    └── index.ts       # WASM loader and type definitions
```

## Building WASM Modules

```bash
npm run build:wasm
```

## Use Cases

- High-performance data processing
- Cryptographic operations
- Complex calculations
- Binary protocol parsing

## Prerequisites

- Rust toolchain (rustup)
- wasm-pack
- wasm-bindgen

## Installation

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack
```

## Example Usage

```typescript
import { initWasm, processData } from './wasm/bindings';

async function main() {
  await initWasm();
  const result = processData(inputData);
  console.log(result);
}
```

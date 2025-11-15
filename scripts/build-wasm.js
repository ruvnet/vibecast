#!/usr/bin/env node

/**
 * WASM Build Script
 *
 * Builds Rust code to WebAssembly modules
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WASM_DIR = path.join(__dirname, '../src/wasm');
const RUST_DIR = path.join(WASM_DIR, 'rust');
const OUTPUT_DIR = path.join(RUST_DIR, 'pkg');

console.log('Building WASM modules...\n');

// Check if Rust source directory exists
if (!fs.existsSync(RUST_DIR)) {
  console.log('Rust source directory not found. Creating placeholder structure...');
  fs.mkdirSync(RUST_DIR, { recursive: true });
  fs.mkdirSync(path.join(RUST_DIR, 'src'), { recursive: true });

  // Create Cargo.toml
  const cargoToml = `[package]
name = "vibecast-wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"

[profile.release]
opt-level = "z"
lto = true
`;

  fs.writeFileSync(path.join(RUST_DIR, 'Cargo.toml'), cargoToml);

  // Create lib.rs
  const libRs = `use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
`;

  fs.writeFileSync(path.join(RUST_DIR, 'src', 'lib.rs'), libRs);
  console.log('Created Rust source files.\n');
}

// Check if wasm-pack is installed
try {
  execSync('wasm-pack --version', { stdio: 'pipe' });
} catch (error) {
  console.error('Error: wasm-pack is not installed.');
  console.error('Install it with: cargo install wasm-pack');
  process.exit(1);
}

// Build WASM
try {
  console.log('Running wasm-pack build...');
  execSync('wasm-pack build --target nodejs', {
    cwd: RUST_DIR,
    stdio: 'inherit',
  });

  console.log('\n✓ WASM build completed successfully!');
  console.log(`Output: ${OUTPUT_DIR}`);
} catch (error) {
  console.error('\n✗ WASM build failed');
  console.error(error.message);
  process.exit(1);
}

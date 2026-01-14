# ADR-001: WASM Target Selection for Ultra-Condensed AISP Kernel

## Status
Accepted

## Date
2026-01-14

## Context
We need to deploy an AISP (AI Symbolic Protocol) type-checking kernel that:
- Runs in browsers via WebAssembly
- Fits on embedded chips with extreme memory constraints
- Maintains <8KB binary size
- Integrates with lean-agentic's type theory primitives

## Decision
Use `wasm32-unknown-unknown` target with `#![no_std]` configuration.

### Target Configuration
```toml
[lib]
crate-type = ["cdylib"]

[profile.release]
opt-level = "z"          # Optimize for size
lto = true               # Link-time optimization
codegen-units = 1        # Single codegen unit for better optimization
panic = "abort"          # No unwinding overhead
strip = true             # Strip symbols
```

### Rationale
1. **wasm32-unknown-unknown** - No WASI dependencies, pure WASM
2. **no_std** - Eliminates std library bloat (~100KB savings)
3. **panic=abort** - Removes unwinding machinery (~20KB savings)
4. **opt-level="z"** - Aggressive size optimization over speed

## Alternatives Considered

| Alternative | Size Impact | Rejected Reason |
|-------------|-------------|-----------------|
| wasm32-wasi | +50KB | WASI runtime overhead |
| std library | +100KB | Far exceeds 8KB budget |
| wasm-bindgen full | +30KB | JS glue code bloat |
| panic=unwind | +20KB | Unwinding tables too large |

## Consequences

### Positive
- Achievable <8KB target with careful implementation
- Direct chip deployment without runtime
- Browser-compatible without additional shims
- Memory-mapped I/O possible for chip integration

### Negative
- No allocator by default (must provide custom or use static buffers)
- No format strings (no `format!` macro)
- Limited error handling (no `?` with std::error::Error)
- Manual memory management required

### Mitigations
- Use fixed-size arenas for all allocations
- Error codes instead of error types
- Compile-time computed lookup tables
- Stack-only data structures where possible

## Implementation Notes

### Memory Budget (8KB = 8192 bytes)
| Component | Budget | Notes |
|-----------|--------|-------|
| Type kernel | 3KB | Core type checking |
| Term arena | 2KB | Hash-consed terms |
| Symbol table | 1KB | Interned names |
| Validation | 1KB | AISP rule checking |
| WASM overhead | 1KB | Section headers, exports |

### Export Surface
```rust
#[no_mangle] pub extern "C" fn aisp_init() -> i32
#[no_mangle] pub extern "C" fn aisp_parse(ptr: *const u8, len: u32) -> i32
#[no_mangle] pub extern "C" fn aisp_validate() -> i32
#[no_mangle] pub extern "C" fn aisp_tier() -> i32
#[no_mangle] pub extern "C" fn aisp_ambig() -> f32
```

## References
- [lean-agentic](https://docs.rs/lean-agentic) - Core type theory implementation
- [AISP 5.1 Specification](../../../aisp-open-core-upstream/AI_GUIDE.md)
- [Rust WASM Book](https://rustwasm.github.io/docs/book/)

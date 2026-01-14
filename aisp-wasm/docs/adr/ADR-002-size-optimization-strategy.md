# ADR-002: Size Optimization Strategy for <8KB WASM Binary

## Status
Accepted

## Date
2026-01-14

## Context
The 8KB constraint requires aggressive optimization beyond standard Rust practices. Every byte counts when targeting embedded chips and ultra-fast browser loading.

## Decision
Implement a multi-layer size optimization strategy.

### Layer 1: Compile-Time Optimizations
```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = true

[profile.release.package."*"]
opt-level = "z"
```

### Layer 2: Code Architecture Optimizations

#### 2.1 No Generics Monomorphization Bloat
```rust
// BAD: Creates multiple copies
fn process<T: Term>(t: T) -> T { ... }

// GOOD: Single implementation
fn process(t: TermId) -> TermId { ... }
```

#### 2.2 Inline Threshold Tuning
```rust
#[inline(always)]  // Only for tiny hot functions
fn is_sort(t: TermId) -> bool { ... }

#[inline(never)]   // Prevent bloat in cold paths
fn elaborate_term(...) -> Result { ... }
```

#### 2.3 Enum Discriminant Packing
```rust
// BAD: 8 bytes per variant
enum Level { Zero, Succ(Box<Level>), Max(...), IMax(...) }

// GOOD: 4 bytes with manual discriminant
#[repr(u8)]
enum LevelTag { Zero = 0, Succ = 1, Max = 2, IMax = 3 }
struct Level { tag: LevelTag, data: u32 }
```

### Layer 3: Data Structure Optimizations

#### 3.1 Arena Allocation
```rust
struct Arena<const N: usize> {
    data: [u8; N],
    ptr: usize,
}

impl<const N: usize> Arena<N> {
    const fn new() -> Self { Self { data: [0; N], ptr: 0 } }
    fn alloc(&mut self, size: usize) -> Option<*mut u8> { ... }
}
```

#### 3.2 Symbol Interning with Perfect Hashing
```rust
// Compile-time symbol table for AISP glyphs
const SYMBOLS: &[(&str, u16)] = &[
    ("≜", 0), ("≔", 1), ("∀", 2), ("∃", 3),
    ("→", 4), ("⊢", 5), ("⊨", 6), ("λ", 7),
    // ... 512 total symbols
];
```

### Layer 4: Post-Compilation Optimization

```bash
# Build pipeline
cargo build --release --target wasm32-unknown-unknown
wasm-opt -Oz -o output.wasm target/.../aisp_wasm.wasm
wasm-strip output.wasm
```

## Size Budget Breakdown

| Component | Unoptimized | Optimized | Technique |
|-----------|-------------|-----------|-----------|
| Type kernel | 12KB | 2.5KB | no_std, inline control |
| Term representation | 8KB | 1.5KB | Arena, packed enums |
| Symbol table | 4KB | 0.8KB | Perfect hash, u16 IDs |
| Validation logic | 6KB | 1.2KB | Table-driven, no regex |
| Error handling | 3KB | 0.2KB | Error codes only |
| WASM overhead | 2KB | 0.8KB | wasm-opt, strip |
| **Total** | **35KB** | **7KB** | |

## Consequences

### Positive
- Achieves <8KB target with margin
- Sub-millisecond load times in browser
- Direct flash storage on microcontrollers
- Cache-friendly data layout

### Negative
- Reduced code readability
- Limited debugging capabilities
- Fixed capacity limits
- No dynamic error messages

## Validation Metrics

```rust
// Compile-time size assertions
const _: () = assert!(core::mem::size_of::<Term>() <= 16);
const _: () = assert!(core::mem::size_of::<Level>() <= 8);
const _: () = assert!(core::mem::size_of::<Symbol>() <= 4);
```

## References
- [min-sized-rust](https://github.com/nicohman/min-sized-rust)
- [wasm-opt documentation](https://github.com/WebAssembly/binaryen)

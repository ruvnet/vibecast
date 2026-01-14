# ADR-004: Memory Management Strategy for Embedded Deployment

## Status
Accepted

## Date
2026-01-14

## Context
With no_std and 8KB binary constraint, we cannot use the standard allocator. Memory must be statically allocated or provided by the host environment.

## Decision
Implement a dual-mode memory strategy:

### Mode 1: Static Arena (Chip Deployment)
```rust
/// Fixed-size arena for embedded deployment
#[repr(C, align(8))]
pub struct StaticArena<const N: usize> {
    buffer: [u8; N],
    head: usize,
}

impl<const N: usize> StaticArena<N> {
    pub const fn new() -> Self {
        Self { buffer: [0; N], head: 0 }
    }

    #[inline]
    pub fn alloc<T>(&mut self) -> Option<&mut T> {
        let align = core::mem::align_of::<T>();
        let size = core::mem::size_of::<T>();
        let aligned = (self.head + align - 1) & !(align - 1);

        if aligned + size > N { return None; }

        self.head = aligned + size;
        unsafe {
            Some(&mut *(self.buffer.as_mut_ptr().add(aligned) as *mut T))
        }
    }

    pub fn reset(&mut self) { self.head = 0; }
}

// Global static arena (2KB for terms)
static mut TERM_ARENA: StaticArena<2048> = StaticArena::new();
```

### Mode 2: Host-Provided Memory (Browser)
```rust
/// Import memory from JavaScript host
#[cfg(target_arch = "wasm32")]
extern "C" {
    fn host_alloc(size: u32, align: u32) -> *mut u8;
    fn host_free(ptr: *mut u8, size: u32);
}

/// Wrapper for host allocation
pub struct HostArena {
    base: *mut u8,
    size: usize,
    head: usize,
}
```

### Memory Layout

```
┌─────────────────────────────────────────────────┐
│ WASM Linear Memory (if browser)                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ [0x0000-0x07FF] Term Arena (2KB)            │ │
│ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ Term[0] | Term[1] | ... | Term[127]     │ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ ├─────────────────────────────────────────────┤ │
│ │ [0x0800-0x0BFF] Symbol Table (1KB)          │ │
│ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ SymEntry[0..255]                        │ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ ├─────────────────────────────────────────────┤ │
│ │ [0x0C00-0x0FFF] Context Stack (1KB)         │ │
│ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ LocalVar[0] | LocalVar[1] | ...         │ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ ├─────────────────────────────────────────────┤ │
│ │ [0x1000-0x13FF] Parse Buffer (1KB)          │ │
│ ├─────────────────────────────────────────────┤ │
│ │ [0x1400-0x17FF] Output Buffer (1KB)         │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
Total: 6KB working memory
```

### Hash-Consing for Terms

```rust
/// Unique term identification via content hash
#[derive(Clone, Copy, PartialEq, Eq)]
#[repr(transparent)]
pub struct TermId(u16);

impl TermId {
    pub const NULL: Self = Self(0xFFFF);

    /// Maximum 4096 unique terms
    pub fn from_index(i: usize) -> Option<Self> {
        if i < 0xFFFF { Some(Self(i as u16)) } else { None }
    }
}

/// Hash table for term deduplication
struct TermCache {
    entries: [TermId; 256],  // 512 bytes
}

impl TermCache {
    fn intern(&mut self, term: &Term, arena: &mut TermArena) -> TermId {
        let hash = self.hash(term) as usize % 256;
        if let Some(existing) = self.lookup(hash, term, arena) {
            return existing;
        }
        let id = arena.push(term)?;
        self.entries[hash] = id;
        id
    }
}
```

### Zero-Copy String References

```rust
/// Reference into input buffer (no allocation)
#[derive(Clone, Copy)]
#[repr(C)]
pub struct StrRef {
    pub offset: u16,
    pub len: u16,
}

impl StrRef {
    pub fn as_str<'a>(&self, input: &'a [u8]) -> &'a str {
        unsafe {
            core::str::from_utf8_unchecked(
                &input[self.offset as usize..(self.offset + self.len) as usize]
            )
        }
    }
}
```

## Consequences

### Positive
- Zero heap allocations
- Deterministic memory usage
- No fragmentation
- Predictable latency

### Negative
- Fixed capacity limits
- Must reset between documents
- No dynamic growth
- Potential silent truncation

### Capacity Limits

| Resource | Limit | Rationale |
|----------|-------|-----------|
| Unique terms | 4096 | 16-bit TermId |
| Symbols | 512 | AISP Σ_512 glossary |
| Context depth | 64 | Typical nesting |
| Parse tokens | 1024 | Per-document |

## Chip-Specific Considerations

### ESP32 (520KB SRAM)
- Use internal SRAM for arena
- DMA for input buffer
- Flash for symbol table

### RP2040 (264KB SRAM)
- Tight fit, use external PSRAM
- Lazy symbol loading
- Streaming validation

### Browser (Unlimited)
- Request 64KB WASM memory
- Grow on demand
- SharedArrayBuffer for workers

## References
- [no_std allocator patterns](https://os.phil-opp.com/allocator-designs/)
- [WASM memory model](https://webassembly.github.io/spec/core/exec/runtime.html#memory-instances)

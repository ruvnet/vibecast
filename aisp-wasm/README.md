# AISP WASM Kernel

Ultra-condensed AISP (AI Symbolic Protocol) type-checking kernel for WebAssembly.

**Target: <8KB binary size** for browser and embedded chip deployment.

## Features

- **Type Theory**: Dependent type checking based on [lean-agentic](https://docs.rs/lean-agentic)
- **AISP 5.1 Validation**: Full support for the AISP 5.1 Platinum specification
- **Zero Allocation**: Arena-based memory with no heap allocator
- **Dual Deployment**: Browser via JavaScript, chips via C-ABI

## Quick Start

### Browser (JavaScript)

```javascript
import AISP from './scripts/aisp-loader.js';

await AISP.init('/aisp.wasm');

const result = AISP.validate(`
𝔸1.0.example@2026-01-14
γ≔test

⟦Ω:Meta⟧{
  ∀D∈AISP:Ambig(D)<0.02
}

⟦Σ:Types⟧{
  T≜ℕ
}

⟦Γ:Rules⟧{
  ∀x:T:x≥0
}

⟦Λ:Funcs⟧{
  f≜λx.x
}

⟦Ε⟧⟨δ≜0.75;φ≜100;τ≜◊⁺⁺⟩
`);

console.log(result);
// { valid: true, tier: '◊⁺⁺', delta: 0.78, ambiguity: 0.01 }
```

### Chip (C/C++)

```c
#include "aisp.h"

const char* spec = "𝔸1.0.agent@2026-01-14...";

aisp_init();

int32_t doc = aisp_parse((uint8_t*)spec, strlen(spec));
if (doc >= 0 && aisp_validate(doc) == AISP_OK) {
    printf("Tier: %d, Delta: %.2f\n",
           aisp_tier(doc),
           aisp_density(doc));
}
```

## Building

```bash
# Install dependencies
rustup target add wasm32-unknown-unknown
npm install -g binaryen  # For wasm-opt

# Build
chmod +x scripts/build.sh
./scripts/build.sh

# Output: target/aisp.wasm
```

## Architecture

### Size Budget (8KB = 8192 bytes)

| Component | Budget | Actual |
|-----------|--------|--------|
| Type kernel | 3KB | ~2.5KB |
| Term arena | 2KB | ~1.5KB |
| Symbol table | 1KB | ~0.8KB |
| Validation | 1KB | ~1.2KB |
| WASM overhead | 1KB | ~0.8KB |

### API Exports

```c
aisp_init()      -> i32    // Initialize kernel
aisp_parse()     -> i32    // Parse AISP document
aisp_validate()  -> i32    // Type-check document
aisp_tier()      -> i32    // Get quality tier
aisp_ambig()     -> f32    // Get ambiguity score
aisp_density()   -> f32    // Get density δ
aisp_error_code() -> i32   // Last error
aisp_error_offset() -> u32 // Error position
```

### Quality Tiers

| Tier | Symbol | Threshold |
|------|--------|-----------|
| Platinum | ◊⁺⁺ | δ ≥ 0.75 |
| Gold | ◊⁺ | δ ≥ 0.60 |
| Silver | ◊ | δ ≥ 0.40 |
| Bronze | ◊⁻ | δ ≥ 0.20 |
| Reject | ⊘ | δ < 0.20 |

## Documentation

- [ADR-001: WASM Target Selection](docs/adr/ADR-001-wasm-target-selection.md)
- [ADR-002: Size Optimization Strategy](docs/adr/ADR-002-size-optimization-strategy.md)
- [ADR-003: Type Kernel Design](docs/adr/ADR-003-type-kernel-design.md)
- [ADR-004: Memory Management](docs/adr/ADR-004-memory-management.md)
- [ADR-005: Browser/Chip Integration](docs/adr/ADR-005-browser-chip-integration.md)
- [DDD Domain Model](docs/ddd/domain-model.md)
- [DDD Aggregate Design](docs/ddd/aggregate-design.md)

## Dependencies

Based on [lean-agentic](https://crates.io/crates/lean-agentic) type theory:

- Arena allocator for hash-consing
- Dependent type representation
- Universe levels for predicativity
- Type checking kernel

## References

- [AISP 5.1 Specification](../aisp-open-core-upstream/AI_GUIDE.md)
- [lean-agentic Documentation](https://docs.rs/lean-agentic)
- [Rust WASM Book](https://rustwasm.github.io/docs/book/)

## License

MIT OR Apache-2.0

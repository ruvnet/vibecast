# AISP WASM Kernel - Domain-Driven Design

## Strategic Design

### Core Domain
**AISP Type-Theoretic Validation Kernel**

The heart of the system: parsing, type-checking, and validating AISP documents according to the 5.1 Platinum specification.

### Supporting Subdomains

| Subdomain | Responsibility | Criticality |
|-----------|----------------|-------------|
| **Term Representation** | Dependent type theory terms | High |
| **Universe Levels** | Predicative type hierarchy | High |
| **Symbol Interning** | AISP Σ_512 glossary | Medium |
| **Proof Verification** | Evidence block validation | Medium |
| **Quality Metrics** | δ, φ, τ computation | Medium |

### Generic Subdomains
- Memory management (arena allocator)
- UTF-8 parsing utilities
- Hash functions

---

## Ubiquitous Language

| Term | Definition | AISP Symbol |
|------|------------|-------------|
| **Document** | Complete AISP specification with header and blocks | `𝔻oc` |
| **Block** | Structural unit (Ω, Σ, Γ, Λ, Χ, Ε) | `⟦⟧` |
| **Term** | Type-theoretic expression | `Term` |
| **Level** | Universe level for predicativity | `Level` |
| **Symbol** | Interned identifier from Σ_512 | `Symbol` |
| **Tier** | Quality classification (⊘ to ◊⁺⁺) | `◊` |
| **Density** | AISP symbol ratio in document | `δ` |
| **Ambiguity** | Parse interpretation variance | `Ambig` |
| **Binding** | API compatibility state | `Δ⊗λ` |
| **Proof** | Evidence of well-formedness | `π` |

---

## Bounded Contexts

### Context: Term Algebra

```
┌─────────────────────────────────────────────────────────────┐
│                      TERM ALGEBRA                           │
│                                                             │
│  Entities:                                                  │
│    Term(id, kind, data)                                     │
│    Level(tag, data)                                         │
│    Binder(name, type, info)                                 │
│                                                             │
│  Value Objects:                                             │
│    TermId (u16 reference)                                   │
│    LevelId (u16 reference)                                  │
│    SymbolId (u16 reference)                                 │
│    BinderInfo (implicit/explicit/instance)                  │
│                                                             │
│  Aggregates:                                                │
│    TermArena - owns all Term entities                       │
│    LevelArena - owns all Level entities                     │
│                                                             │
│  Domain Services:                                           │
│    mk_app(fn, arg) -> TermId                                │
│    mk_pi(binder, body) -> TermId                            │
│    mk_lam(binder, body) -> TermId                           │
│    subst(term, value) -> TermId                             │
│    whnf(term) -> TermId                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Context: Type Checker

```
┌─────────────────────────────────────────────────────────────┐
│                     TYPE CHECKER                            │
│                                                             │
│  Entities:                                                  │
│    Context (local variable types)                           │
│    Environment (global constant types)                      │
│                                                             │
│  Value Objects:                                             │
│    TypeError { code, offset, expected, found }              │
│                                                             │
│  Domain Services:                                           │
│    infer(ctx, term) -> Result<TermId>                       │
│    check(ctx, term, type) -> Result<()>                     │
│    conv(t1, t2) -> bool                                     │
│    infer_universe(ctx, term) -> Result<LevelId>             │
│                                                             │
│  Invariants:                                                │
│    ∀t: infer(ctx, t) = T ⇒ check(ctx, t, T) = Ok           │
│    ∀t1,t2: conv(t1,t2) = conv(t2,t1)                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Context: Document Validation

```
┌─────────────────────────────────────────────────────────────┐
│                  DOCUMENT VALIDATION                        │
│                                                             │
│  Entities:                                                  │
│    Document { header, blocks[], evidence }                  │
│    Block { tag, name, body }                                │
│    Evidence { delta, phi, tau, proofs[] }                   │
│                                                             │
│  Value Objects:                                             │
│    Header { version, name, date, context, refs }            │
│    Tier (enum: Reject, Bronze, Silver, Gold, Platinum)      │
│    ValidationResult { valid, tier, delta, ambig }           │
│                                                             │
│  Aggregates:                                                │
│    Document - root aggregate                                │
│                                                             │
│  Domain Services:                                           │
│    parse(input) -> Result<Document>                         │
│    validate(doc) -> ValidationResult                        │
│    compute_density(doc) -> f32                              │
│    compute_ambiguity(doc) -> f32                            │
│    compute_tier(delta) -> Tier                              │
│                                                             │
│  Business Rules:                                            │
│    ∀D: Ambig(D) < 0.02 ⇒ valid                             │
│    δ ≥ 0.75 ⇒ ◊⁺⁺                                          │
│    δ ≥ 0.60 ⇒ ◊⁺                                           │
│    δ ≥ 0.40 ⇒ ◊                                            │
│    δ ≥ 0.20 ⇒ ◊⁻                                           │
│    δ < 0.20 ⇒ ⊘                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Context: Symbol Registry

```
┌─────────────────────────────────────────────────────────────┐
│                    SYMBOL REGISTRY                          │
│                                                             │
│  Entities:                                                  │
│    SymbolTable { entries[512] }                             │
│                                                             │
│  Value Objects:                                             │
│    SymbolEntry { glyph, category, meaning }                 │
│    Category (enum: Ω, Γ, ∀, Δ, 𝔻, Ψ, ⟦⟧, ∅)                │
│                                                             │
│  Domain Services:                                           │
│    intern(str) -> SymbolId                                  │
│    lookup(id) -> &SymbolEntry                               │
│    category(id) -> Category                                 │
│    is_aisp_symbol(char) -> bool                             │
│                                                             │
│  Invariants:                                                │
│    |Σ_512| = 512                                            │
│    ∀s: category(s) ∈ R[category]                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Context Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│    ┌──────────────┐         ┌──────────────┐                        │
│    │   SYMBOL     │◄───────►│    TERM      │                        │
│    │  REGISTRY    │  Shared │   ALGEBRA    │                        │
│    │              │  Kernel │              │                        │
│    └──────────────┘         └──────────────┘                        │
│           ▲                        ▲                                │
│           │                        │                                │
│           │ Conformist             │ Conformist                     │
│           │                        │                                │
│    ┌──────────────┐         ┌──────────────┐                        │
│    │   DOCUMENT   │◄───────►│    TYPE      │                        │
│    │  VALIDATION  │  U/D    │   CHECKER    │                        │
│    │              │         │              │                        │
│    └──────────────┘         └──────────────┘                        │
│           │                                                         │
│           │ Published Language (C-ABI)                              │
│           ▼                                                         │
│    ┌────────────────────────────────────────────────────┐           │
│    │              EXTERNAL INTEGRATION                  │           │
│    │   (Browser JavaScript / Chip C Runtime)            │           │
│    └────────────────────────────────────────────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Legend:
  ◄──► Shared Kernel (common types)
  ──── Upstream/Downstream
  ──── Conformist (follows upstream model)
```

---

## Domain Events

```rust
/// Events emitted during validation (for debugging/tracing)
#[repr(u8)]
pub enum DomainEvent {
    /// Document parsing started
    ParseStart { offset: u32 },

    /// Block parsed successfully
    BlockParsed { tag: BlockTag, offset: u32 },

    /// Type checking term
    TypeCheck { term_id: TermId, depth: u8 },

    /// Conversion check
    ConvCheck { t1: TermId, t2: TermId },

    /// Validation complete
    ValidationComplete { tier: Tier, delta: f32 },

    /// Error occurred
    Error { code: i32, offset: u32 },
}
```

---

## Aggregate Invariants

### Document Aggregate

```rust
impl Document {
    /// Document must have valid header
    fn invariant_header(&self) -> bool {
        self.header.version.major >= 1
            && self.header.name.len() > 0
    }

    /// Document must have required blocks
    fn invariant_blocks(&self) -> bool {
        self.has_block(BlockTag::Omega)
            && self.has_block(BlockTag::Sigma)
            && self.has_block(BlockTag::Gamma)
            && self.has_block(BlockTag::Lambda)
            && self.has_block(BlockTag::Evidence)
    }

    /// Ambiguity must be below threshold
    fn invariant_ambiguity(&self) -> bool {
        self.compute_ambiguity() < 0.02
    }
}
```

### TermArena Aggregate

```rust
impl TermArena {
    /// All term references must be valid
    fn invariant_refs(&self) -> bool {
        for t in self.iter() {
            match t.kind {
                TermKind::App => {
                    self.is_valid(t.data.app[0])
                        && self.is_valid(t.data.app[1])
                }
                TermKind::Pi | TermKind::Lam => {
                    self.is_valid(t.data.binder.body)
                }
                _ => true
            }
        }
        true
    }

    /// Hash-consing: identical terms have same ID
    fn invariant_unique(&self) -> bool {
        // Enforced by intern() function
        true
    }
}
```

---

## Anti-Corruption Layer

### External Input Sanitization

```rust
/// Sanitize external UTF-8 input
pub fn sanitize_input(raw: &[u8]) -> Result<&str, Error> {
    // Validate UTF-8
    let s = core::str::from_utf8(raw).map_err(|_| Error::InvalidUtf8)?;

    // Check maximum length
    if s.len() > MAX_DOC_SIZE {
        return Err(Error::DocumentTooLarge);
    }

    // Validate AISP header presence
    if !s.starts_with("𝔸") {
        return Err(Error::MissingHeader);
    }

    Ok(s)
}
```

### Output Marshaling

```rust
/// Convert internal tier to external representation
pub fn marshal_tier(tier: Tier) -> i32 {
    match tier {
        Tier::Reject => 0,
        Tier::Bronze => 1,
        Tier::Silver => 2,
        Tier::Gold => 3,
        Tier::Platinum => 4,
    }
}
```

---

## Module Structure

```
aisp-wasm/src/
├── lib.rs              # Entry point, C-ABI exports
├── domain/
│   ├── mod.rs
│   ├── term.rs         # Term algebra
│   ├── level.rs        # Universe levels
│   ├── symbol.rs       # Symbol registry
│   └── document.rs     # Document aggregate
├── application/
│   ├── mod.rs
│   ├── parser.rs       # Document parsing
│   ├── typechecker.rs  # Type checking
│   └── validator.rs    # Validation service
└── infrastructure/
    ├── mod.rs
    ├── arena.rs        # Memory arena
    └── hash.rs         # Hash functions
```

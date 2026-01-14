# AISP WASM Kernel - Aggregate Design

## Overview

This document details the aggregate design for the ultra-condensed AISP kernel, optimized for <8KB WASM binary size.

---

## Aggregate 1: TermArena

The central aggregate managing all type-theoretic terms via hash-consing.

### Entity: Term

```rust
/// Core term representation (16 bytes)
#[repr(C, align(8))]
pub struct Term {
    /// Term kind discriminant
    pub kind: TermKind,
    /// Flags: has_fvars, has_mvars, etc.
    pub flags: TermFlags,
    /// Padding for alignment
    _pad: [u8; 2],
    /// Kind-specific data
    pub data: TermData,
}

/// Term kind enumeration (1 byte)
#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum TermKind {
    Sort = 0,   // Type universe
    Var = 1,    // Bound variable (de Bruijn)
    Const = 2,  // Global constant
    App = 3,    // Application
    Lam = 4,    // Lambda abstraction
    Pi = 5,     // Dependent function type
    Let = 6,    // Let binding
    Meta = 7,   // Metavariable (for unification)
}

/// Term flags (1 byte)
#[repr(transparent)]
#[derive(Clone, Copy)]
pub struct TermFlags(u8);

impl TermFlags {
    pub const NONE: Self = Self(0);
    pub const HAS_FVARS: Self = Self(1 << 0);
    pub const HAS_MVARS: Self = Self(1 << 1);
    pub const IS_CLOSED: Self = Self(1 << 2);
    pub const IS_WHNF: Self = Self(1 << 3);
}

/// Term data union (12 bytes)
#[repr(C)]
pub union TermData {
    /// Sort: universe level
    pub level: LevelId,
    /// Var: de Bruijn index
    pub var_idx: u16,
    /// Const: name + universe levels
    pub const_data: ConstData,
    /// App: function and argument
    pub app: AppData,
    /// Lam/Pi: binder info and body
    pub binder: BinderData,
    /// Let: binder, value, and body
    pub let_data: LetData,
    /// Meta: metavariable id
    pub meta_id: u16,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct ConstData {
    pub name: SymbolId,  // 2 bytes
    pub levels: u16,     // Index into level list
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct AppData {
    pub func: TermId,    // 2 bytes
    pub arg: TermId,     // 2 bytes
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct BinderData {
    pub name: SymbolId,  // 2 bytes
    pub info: BinderInfo,// 1 byte
    _pad: u8,
    pub ty: TermId,      // 2 bytes
    pub body: TermId,    // 2 bytes
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct LetData {
    pub name: SymbolId,  // 2 bytes
    pub ty: TermId,      // 2 bytes
    pub val: TermId,     // 2 bytes
    pub body: TermId,    // 2 bytes
}
```

### Value Object: TermId

```rust
/// Immutable reference to a term (2 bytes)
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
#[repr(transparent)]
pub struct TermId(u16);

impl TermId {
    pub const NULL: Self = Self(0xFFFF);
    pub const PROP: Self = Self(0);  // Sort(0) - Prop
    pub const TYPE: Self = Self(1);  // Sort(1) - Type

    #[inline]
    pub fn index(self) -> usize {
        self.0 as usize
    }

    #[inline]
    pub fn is_null(self) -> bool {
        self.0 == 0xFFFF
    }
}
```

### Aggregate Root: TermArena

```rust
/// Term arena with hash-consing (2KB capacity)
pub struct TermArena {
    /// Term storage
    terms: [Term; 128],
    /// Current allocation pointer
    len: u16,
    /// Hash table for deduplication
    cache: [TermId; 64],
}

impl TermArena {
    pub const fn new() -> Self {
        Self {
            terms: [Term::UNINIT; 128],
            len: 2, // Reserve 0,1 for Prop, Type
            cache: [TermId::NULL; 64],
        }
    }

    /// Intern a term (hash-consing)
    pub fn intern(&mut self, kind: TermKind, data: TermData) -> Option<TermId> {
        let hash = self.hash_term(kind, &data);
        let slot = hash as usize % 64;

        // Check cache
        let cached = self.cache[slot];
        if !cached.is_null() {
            let t = &self.terms[cached.index()];
            if t.kind == kind && self.data_eq(&t.data, &data, kind) {
                return Some(cached);
            }
        }

        // Allocate new
        if self.len >= 128 {
            return None; // Arena full
        }

        let id = TermId(self.len);
        self.terms[self.len as usize] = Term {
            kind,
            flags: TermFlags::NONE,
            _pad: [0; 2],
            data,
        };
        self.len += 1;
        self.cache[slot] = id;
        Some(id)
    }

    /// Get term by ID
    #[inline]
    pub fn get(&self, id: TermId) -> &Term {
        &self.terms[id.index()]
    }

    /// Reset arena for next document
    pub fn reset(&mut self) {
        self.len = 2;
        self.cache = [TermId::NULL; 64];
    }
}
```

---

## Aggregate 2: Document

The root aggregate representing a complete AISP specification.

### Entity: Document

```rust
/// AISP document (root aggregate)
pub struct Document {
    /// Document header
    pub header: Header,
    /// Parsed blocks
    pub blocks: BlockList,
    /// Evidence block
    pub evidence: Evidence,
    /// Computed metrics
    metrics: DocumentMetrics,
}

/// Document header
#[repr(C)]
pub struct Header {
    /// Version (major.minor)
    pub version: Version,
    /// Document name symbol
    pub name: SymbolId,
    /// Date (days since 2020-01-01)
    pub date: u16,
    /// Context reference
    pub context: SymbolId,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct Version {
    pub major: u8,
    pub minor: u8,
}

/// Block list (fixed capacity)
pub struct BlockList {
    entries: [BlockEntry; 8],
    len: u8,
}

#[repr(C)]
pub struct BlockEntry {
    pub tag: BlockTag,
    pub name: SymbolId,
    pub start: u16,  // Offset in source
    pub end: u16,    // End offset
}

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum BlockTag {
    Omega = 0,    // ⟦Ω⟧ Meta/Foundation
    Sigma = 1,    // ⟦Σ⟧ Types
    Gamma = 2,    // ⟦Γ⟧ Rules
    Lambda = 3,   // ⟦Λ⟧ Functions
    Chi = 4,      // ⟦Χ⟧ Errors
    Evidence = 5, // ⟦Ε⟧ Evidence
    Category = 6, // ⟦ℭ⟧ Categories
    Theorems = 7, // ⟦Θ⟧ Theorems
}
```

### Value Object: Evidence

```rust
/// Evidence block data
#[repr(C)]
pub struct Evidence {
    /// Density score (δ)
    pub delta: f32,
    /// Completeness (φ)
    pub phi: u8,
    /// Quality tier (τ)
    pub tau: Tier,
    /// Proof claims (bitfield)
    pub proofs: ProofClaims,
}

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Tier {
    Reject = 0,   // ⊘: δ < 0.20
    Bronze = 1,   // ◊⁻: δ ≥ 0.20
    Silver = 2,   // ◊: δ ≥ 0.40
    Gold = 3,     // ◊⁺: δ ≥ 0.60
    Platinum = 4, // ◊⁺⁺: δ ≥ 0.75
}

impl Tier {
    pub fn from_delta(delta: f32) -> Self {
        match delta {
            d if d >= 0.75 => Self::Platinum,
            d if d >= 0.60 => Self::Gold,
            d if d >= 0.40 => Self::Silver,
            d if d >= 0.20 => Self::Bronze,
            _ => Self::Reject,
        }
    }
}

/// Proof claims bitfield
#[repr(transparent)]
#[derive(Clone, Copy)]
pub struct ProofClaims(u16);

impl ProofClaims {
    pub const ND: Self = Self(1 << 0);     // Natural deduction
    pub const CAT: Self = Self(1 << 1);    // Category theory
    pub const PI_SIGMA: Self = Self(1 << 2); // Dependent types
    pub const LAYERS: Self = Self(1 << 3);  // Layer proofs
}
```

### Value Object: DocumentMetrics

```rust
/// Computed document metrics
#[repr(C)]
pub struct DocumentMetrics {
    /// Total token count
    pub total_tokens: u16,
    /// AISP symbol count
    pub aisp_tokens: u16,
    /// Whitespace tokens
    pub ws_tokens: u16,
    /// Unique parse interpretations
    pub parse_unique: u16,
    /// Total parse attempts
    pub parse_total: u16,
}

impl DocumentMetrics {
    /// Compute density: |AISP tokens| / |non-ws tokens|
    pub fn density(&self) -> f32 {
        let non_ws = self.total_tokens - self.ws_tokens;
        if non_ws == 0 {
            return 0.0;
        }
        self.aisp_tokens as f32 / non_ws as f32
    }

    /// Compute ambiguity: 1 - |unique| / |total|
    pub fn ambiguity(&self) -> f32 {
        if self.parse_total == 0 {
            return 1.0;
        }
        1.0 - (self.parse_unique as f32 / self.parse_total as f32)
    }
}
```

---

## Aggregate 3: Context

Manages the typing context during type checking.

```rust
/// Type checking context (1KB capacity)
pub struct Context {
    /// Local variable entries
    entries: [ContextEntry; 32],
    /// Current depth
    depth: u8,
}

#[repr(C)]
pub struct ContextEntry {
    /// Variable name
    pub name: SymbolId,
    /// Variable type
    pub ty: TermId,
    /// Optional value (for let-bindings)
    pub value: TermId,
}

impl Context {
    pub const fn new() -> Self {
        Self {
            entries: [ContextEntry::EMPTY; 32],
            depth: 0,
        }
    }

    /// Extend context with new variable
    pub fn extend(&mut self, name: SymbolId, ty: TermId) -> Result<(), Error> {
        if self.depth >= 32 {
            return Err(Error::ContextOverflow);
        }
        self.entries[self.depth as usize] = ContextEntry {
            name,
            ty,
            value: TermId::NULL,
        };
        self.depth += 1;
        Ok(())
    }

    /// Get type of variable at de Bruijn index
    pub fn get_type(&self, idx: u16) -> Result<TermId, Error> {
        let i = self.depth.checked_sub(1 + idx as u8)
            .ok_or(Error::VarOutOfScope)?;
        Ok(self.entries[i as usize].ty)
    }

    /// Pop context
    pub fn pop(&mut self) {
        if self.depth > 0 {
            self.depth -= 1;
        }
    }
}
```

---

## Aggregate 4: SymbolTable

Manages the AISP Σ_512 glossary.

```rust
/// Symbol table for AISP glyphs
pub struct SymbolTable {
    /// Compile-time symbol entries
    entries: &'static [SymbolEntry; 512],
    /// Runtime interned symbols
    dynamic: [DynamicSymbol; 64],
    dynamic_len: u8,
}

/// Static symbol entry
#[repr(C)]
pub struct SymbolEntry {
    /// UTF-8 glyph (up to 4 bytes)
    pub glyph: [u8; 4],
    /// Glyph byte length
    pub len: u8,
    /// Category code
    pub category: Category,
    /// Symbol ID
    pub id: u16,
}

/// Category enumeration
#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Category {
    Omega = 0,     // Ω: Transmuters [0-63]
    Gamma = 1,     // Γ: Topologics [64-127]
    Forall = 2,    // ∀: Quantifiers [128-191]
    Delta = 3,     // Δ: Contractors [192-255]
    Domain = 4,    // 𝔻: Domaines [256-319]
    Psi = 5,       // Ψ: Intents [320-383]
    Block = 6,     // ⟦⟧: Delimiters [384-447]
    Reserved = 7,  // ∅: Reserved [448-511]
}

/// Dynamic (runtime) symbol
#[repr(C)]
pub struct DynamicSymbol {
    pub start: u16,  // Offset in input
    pub len: u16,    // Length
    pub id: u16,     // Assigned ID (512+)
}

impl SymbolTable {
    /// Look up symbol by glyph
    pub fn lookup(&self, glyph: &str) -> Option<SymbolId> {
        // Binary search in static table
        let bytes = glyph.as_bytes();
        for entry in self.entries.iter() {
            if &entry.glyph[..entry.len as usize] == bytes {
                return Some(SymbolId(entry.id));
            }
        }
        // Check dynamic symbols
        None
    }

    /// Check if character is AISP symbol
    pub fn is_aisp(&self, c: char) -> bool {
        self.lookup(c.encode_utf8(&mut [0; 4])).is_some()
    }
}
```

---

## Factory Methods

```rust
impl TermArena {
    /// Create Sort term
    pub fn mk_sort(&mut self, level: LevelId) -> Option<TermId> {
        self.intern(TermKind::Sort, TermData { level })
    }

    /// Create application term
    pub fn mk_app(&mut self, func: TermId, arg: TermId) -> Option<TermId> {
        self.intern(TermKind::App, TermData {
            app: AppData { func, arg }
        })
    }

    /// Create Pi type
    pub fn mk_pi(&mut self, name: SymbolId, ty: TermId, body: TermId) -> Option<TermId> {
        self.intern(TermKind::Pi, TermData {
            binder: BinderData {
                name,
                info: BinderInfo::Default,
                _pad: 0,
                ty,
                body,
            }
        })
    }

    /// Create lambda term
    pub fn mk_lam(&mut self, name: SymbolId, ty: TermId, body: TermId) -> Option<TermId> {
        self.intern(TermKind::Lam, TermData {
            binder: BinderData {
                name,
                info: BinderInfo::Default,
                _pad: 0,
                ty,
                body,
            }
        })
    }
}
```

---

## Repository Pattern (Simplified)

```rust
/// Term repository (wraps arena)
pub trait TermRepository {
    fn get(&self, id: TermId) -> &Term;
    fn intern(&mut self, kind: TermKind, data: TermData) -> Option<TermId>;
    fn mk_sort(&mut self, level: LevelId) -> Option<TermId>;
    fn mk_app(&mut self, func: TermId, arg: TermId) -> Option<TermId>;
    fn mk_pi(&mut self, name: SymbolId, ty: TermId, body: TermId) -> Option<TermId>;
    fn mk_lam(&mut self, name: SymbolId, ty: TermId, body: TermId) -> Option<TermId>;
}

impl TermRepository for TermArena {
    // ... implementations delegate to arena methods
}
```

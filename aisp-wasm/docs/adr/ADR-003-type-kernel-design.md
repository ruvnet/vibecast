# ADR-003: Type Theory Kernel Design Based on lean-agentic

## Status
Accepted

## Date
2026-01-14

## Context
The AISP protocol requires a trusted type-checking kernel for proof-carrying documents. We integrate lean-agentic's type theory primitives while maintaining the 8KB size constraint.

## Decision
Implement a minimal dependent type theory kernel with these core components:

### Core Type Theory (from lean-agentic)

```
Terms ::=
  | Sort(Level)           -- Type universes
  | Var(DeBruijn)         -- Local variables
  | Const(Name, [Level])  -- Global constants
  | App(Term, Term)       -- Application
  | Lam(Binder, Term)     -- Lambda abstraction
  | Pi(Binder, Term)      -- Dependent function type
  | Let(Binder, Term, Term) -- Let binding
```

### Universe Levels (predicativity)
```
Level ::=
  | Zero                  -- 𝕌₀
  | Succ(Level)          -- 𝕌ₙ₊₁
  | Max(Level, Level)    -- max(l₁, l₂)
  | IMax(Level, Level)   -- imax(l₁, l₂)
  | Param(Name)          -- Universe parameter
```

### AISP-Specific Extensions

| AISP Concept | Type Representation |
|--------------|---------------------|
| `⟦Ω⟧` Block | `Const("Block.Omega", [])` |
| `∀x:A.B(x)` | `Pi(x:A, B)` |
| `Σx:A.B(x)` | `Sigma(x:A, B)` via encoding |
| `◊⁺⁺` Tier | `Const("Tier.PlusPlus", [])` |
| `Ambig(D)` | `App(Const("ambig"), D)` |

### Memory Layout

```rust
/// Packed term representation (16 bytes)
#[repr(C)]
pub struct Term {
    pub kind: TermKind,      // 1 byte
    pub flags: u8,           // 1 byte
    pub data: TermData,      // 14 bytes
}

#[repr(u8)]
pub enum TermKind {
    Sort = 0, Var = 1, Const = 2, App = 3,
    Lam = 4, Pi = 5, Let = 6, Meta = 7,
}

#[repr(C)]
pub union TermData {
    pub sort: LevelId,       // For Sort
    pub var: u16,            // For Var (de Bruijn index)
    pub app: [TermId; 2],    // For App: (fn, arg)
    pub binder: BinderData,  // For Lam, Pi, Let
    pub const_: ConstData,   // For Const
}
```

### Type Checking Algorithm

```rust
/// Infer type of term in context
fn infer(ctx: &Context, t: TermId) -> Result<TermId> {
    match arena.get(t).kind {
        Sort => Ok(arena.mk_sort(level_succ(t.level()))),
        Var => ctx.get_type(t.index()),
        Const => env.get_type(t.name()),
        App => {
            let fn_ty = infer(ctx, t.func())?;
            let (dom, cod) = expect_pi(fn_ty)?;
            check(ctx, t.arg(), dom)?;
            Ok(subst(cod, t.arg()))
        }
        Lam => {
            let dom = t.binder_type();
            let ctx2 = ctx.extend(dom);
            let body_ty = infer(&ctx2, t.body())?;
            Ok(arena.mk_pi(t.binder(), body_ty))
        }
        Pi => {
            let dom_lvl = infer_universe(ctx, t.dom())?;
            let ctx2 = ctx.extend(t.dom());
            let cod_lvl = infer_universe(&ctx2, t.cod())?;
            Ok(arena.mk_sort(level_imax(dom_lvl, cod_lvl)))
        }
        Let => {
            check(ctx, t.value(), t.binder_type())?;
            let ctx2 = ctx.define(t.binder_type(), t.value());
            infer(&ctx2, t.body())
        }
    }
}
```

### Definitional Equality (Conversion)

```rust
/// Check definitional equality via WHNF
fn conv(t1: TermId, t2: TermId) -> bool {
    let w1 = whnf(t1);
    let w2 = whnf(t2);

    if w1 == w2 { return true; }

    match (arena.get(w1).kind, arena.get(w2).kind) {
        (Sort, Sort) => level_eq(w1.level(), w2.level()),
        (Pi, Pi) => conv(w1.dom(), w2.dom()) && conv(w1.cod(), w2.cod()),
        (Lam, Lam) => conv(w1.body(), w2.body()),
        (App, App) => conv(w1.func(), w2.func()) && conv(w1.arg(), w2.arg()),
        _ => false
    }
}
```

## Consequences

### Positive
- Sound type-theoretic foundation for AISP proofs
- Compatible with lean-agentic ecosystem
- Minimal memory footprint via arena allocation
- Predictable performance (no GC)

### Negative
- Limited to core type theory (no tactics)
- Fixed universe hierarchy depth
- No incremental type checking
- Manual term construction required

## Size Impact

| Component | Size |
|-----------|------|
| Term representation | 800 bytes |
| Type checker | 1.5KB |
| Conversion | 600 bytes |
| Universe levels | 400 bytes |
| **Subtotal** | **3.3KB** |

## References
- [lean-agentic typechecker module](https://docs.rs/lean-agentic)
- [Lean 4 Kernel](https://github.com/leanprover/lean4)
- [AISP Type Universe](../../../aisp-open-core-upstream/AI_GUIDE.md#Σ:Types)

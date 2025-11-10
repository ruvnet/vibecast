# agentic-jujutsu Rust Crate Issues

**Date:** 2025-11-10
**Crate Version:** 0.1.0
**Tested on:** Rust 1.91.0, Cargo 1.91.0

---

## ❌ CRITICAL: Crate Fails to Compile

The Rust crate published on crates.io **does not compile**. Installation via `cargo install agentic-jujutsu` fails with compilation errors.

### Status: 🔴 **BROKEN**

---

## Error Details

### Command Attempted:
```bash
cargo install agentic-jujutsu
```

### Compilation Error:
```
error[E0432]: unresolved imports `tokio::sync::mpsc`, `tokio::sync::RwLock`
 --> /root/.cargo/registry/src/.../agentic-jujutsu-0.1.0/src/mcp/sse.rs:8:19
  |
8 | use tokio::sync::{mpsc, RwLock};
  |                   ^^^^  ^^^^^^ no `RwLock` in `sync`
  |                   |
  |                   no `mpsc` in `sync`

error[E0603]: module `sync` is private
   --> /root/.cargo/registry/src/.../agentic-jujutsu-0.1.0/src/mcp/sse.rs:8:12
    |
  8 | use tokio::sync::{mpsc, RwLock};
    |            ^^^^ private module
```

---

## Root Cause

### Missing Tokio Feature Flag

**File:** `Cargo.toml`

**Current configuration:**
```toml
[dependencies.tokio]
version = "1.0"
features = [
    "rt",
    "rt-multi-thread",
    "process",
    "io-util",
    "time",
    "macros",
]
optional = true
```

**Problem:** The `"sync"` feature is **missing** from the tokio features list.

**Impact:** The code in `src/mcp/sse.rs:8` imports `tokio::sync::{mpsc, RwLock}`, but these types are not available because the `sync` feature is not enabled.

---

## The Fix

### Update Cargo.toml

Add `"sync"` to the tokio features:

```toml
[dependencies.tokio]
version = "1.0"
features = [
    "rt",
    "rt-multi-thread",
    "process",
    "io-util",
    "time",
    "macros",
    "sync",          # ← ADD THIS LINE
]
optional = true
```

### Also Consider Adding:

Since the code uses async channels and locks, you might also want:

```toml
[dependencies.tokio]
version = "1.0"
features = [
    "rt",
    "rt-multi-thread",
    "process",
    "io-util",
    "time",
    "macros",
    "sync",          # For RwLock, mpsc, etc.
    "fs",            # If file I/O is needed
    "net",           # If network I/O is needed
]
optional = true
```

---

## Affected Files

### `src/mcp/sse.rs`
Line 8 imports tokio sync primitives:
```rust
use tokio::sync::{mpsc, RwLock};
```

This file is part of the MCP (Model Context Protocol) implementation.

---

## Package Information

```
Name:          agentic-jujutsu
Version:       0.1.0
License:       MIT
Repository:    https://github.com/ruvnet/agentic-flow
Documentation: https://docs.rs/agentic-jujutsu
Homepage:      https://ruv.io
```

### Features Available:
- `default` = `[native]`
- `native` = `[tokio, async-process]`
- `wasm` = `[]`
- `cli` = `[clap, log, env_logger]`
- `mcp` = `[reqwest]`
- `mcp-full` = `[mcp, native]`

### Binary Targets:
- `jj-agent-hook` (requires features: `native`, `cli`)

---

## Testing Attempted

### 1. Installation Test ❌
```bash
cargo install agentic-jujutsu
```
**Result:** Compilation failed

### 2. Library Test ❌
```bash
cargo add agentic-jujutsu
```
**Result:** Would fail on build

### 3. Binary Test ❌
The `jj-agent-hook` binary cannot be installed because compilation fails.

---

## Comparison with npm Package

Both the **Rust crate** and the **npm package** have critical issues:

| Issue | Rust Crate | npm Package |
|-------|------------|-------------|
| **Compiles/Builds** | ❌ No | ❌ No (missing WASM) |
| **Missing Dependencies** | ✅ Tokio sync feature | ❌ WASM bindings |
| **CLI Works** | ❌ Can't install | ⚠️ Partial (7/16 cmds) |
| **Library Works** | ❌ Won't compile | ❌ Missing artifacts |
| **Published State** | 🔴 Broken | 🔴 Broken |

---

## Impact Assessment

### Severity: 🔴 **CRITICAL**

**Impact:**
- Cannot install the binary via `cargo install`
- Cannot use as a library dependency
- MCP features completely unavailable
- All async functionality broken

**Users Affected:**
- ✅ Anyone trying to install from crates.io
- ✅ Anyone trying to use as a library
- ✅ Anyone building from source (unless they manually fix Cargo.toml)

---

## Recommended Actions

### For Package Maintainers:

#### Immediate (Critical):
1. **Fix Cargo.toml**
   ```bash
   # Edit Cargo.toml to add "sync" feature
   # Test locally
   cargo build
   cargo test
   cargo install --path .
   ```

2. **Test Before Publishing**
   ```bash
   # Test all features
   cargo build --all-features
   cargo test --all-features

   # Test each feature combination
   cargo build --features native
   cargo build --features wasm
   cargo build --features cli
   cargo build --features mcp-full
   ```

3. **Publish Fixed Version**
   ```bash
   # Bump version
   cargo version patch  # 0.1.0 -> 0.1.1

   # Publish
   cargo publish
   ```

#### Short-term (High Priority):
4. **Add CI/CD Checks**
   - GitHub Actions workflow to test all features
   - Prevent publishing if tests fail
   - Test actual cargo install

5. **Add Documentation**
   - Update README with build requirements
   - Add troubleshooting section
   - Document all features

#### Long-term (Medium Priority):
6. **Improve Testing**
   - Add integration tests
   - Test MCP functionality
   - Add benchmark tests

### For Users:

**DO NOT USE version 0.1.0** - Wait for version 0.1.1+ with fixed dependencies.

**Workaround (if needed urgently):**
```bash
# Clone the repo
git clone https://github.com/ruvnet/agentic-flow
cd agentic-flow/packages/agentic-jujutsu

# Edit Cargo.toml manually to add "sync" feature
# Then build locally
cargo install --path .
```

---

## Additional Issues Found

### 1. Cargo.toml Normalized
The published Cargo.toml is auto-normalized by cargo, which can hide issues during development:
```toml
# THIS FILE IS AUTOMATICALLY GENERATED BY CARGO
#
# When uploading crates to the registry Cargo will automatically
# "normalize" Cargo.toml files for maximal compatibility
```

### 2. Missing Features in Dev Dependencies
The dev dependencies include `tokio` with `"full"` features, which masks the issue during testing:

```toml
[dev-dependencies.tokio]
version = "1.0"
features = [
    "full",      # This includes "sync", hiding the bug in tests!
    "test-util",
]
```

**This is why tests might pass locally but installation fails!**

---

## Testing Checklist for Next Release

Before publishing v0.1.1, verify:

### Build Tests:
- [ ] `cargo build` succeeds
- [ ] `cargo build --all-features` succeeds
- [ ] `cargo build --no-default-features` succeeds
- [ ] `cargo build --features native` succeeds
- [ ] `cargo build --features wasm` succeeds
- [ ] `cargo build --features cli` succeeds
- [ ] `cargo build --features mcp-full` succeeds

### Test Suite:
- [ ] `cargo test` passes
- [ ] `cargo test --all-features` passes
- [ ] `cargo clippy` has no warnings
- [ ] `cargo fmt --check` passes

### Installation Tests:
- [ ] Package locally: `cargo package`
- [ ] Test package: `cargo install --path .`
- [ ] Verify binary works: `jj-agent-hook --help`
- [ ] Uninstall: `cargo uninstall agentic-jujutsu`

### Integration Tests:
- [ ] Test as library dependency in new project
- [ ] Test MCP features
- [ ] Test WASM build (if applicable)

---

## Summary

The Rust crate has a **simple but critical bug**: a missing feature flag in `Cargo.toml`. This prevents the package from compiling and makes it completely unusable.

**Fix Time:** 5 minutes (just add one line)
**Testing Time:** 30 minutes (ensure it works)
**Total Time to Fix:** ~1 hour including publishing

The bug likely went unnoticed because:
1. Dev dependencies include `tokio` with `"full"` features
2. Tests passed locally with full tokio features
3. No CI/CD checks for actual `cargo install`

This is a **high-impact, low-effort fix** that should be addressed immediately.

---

## Files to Fix

1. **Cargo.toml** - Add `"sync"` to tokio features
2. **CI/CD** - Add cargo install test
3. **README** - Add build/install verification steps

---

**Report Generated:** 2025-11-10
**Tested By:** Claude Code Testing Agent

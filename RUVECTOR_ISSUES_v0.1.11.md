# Ruvector Issues Report - v0.1.11 / @ruvector/core v0.1.5

## Testing Date
November 25, 2025

## Summary
The CommonJS build (`index.cjs.js`) now exists ✅, but there are export/naming issues preventing the package from working.

---

## ✅ What Was Fixed
- **CommonJS build exists**: `node_modules/@ruvector/core/dist/index.cjs.js` is now present
- **Native bindings work**: The platform-specific packages load correctly
- **No more "file not found" errors**: The basic module structure is correct

---

## 🔴 Remaining Issues

### Issue 1: Export Name Mismatch (CRITICAL)

**Native Rust binding exports:** `VectorDb` (lowercase 'b')
**ESM wrapper expects:** `VectorDB` (uppercase 'B')

**Evidence:**
```bash
$ node --input-type=module -e "
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const nb = require('ruvector-core-linux-x64-gnu');
console.log('Exports:', Object.keys(nb));
"
# Output: [ 'hello', 'version', 'JsDistanceMetric', 'VectorDb' ]
#                                                     ^^^^^^^^
#                                                  lowercase 'b'
```

**Problem in `index.js` line 86:**
```javascript
export const VectorDB = nativeBinding.VectorDB;  // ❌ nativeBinding.VectorDB is undefined!
```

**Fix:**
```javascript
export const VectorDB = nativeBinding.VectorDb;  // ✅ Use lowercase 'b'
```

---

### Issue 2: CommonJS Exports Return Empty Object (CRITICAL)

**Symptom:**
```bash
$ node -e "const core = require('@ruvector/core'); console.log(Object.keys(core))"
[]  # ❌ Empty array!

$ node -e "const {VectorDB} = require('@ruvector/core'); console.log(VectorDB)"
undefined  # ❌ Cannot destructure
```

**Root Cause:**
In `index.cjs.js` line 80:
```javascript
module.exports = nativeBinding;
```

This doesn't make the native binding properties enumerable when using `module.exports` direct assignment.

**Fix in `index.cjs.js`:**
```javascript
// Replace line 80-84 with:
module.exports = {
  VectorDb: nativeBinding.VectorDb,
  VectorDB: nativeBinding.VectorDb,  // Alias for consistency
  hello: nativeBinding.hello,
  version: nativeBinding.version,
  JsDistanceMetric: nativeBinding.JsDistanceMetric,
  DistanceMetric: DistanceMetric
};

module.exports.default = module.exports;
```

---

### Issue 3: ruvector Wrapper Still Fails

**Symptom:**
```bash
$ npx ruvector info
Error: Failed to load ruvector. Please run: npm run build
```

**Root Cause:**
The `ruvector` package (wrapper) tries to load from `@ruvector/core`, but due to Issues 1 & 2, it gets `undefined` for VectorDB.

**In `node_modules/ruvector/dist/index.js` lines 11-18:**
```javascript
try {
  const ruvector = require('../dist/index.js');
  VectorDB = ruvector.VectorDB;  // ❌ This is undefined!
  // ...
} catch (e) {
  console.error(chalk.red('Error: Failed to load ruvector...'));
  process.exit(1);
}
```

**Fix:**
This will be automatically fixed once Issues 1 & 2 are resolved in `@ruvector/core`.

---

## 🧪 Test Results

### Native Binding Tests ✅
```bash
$ node -e "const nb = require('ruvector-core-linux-x64-gnu'); console.log(typeof nb.VectorDb)"
function  # ✅ Works!

$ node -e "const nb = require('ruvector-core-linux-x64-gnu'); console.log(nb.version())"
0.1.3  # ✅ Works!
```

### ESM Import Tests ⚠️
```bash
$ node --input-type=module -e "import {VectorDB} from '@ruvector/core'; console.log(VectorDB)"
undefined  # ❌ Fails due to name mismatch

$ node --input-type=module -e "import * as core from '@ruvector/core'; console.log(Object.keys(core.default))"
[ 'VectorDB', 'version', 'hello', 'DistanceMetric' ]  # Shows intent but VectorDB is undefined
```

### CommonJS Require Tests ❌
```bash
$ node -e "const core = require('@ruvector/core'); console.log(Object.keys(core))"
[]  # ❌ Empty!

$ node -e "const {VectorDB} = require('@ruvector/core'); console.log(VectorDB)"
undefined  # ❌ Cannot destructure
```

### CLI Tests ❌
```bash
$ npx ruvector info
Error: Failed to load ruvector. Please run: npm run build  # ❌ Fails
```

---

## 🔧 Complete Fix Summary

### File: `@ruvector/core/src/index.ts` (or index.js)
**Line 86:**
```typescript
// Before:
export const VectorDB = nativeBinding.VectorDB;

// After:
export const VectorDB = nativeBinding.VectorDb;  // Match native export name
```

### File: `@ruvector/core/src/index.cjs.ts` (or index.cjs.js)
**Lines 78-84:**
```typescript
// Before:
const nativeBinding = loadNativeBinding();
module.exports = nativeBinding;
module.exports.default = nativeBinding;
module.exports.DistanceMetric = DistanceMetric;

// After:
const nativeBinding = loadNativeBinding();

// Explicitly export everything
module.exports = {
  VectorDb: nativeBinding.VectorDb,
  VectorDB: nativeBinding.VectorDb,  // Alias for consistency
  hello: nativeBinding.hello,
  version: nativeBinding.version,
  JsDistanceMetric: nativeBinding.JsDistanceMetric,
  DistanceMetric: DistanceMetric
};

module.exports.default = module.exports;
```

---

## 💡 Alternative Solution: Fix Rust Export Name

Instead of changing JS wrappers, change the Rust export to use `VectorDB` (uppercase):

**In Rust source:**
```rust
// Before:
#[napi(js_name = "VectorDb")]
pub struct VectorDb { ... }

// After:
#[napi(js_name = "VectorDB")]
pub struct VectorDb { ... }
```

This would make JS wrappers work as-is, but requires rebuilding native bindings.

---

## ✅ Expected Behavior After Fixes

```bash
# ESM import should work
$ node --input-type=module -e "import {VectorDB} from '@ruvector/core'; console.log(typeof VectorDB)"
function  # ✅

# CommonJS require should work
$ node -e "const {VectorDB} = require('@ruvector/core'); console.log(typeof VectorDB)"
function  # ✅

# CLI should work
$ npx ruvector info
ruvector Information
  Version: 0.1.11
  Implementation: native
  Node Version: v22.21.1
  Platform: linux
  Architecture: x64
# ✅
```

---

## 📦 Tested Versions
- `ruvector`: 0.1.11
- `@ruvector/core`: 0.1.5
- `ruvector-core-linux-x64-gnu`: 0.1.3
- Node.js: v22.21.1
- Platform: linux-x64

---

## 🎯 Priority

**P0 (Critical):**
- Issue 1: Export name mismatch prevents all usage
- Issue 2: CommonJS exports broken prevents require() usage

**P1 (High):**
- Issue 3: CLI doesn't work (depends on P0 fixes)

---

## 📝 Notes

The overall architecture is sound now:
- ✅ CJS build exists
- ✅ ESM build exists
- ✅ Native bindings load correctly
- ✅ Platform detection works
- ✅ Dual package structure correct

Just need to fix the export mapping between native Rust module and JS wrappers!

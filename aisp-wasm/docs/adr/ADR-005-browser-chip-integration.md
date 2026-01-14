# ADR-005: Browser and Chip Integration Architecture

## Status
Accepted

## Date
2026-01-14

## Context
The AISP WASM kernel must run in two distinct environments:
1. Web browsers via JavaScript/TypeScript
2. Embedded chips via direct memory-mapped I/O

## Decision
Design a unified C-ABI interface that works for both targets.

### Unified Export Interface

```rust
/// Core AISP validation API (C-ABI compatible)
#[no_mangle]
pub extern "C" fn aisp_init() -> i32 {
    // Returns: 0=success, <0=error code
    unsafe { ARENA.reset(); }
    0
}

#[no_mangle]
pub extern "C" fn aisp_parse(ptr: *const u8, len: u32) -> i32 {
    // Parse AISP document from memory
    // Returns: document ID or error code
    let input = unsafe { core::slice::from_raw_parts(ptr, len as usize) };
    parse_document(input).unwrap_or(-1)
}

#[no_mangle]
pub extern "C" fn aisp_validate(doc_id: i32) -> i32 {
    // Type-check document
    // Returns: 0=valid, <0=error code
    validate_document(doc_id as u16)
}

#[no_mangle]
pub extern "C" fn aisp_tier(doc_id: i32) -> i32 {
    // Get quality tier
    // Returns: 0=⊘, 1=◊⁻, 2=◊, 3=◊⁺, 4=◊⁺⁺
    compute_tier(doc_id as u16) as i32
}

#[no_mangle]
pub extern "C" fn aisp_ambig(doc_id: i32) -> f32 {
    // Get ambiguity score [0.0, 1.0]
    compute_ambiguity(doc_id as u16)
}

#[no_mangle]
pub extern "C" fn aisp_density(doc_id: i32) -> f32 {
    // Get density score δ [0.0, 1.0]
    compute_density(doc_id as u16)
}

#[no_mangle]
pub extern "C" fn aisp_error_code() -> i32 {
    // Get last error code
    unsafe { LAST_ERROR }
}

#[no_mangle]
pub extern "C" fn aisp_error_offset() -> u32 {
    // Get error position in input
    unsafe { ERROR_OFFSET }
}
```

### Browser Integration (JavaScript)

```javascript
// aisp-loader.js - Minimal loader (< 1KB minified)
const AISP = {
    _instance: null,
    _memory: null,

    async init(wasmUrl = '/aisp.wasm') {
        const response = await fetch(wasmUrl);
        const bytes = await response.arrayBuffer();
        const { instance } = await WebAssembly.instantiate(bytes, {
            env: { host_alloc: this._alloc.bind(this) }
        });
        this._instance = instance.exports;
        this._memory = new Uint8Array(instance.exports.memory.buffer);
        return this._instance.aisp_init();
    },

    validate(aispSource) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(aispSource);
        const ptr = 0x1000; // Parse buffer offset
        this._memory.set(bytes, ptr);

        const docId = this._instance.aisp_parse(ptr, bytes.length);
        if (docId < 0) return { valid: false, error: docId };

        const result = this._instance.aisp_validate(docId);
        return {
            valid: result === 0,
            tier: ['⊘', '◊⁻', '◊', '◊⁺', '◊⁺⁺'][this._instance.aisp_tier(docId)],
            ambiguity: this._instance.aisp_ambig(docId),
            density: this._instance.aisp_density(docId),
        };
    },

    _alloc(size, align) {
        // Simple bump allocator for browser
        const aligned = (this._allocPtr + align - 1) & ~(align - 1);
        this._allocPtr = aligned + size;
        return aligned;
    },
    _allocPtr: 0x2000,
};

export default AISP;
```

### Chip Integration (C Header)

```c
// aisp.h - Chip integration header
#ifndef AISP_H
#define AISP_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Initialize AISP kernel
int32_t aisp_init(void);

// Parse AISP document from memory
int32_t aisp_parse(const uint8_t* ptr, uint32_t len);

// Validate parsed document
int32_t aisp_validate(int32_t doc_id);

// Get quality tier (0-4)
int32_t aisp_tier(int32_t doc_id);

// Get ambiguity score
float aisp_ambig(int32_t doc_id);

// Get density score
float aisp_density(int32_t doc_id);

// Error handling
int32_t aisp_error_code(void);
uint32_t aisp_error_offset(void);

// Tier constants
#define AISP_TIER_REJECT    0  // ⊘
#define AISP_TIER_BRONZE    1  // ◊⁻
#define AISP_TIER_SILVER    2  // ◊
#define AISP_TIER_GOLD      3  // ◊⁺
#define AISP_TIER_PLATINUM  4  // ◊⁺⁺

// Error codes
#define AISP_OK             0
#define AISP_ERR_PARSE     -1
#define AISP_ERR_TYPE      -2
#define AISP_ERR_AMBIG     -3
#define AISP_ERR_MEMORY    -4
#define AISP_ERR_OVERFLOW  -5

#ifdef __cplusplus
}
#endif

#endif // AISP_H
```

### ESP32 Example

```c
// main.c - ESP32 integration example
#include "aisp.h"
#include "esp_log.h"

static const char* TAG = "AISP";

void validate_agent_spec(const char* spec, size_t len) {
    aisp_init();

    int32_t doc = aisp_parse((const uint8_t*)spec, len);
    if (doc < 0) {
        ESP_LOGE(TAG, "Parse error at offset %u", aisp_error_offset());
        return;
    }

    if (aisp_validate(doc) == AISP_OK) {
        int32_t tier = aisp_tier(doc);
        float delta = aisp_density(doc);
        ESP_LOGI(TAG, "Valid: tier=%d, δ=%.2f", tier, delta);
    } else {
        ESP_LOGW(TAG, "Validation failed: %d", aisp_error_code());
    }
}
```

## Memory Map by Platform

### Browser (WASM)
```
0x0000-0x17FF: Working memory (6KB)
0x1800-0x1FFF: Heap growth zone
WASM memory: min 1 page (64KB), growable
```

### ESP32
```
IRAM: AISP WASM (8KB flash-resident)
DRAM: Working memory at fixed address
Use DMA for input streaming
```

### RP2040
```
Flash XIP: AISP WASM at 0x10000000
SRAM: Arena at 0x20000000
Use PIO for parallel input
```

## Consequences

### Positive
- Single codebase for all platforms
- Simple C-ABI, no marshaling
- Direct memory access, no copies
- Portable across chip architectures

### Negative
- No async support in core
- Fixed buffer sizes
- Platform-specific loader needed
- Manual memory coordination

## References
- [WASM C API](https://github.com/WebAssembly/wasm-c-api)
- [ESP32 WASM runtime](https://github.com/aspect-build/aspect-cli)
- [WebAssembly.instantiate](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/instantiate)

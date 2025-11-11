//! # LangGraph WASM
//!
//! WebAssembly bindings for LangGraph with JavaScript interop.
//! Target: <200KB gzipped, <50ms startup time.

use wasm_bindgen::prelude::*;
use langgraph_core::{State, StateGraph, NodeExecutor, Graph};
use langgraph_checkpoint::{MemoryCheckpointer, Checkpoint, CheckpointConfig};
use std::sync::Arc;
use std::collections::HashMap;

mod utils;
mod state;
mod graph;
mod checkpoint;

pub use state::WasmState;
pub use graph::{WasmGraph, WasmGraphBuilder};
pub use checkpoint::WasmCheckpointer;

/// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn init() {
    utils::set_panic_hook();
    utils::init_logging();
}

/// Get the version of the library
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_version() {
        let v = version();
        assert!(!v.is_empty());
    }
}

//! WASM bindings for Checkpointer

use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use langgraph_checkpoint::{MemoryCheckpointer, Checkpointer, Checkpoint, CheckpointConfig};
use crate::state::WasmState;
use std::sync::{Arc, Mutex};

/// WASM wrapper for Checkpointer
#[wasm_bindgen]
pub struct WasmCheckpointer {
    inner: Arc<Mutex<MemoryCheckpointer>>,
}

#[wasm_bindgen]
impl WasmCheckpointer {
    /// Create a new memory checkpointer
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(MemoryCheckpointer::new())),
        }
    }

    /// Save a checkpoint (returns a Promise with the checkpoint ID)
    #[wasm_bindgen]
    pub fn save(&self, state: WasmState, thread_id: Option<String>) -> js_sys::Promise {
        let checkpointer = self.inner.clone();
        let state = state.into_inner();

        future_to_promise(async move {
            let checkpoint = Checkpoint::new(state);
            let checkpoint_id = checkpoint.id.clone();

            let config = CheckpointConfig {
                thread_id,
                ..Default::default()
            };

            let cp = checkpointer.lock().unwrap();
            cp.put(checkpoint, config).await
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            drop(cp); // Release lock before await points

            Ok(JsValue::from_str(&checkpoint_id))
        })
    }

    /// Get a checkpoint by ID (returns a Promise)
    #[wasm_bindgen]
    pub fn get(&self, checkpoint_id: String) -> js_sys::Promise {
        let checkpointer = self.inner.clone();

        future_to_promise(async move {
            let result = {
                let cp = checkpointer.lock().unwrap();
                cp.get_tuple(&checkpoint_id).await
                    .map_err(|e| JsValue::from_str(&e.to_string()))?
            };

            match result {
                Some(tuple) => {
                    let wasm_state = WasmState::from_inner(tuple.checkpoint.state);
                    serde_wasm_bindgen::to_value(&wasm_state)
                        .map_err(|e| JsValue::from_str(&e.to_string()))
                }
                None => Ok(JsValue::NULL),
            }
        })
    }

    /// List checkpoints for a thread (returns a Promise)
    #[wasm_bindgen]
    pub fn list(&self, thread_id: String, limit: Option<usize>) -> js_sys::Promise {
        let checkpointer = self.inner.clone();

        future_to_promise(async move {
            let checkpoints = {
                let cp = checkpointer.lock().unwrap();
                cp.list(&thread_id, limit).await
                    .map_err(|e| JsValue::from_str(&e.to_string()))?
            };

            let ids: Vec<String> = checkpoints.iter().map(|c| c.checkpoint.id.clone()).collect();
            serde_wasm_bindgen::to_value(&ids)
                .map_err(|e| JsValue::from_str(&e.to_string()))
        })
    }

    /// Delete a checkpoint (returns a Promise)
    #[wasm_bindgen]
    pub fn delete(&self, checkpoint_id: String) -> js_sys::Promise {
        let checkpointer = self.inner.clone();

        future_to_promise(async move {
            {
                let cp = checkpointer.lock().unwrap();
                cp.delete(&checkpoint_id).await
                    .map_err(|e| JsValue::from_str(&e.to_string()))?;
            }

            Ok(JsValue::UNDEFINED)
        })
    }

    /// Delete all checkpoints for a thread (returns a Promise)
    #[wasm_bindgen(js_name = deleteThread)]
    pub fn delete_thread(&self, thread_id: String) -> js_sys::Promise {
        let checkpointer = self.inner.clone();

        future_to_promise(async move {
            {
                let cp = checkpointer.lock().unwrap();
                cp.delete_thread(&thread_id).await
                    .map_err(|e| JsValue::from_str(&e.to_string()))?;
            }

            Ok(JsValue::UNDEFINED)
        })
    }

    /// Get the number of stored checkpoints
    #[wasm_bindgen]
    pub fn size(&self) -> js_sys::Promise {
        let checkpointer = self.inner.clone();

        future_to_promise(async move {
            let len = {
                let cp = checkpointer.lock().unwrap();
                cp.len()
            };
            Ok(JsValue::from_f64(len as f64))
        })
    }

    /// Clear all checkpoints
    #[wasm_bindgen]
    pub fn clear(&self) -> js_sys::Promise {
        let checkpointer = self.inner.clone();

        future_to_promise(async move {
            {
                let cp = checkpointer.lock().unwrap();
                cp.clear();
            }
            Ok(JsValue::UNDEFINED)
        })
    }
}

impl Default for WasmCheckpointer {
    fn default() -> Self {
        Self::new()
    }
}

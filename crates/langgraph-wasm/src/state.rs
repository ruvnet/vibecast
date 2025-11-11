//! WASM bindings for State

use wasm_bindgen::prelude::*;
use langgraph_core::State;
use serde::{Deserialize, Serialize};

/// WASM wrapper for State
#[wasm_bindgen]
pub struct WasmState {
    inner: State,
}

#[wasm_bindgen]
impl WasmState {
    /// Create a new empty state
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: State::new(),
        }
    }

    /// Create a state from a JavaScript object
    #[wasm_bindgen(js_name = fromObject)]
    pub fn from_object(obj: JsValue) -> Result<WasmState, JsValue> {
        let data: std::collections::HashMap<String, serde_json::Value> =
            serde_wasm_bindgen::from_value(obj)
                .map_err(|e| JsValue::from_str(&format!("Failed to parse state: {}", e)))?;

        Ok(Self {
            inner: State::from_map(data),
        })
    }

    /// Get a value from the state
    #[wasm_bindgen]
    pub fn get(&self, key: &str) -> JsValue {
        match self.inner.get(key) {
            Some(value) => serde_wasm_bindgen::to_value(value).unwrap_or(JsValue::NULL),
            None => JsValue::NULL,
        }
    }

    /// Set a value in the state
    #[wasm_bindgen]
    pub fn set(&mut self, key: String, value: JsValue) -> Result<(), JsValue> {
        let json_value: serde_json::Value = serde_wasm_bindgen::from_value(value)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize value: {}", e)))?;

        self.inner.set(key, json_value);
        Ok(())
    }

    /// Remove a value from the state
    #[wasm_bindgen]
    pub fn remove(&mut self, key: &str) -> JsValue {
        match self.inner.remove(key) {
            Some(value) => serde_wasm_bindgen::to_value(&value).unwrap_or(JsValue::NULL),
            None => JsValue::NULL,
        }
    }

    /// Check if a key exists
    #[wasm_bindgen]
    pub fn has(&self, key: &str) -> bool {
        self.inner.contains_key(key)
    }

    /// Get all keys
    #[wasm_bindgen]
    pub fn keys(&self) -> Vec<String> {
        self.inner.keys().cloned().collect()
    }

    /// Get the number of entries
    #[wasm_bindgen]
    pub fn size(&self) -> usize {
        self.inner.len()
    }

    /// Convert to a JavaScript object
    #[wasm_bindgen(js_name = toObject)]
    pub fn to_object(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.inner.data).unwrap_or(JsValue::NULL)
    }

    /// Convert to JSON string
    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json(&self) -> String {
        serde_json::to_string(&self.inner).unwrap_or_else(|_| "{}".to_string())
    }
}

impl WasmState {
    pub(crate) fn inner(&self) -> &State {
        &self.inner
    }

    pub(crate) fn inner_mut(&mut self) -> &mut State {
        &mut self.inner
    }

    pub(crate) fn from_inner(state: State) -> Self {
        Self { inner: state }
    }

    pub(crate) fn into_inner(self) -> State {
        self.inner
    }
}

impl Serialize for WasmState {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        self.inner.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for WasmState {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        State::deserialize(deserializer).map(|state| WasmState { inner: state })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_wasm_state() {
        let mut state = WasmState::new();
        assert_eq!(state.size(), 0);

        let value = JsValue::from_str("test");
        state.set("key".to_string(), value).unwrap();
        assert_eq!(state.size(), 1);
        assert!(state.has("key"));
    }
}

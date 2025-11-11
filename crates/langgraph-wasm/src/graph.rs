//! WASM bindings for Graph

use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use langgraph_core::{StateGraph, NodeExecutor, Graph as CoreGraph};
use crate::state::WasmState;
use std::sync::{Arc, Mutex};
use js_sys::Function;

/// WASM wrapper for StateGraph
#[wasm_bindgen]
pub struct WasmGraph {
    inner: Arc<Mutex<StateGraph>>,
    compiled: bool,
}

#[wasm_bindgen]
impl WasmGraph {
    /// Create a new graph
    #[wasm_bindgen(constructor)]
    pub fn new(name: String) -> Self {
        Self {
            inner: Arc::new(Mutex::new(StateGraph::new(name))),
            compiled: false,
        }
    }

    /// Add a node with a JavaScript function
    #[wasm_bindgen(js_name = addNode)]
    pub fn add_node(&mut self, name: String, func: Function) -> Result<(), JsValue> {
        let func = Arc::new(func);

        let node = NodeExecutor::new(name.clone(), move |state| {
            let func = func.clone();
            async move {
                let wasm_state = WasmState::from_inner(state);
                let js_state = serde_wasm_bindgen::to_value(&wasm_state)
                    .map_err(|e| langgraph_core::Error::ExecutionError(e.to_string()))?;

                let this = JsValue::NULL;
                let result = func.call1(&this, &js_state)
                    .map_err(|e| langgraph_core::Error::ExecutionError(format!("{:?}", e)))?;

                // Handle both sync and async results
                let result = if result.is_instance_of::<js_sys::Promise>() {
                    let promise = js_sys::Promise::from(result);
                    wasm_bindgen_futures::JsFuture::from(promise)
                        .await
                        .map_err(|e| langgraph_core::Error::ExecutionError(format!("{:?}", e)))?
                } else {
                    result
                };

                let result_state: WasmState = serde_wasm_bindgen::from_value(result)
                    .map_err(|e| langgraph_core::Error::ExecutionError(e.to_string()))?;

                Ok(result_state.into_inner())
            }
        });

        let mut graph = self.inner.lock().unwrap();
        graph.add_node(node)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        self.compiled = false;
        Ok(())
    }

    /// Add an edge between two nodes
    #[wasm_bindgen(js_name = addEdge)]
    pub fn add_edge(&mut self, from: String, to: String) -> Result<(), JsValue> {
        let mut graph = self.inner.lock().unwrap();
        graph.add_edge(from, to)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        self.compiled = false;
        Ok(())
    }

    /// Set the entry point
    #[wasm_bindgen(js_name = setEntryPoint)]
    pub fn set_entry_point(&mut self, node: String) -> Result<(), JsValue> {
        let mut graph = self.inner.lock().unwrap();
        graph.set_entry_point(node)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        self.compiled = false;
        Ok(())
    }

    /// Add an exit point
    #[wasm_bindgen(js_name = addExitPoint)]
    pub fn add_exit_point(&mut self, node: String) -> Result<(), JsValue> {
        let mut graph = self.inner.lock().unwrap();
        graph.add_exit_point(node)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        self.compiled = false;
        Ok(())
    }

    /// Compile the graph
    #[wasm_bindgen]
    pub fn compile(&mut self) -> Result<(), JsValue> {
        let mut graph = self.inner.lock().unwrap();
        graph.compile()
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        self.compiled = true;
        Ok(())
    }

    /// Execute the graph (returns a Promise)
    #[wasm_bindgen]
    pub fn execute(&self, initial_state: WasmState) -> js_sys::Promise {
        let graph = self.inner.clone();
        let state = initial_state.into_inner();

        future_to_promise(async move {
            let graph = graph.lock().unwrap();
            let result = graph.execute(state).await
                .map_err(|e| JsValue::from_str(&e.to_string()))?;

            let wasm_state = WasmState::from_inner(result);
            serde_wasm_bindgen::to_value(&wasm_state)
                .map_err(|e| JsValue::from_str(&e.to_string()))
        })
    }

    /// Check if the graph is compiled
    #[wasm_bindgen(js_name = isCompiled)]
    pub fn is_compiled(&self) -> bool {
        self.compiled
    }
}

/// Builder for constructing graphs in WASM
#[wasm_bindgen]
pub struct WasmGraphBuilder {
    graph: WasmGraph,
}

#[wasm_bindgen]
impl WasmGraphBuilder {
    /// Create a new graph builder
    #[wasm_bindgen(constructor)]
    pub fn new(name: String) -> Self {
        Self {
            graph: WasmGraph::new(name),
        }
    }

    /// Add a node
    #[wasm_bindgen(js_name = addNode)]
    pub fn add_node(&mut self, name: String, func: Function) -> Result<(), JsValue> {
        self.graph.add_node(name, func)
    }

    /// Add an edge
    #[wasm_bindgen(js_name = addEdge)]
    pub fn add_edge(&mut self, from: String, to: String) -> Result<(), JsValue> {
        self.graph.add_edge(from, to)
    }

    /// Set entry point
    #[wasm_bindgen(js_name = entryPoint)]
    pub fn entry_point(&mut self, node: String) -> Result<(), JsValue> {
        self.graph.set_entry_point(node)
    }

    /// Add exit point
    #[wasm_bindgen(js_name = exitPoint)]
    pub fn exit_point(&mut self, node: String) -> Result<(), JsValue> {
        self.graph.add_exit_point(node)
    }

    /// Build and compile the graph
    #[wasm_bindgen]
    pub fn build(mut self) -> Result<WasmGraph, JsValue> {
        self.graph.compile()?;
        Ok(self.graph)
    }
}

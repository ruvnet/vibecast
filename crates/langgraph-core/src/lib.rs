//! # LangGraph Core
//!
//! Core graph execution engine for LangGraph Rust/WASM implementation.
//! Provides StateGraph and MessageGraph with 100% API compatibility with LangGraph Python.

pub mod error;
pub mod graph;
pub mod node;
pub mod state;
pub mod reducer;
pub mod message;

pub use error::{Error, Result};
pub use graph::{Graph, StateGraph, MessageGraph, GraphBuilder};
pub use node::{Node, NodeExecutor};
pub use state::{State, StateSchema};
pub use reducer::Reducer;
pub use message::{Message, MessageList};

/// Prelude module for convenient imports
pub mod prelude {
    pub use crate::{
        Error, Result,
        Graph, StateGraph, MessageGraph, GraphBuilder,
        Node, NodeExecutor,
        State, StateSchema,
        Reducer,
        Message, MessageList,
    };
}

//! # LangGraph AgentDB
//!
//! AgentDB integration with HNSW vector indexing for semantic search and pattern storage.
//! Provides sub-millisecond checkpoint saves with 384-dimensional embeddings.

pub mod error;
pub mod agentdb;
pub mod patterns;
pub mod reflexion;
pub mod embeddings;

pub use error::{Error, Result};
pub use agentdb::AgentDbCheckpointer;
pub use patterns::{Pattern, PatternStore, SqlitePatternStore};
pub use reflexion::ReflexionMemory;
pub use embeddings::{EmbeddingModel, MockEmbeddingModel};

/// Prelude module for convenient imports
pub mod prelude {
    pub use crate::{
        Error, Result,
        AgentDbCheckpointer,
        Pattern, PatternStore, SqlitePatternStore,
        ReflexionMemory,
        EmbeddingModel, MockEmbeddingModel,
    };
}

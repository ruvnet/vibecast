//! Error types for AgentDB operations

use thiserror::Error;

/// Result type alias for AgentDB operations
pub type Result<T> = std::result::Result<T, Error>;

/// Error types for AgentDB operations
#[derive(Error, Debug)]
pub enum Error {
    #[error("Pattern not found: {0}")]
    PatternNotFound(String),

    #[error("Invalid embedding dimension: expected {expected}, got {actual}")]
    InvalidEmbeddingDimension { expected: usize, actual: usize },

    #[error("Vector index error: {0}")]
    VectorIndexError(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error(transparent)]
    Checkpoint(#[from] langgraph_checkpoint::Error),

    #[error(transparent)]
    Core(#[from] langgraph_core::Error),

    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),

    #[error(transparent)]
    Json(#[from] serde_json::Error),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

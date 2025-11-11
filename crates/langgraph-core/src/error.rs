//! Error types for LangGraph core operations

use thiserror::Error;

/// Result type alias for LangGraph operations
pub type Result<T> = std::result::Result<T, Error>;

/// Error types for LangGraph operations
#[derive(Error, Debug)]
pub enum Error {
    #[error("Node not found: {0}")]
    NodeNotFound(String),

    #[error("Edge not found: {0} -> {1}")]
    EdgeNotFound(String, String),

    #[error("Cycle detected in graph")]
    CycleDetected,

    #[error("Invalid state: {0}")]
    InvalidState(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Json(#[from] serde_json::Error),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

//! Error types for checkpoint operations

use thiserror::Error;

/// Result type alias for checkpoint operations
pub type Result<T> = std::result::Result<T, Error>;

/// Error types for checkpoint operations
#[derive(Error, Debug)]
pub enum Error {
    #[error("Checkpoint not found: {0}")]
    CheckpointNotFound(String),

    #[error("Invalid checkpoint: {0}")]
    InvalidCheckpoint(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error(transparent)]
    Core(#[from] langgraph_core::Error),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Json(#[from] serde_json::Error),

    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

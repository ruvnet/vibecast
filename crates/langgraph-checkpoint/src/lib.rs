//! # LangGraph Checkpoint
//!
//! Checkpointing infrastructure for state persistence with multiple backends.
//! Supports memory, SQLite, and AgentDB backends with sub-millisecond performance.

pub mod error;
pub mod checkpoint;
pub mod memory;
pub mod sqlite;

pub use error::{Error, Result};
pub use checkpoint::{Checkpoint, CheckpointConfig, CheckpointTuple, Checkpointer, PendingWrite};
pub use memory::MemoryCheckpointer;
pub use sqlite::SqliteCheckpointer;

/// Prelude module for convenient imports
pub mod prelude {
    pub use crate::{
        Error, Result,
        Checkpoint, CheckpointConfig, CheckpointTuple, Checkpointer, PendingWrite,
        MemoryCheckpointer, SqliteCheckpointer,
    };
}

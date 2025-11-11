//! Core checkpoint types and traits

use crate::{Error, Result};
use async_trait::async_trait;
use langgraph_core::State;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A checkpoint of graph state at a point in time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    /// Unique identifier for this checkpoint
    pub id: String,

    /// The state at this checkpoint
    pub state: State,

    /// Parent checkpoint ID (if any)
    pub parent_id: Option<String>,

    /// Timestamp of checkpoint creation
    pub timestamp: chrono::DateTime<chrono::Utc>,

    /// Additional metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

impl Checkpoint {
    /// Create a new checkpoint
    pub fn new(state: State) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            state,
            parent_id: None,
            timestamp: chrono::Utc::now(),
            metadata: HashMap::new(),
        }
    }

    /// Create a checkpoint with a parent
    pub fn with_parent(state: State, parent_id: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            state,
            parent_id: Some(parent_id),
            timestamp: chrono::Utc::now(),
            metadata: HashMap::new(),
        }
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: String, value: serde_json::Value) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

/// A tuple containing checkpoint and its metadata for retrieval
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointTuple {
    /// The checkpoint
    pub checkpoint: Checkpoint,

    /// Configuration used for this checkpoint
    pub config: HashMap<String, serde_json::Value>,

    /// Pending writes that haven't been committed
    pub pending_writes: Vec<PendingWrite>,
}

/// A pending write operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingWrite {
    /// Key to write
    pub key: String,

    /// Value to write
    pub value: serde_json::Value,

    /// Timestamp of the write
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl PendingWrite {
    /// Create a new pending write
    pub fn new(key: String, value: serde_json::Value) -> Self {
        Self {
            key,
            value,
            timestamp: chrono::Utc::now(),
        }
    }
}

/// Configuration for checkpoint operations
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CheckpointConfig {
    /// Thread/session identifier
    pub thread_id: Option<String>,

    /// Checkpoint identifier
    pub checkpoint_id: Option<String>,

    /// Additional configuration
    pub config: HashMap<String, serde_json::Value>,
}

/// Trait for checkpoint persistence backends
#[async_trait]
pub trait Checkpointer: Send + Sync {
    /// Save a checkpoint
    async fn put(&self, checkpoint: Checkpoint, config: CheckpointConfig) -> Result<()>;

    /// Get a checkpoint tuple by ID
    async fn get_tuple(&self, checkpoint_id: &str) -> Result<Option<CheckpointTuple>>;

    /// List checkpoints for a thread/session
    async fn list(&self, thread_id: &str, limit: Option<usize>) -> Result<Vec<CheckpointTuple>>;

    /// Get the latest checkpoint for a thread
    async fn get_latest(&self, thread_id: &str) -> Result<Option<CheckpointTuple>> {
        let checkpoints = self.list(thread_id, Some(1)).await?;
        Ok(checkpoints.into_iter().next())
    }

    /// Delete a checkpoint
    async fn delete(&self, checkpoint_id: &str) -> Result<()>;

    /// Delete all checkpoints for a thread
    async fn delete_thread(&self, thread_id: &str) -> Result<()>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checkpoint_creation() {
        let state = State::new();
        let checkpoint = Checkpoint::new(state);
        assert!(!checkpoint.id.is_empty());
        assert!(checkpoint.parent_id.is_none());
    }

    #[test]
    fn test_checkpoint_with_parent() {
        let state = State::new();
        let parent_id = "parent-123".to_string();
        let checkpoint = Checkpoint::with_parent(state, parent_id.clone());
        assert_eq!(checkpoint.parent_id, Some(parent_id));
    }

    #[test]
    fn test_checkpoint_with_metadata() {
        let state = State::new();
        let checkpoint = Checkpoint::new(state)
            .with_metadata("key".to_string(), serde_json::json!("value"));
        assert_eq!(checkpoint.metadata.get("key"), Some(&serde_json::json!("value")));
    }
}

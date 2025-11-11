//! In-memory checkpoint backend

use crate::{Checkpoint, CheckpointConfig, CheckpointTuple, Checkpointer, Error, Result};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// In-memory checkpointer for testing and development
#[derive(Debug, Clone)]
pub struct MemoryCheckpointer {
    /// Storage for checkpoints
    storage: Arc<RwLock<MemoryStorage>>,
}

#[derive(Debug, Default)]
struct MemoryStorage {
    /// Checkpoints indexed by ID
    checkpoints: HashMap<String, CheckpointTuple>,

    /// Thread-to-checkpoint mapping
    thread_index: HashMap<String, Vec<String>>,
}

impl MemoryCheckpointer {
    /// Create a new memory checkpointer
    pub fn new() -> Self {
        Self {
            storage: Arc::new(RwLock::new(MemoryStorage::default())),
        }
    }

    /// Get the number of stored checkpoints
    pub fn len(&self) -> usize {
        self.storage.read().unwrap().checkpoints.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Clear all checkpoints
    pub fn clear(&self) {
        let mut storage = self.storage.write().unwrap();
        storage.checkpoints.clear();
        storage.thread_index.clear();
    }
}

impl Default for MemoryCheckpointer {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Checkpointer for MemoryCheckpointer {
    async fn put(&self, checkpoint: Checkpoint, config: CheckpointConfig) -> Result<()> {
        let mut storage = self.storage.write().unwrap();

        let checkpoint_id = checkpoint.id.clone();
        let thread_id = config.thread_id.clone().unwrap_or_else(|| "default".to_string());

        let tuple = CheckpointTuple {
            checkpoint,
            config: config.config,
            pending_writes: Vec::new(),
        };

        storage.checkpoints.insert(checkpoint_id.clone(), tuple);

        // Update thread index
        storage
            .thread_index
            .entry(thread_id)
            .or_insert_with(Vec::new)
            .push(checkpoint_id);

        Ok(())
    }

    async fn get_tuple(&self, checkpoint_id: &str) -> Result<Option<CheckpointTuple>> {
        let storage = self.storage.read().unwrap();
        Ok(storage.checkpoints.get(checkpoint_id).cloned())
    }

    async fn list(&self, thread_id: &str, limit: Option<usize>) -> Result<Vec<CheckpointTuple>> {
        let storage = self.storage.read().unwrap();

        let checkpoint_ids = storage
            .thread_index
            .get(thread_id)
            .cloned()
            .unwrap_or_default();

        let mut checkpoints: Vec<CheckpointTuple> = checkpoint_ids
            .iter()
            .filter_map(|id| storage.checkpoints.get(id).cloned())
            .collect();

        // Sort by timestamp descending (newest first)
        checkpoints.sort_by(|a, b| b.checkpoint.timestamp.cmp(&a.checkpoint.timestamp));

        if let Some(limit) = limit {
            checkpoints.truncate(limit);
        }

        Ok(checkpoints)
    }

    async fn delete(&self, checkpoint_id: &str) -> Result<()> {
        let mut storage = self.storage.write().unwrap();
        storage.checkpoints.remove(checkpoint_id);

        // Remove from thread index
        for checkpoint_ids in storage.thread_index.values_mut() {
            checkpoint_ids.retain(|id| id != checkpoint_id);
        }

        Ok(())
    }

    async fn delete_thread(&self, thread_id: &str) -> Result<()> {
        let mut storage = self.storage.write().unwrap();

        if let Some(checkpoint_ids) = storage.thread_index.remove(thread_id) {
            for checkpoint_id in checkpoint_ids {
                storage.checkpoints.remove(&checkpoint_id);
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use langgraph_core::State;

    #[tokio::test]
    async fn test_memory_checkpointer() {
        let checkpointer = MemoryCheckpointer::new();
        let state = State::new();
        let checkpoint = Checkpoint::new(state);
        let checkpoint_id = checkpoint.id.clone();

        let config = CheckpointConfig {
            thread_id: Some("test-thread".to_string()),
            ..Default::default()
        };

        checkpointer.put(checkpoint, config).await.unwrap();

        let retrieved = checkpointer.get_tuple(&checkpoint_id).await.unwrap();
        assert!(retrieved.is_some());

        let list = checkpointer.list("test-thread", None).await.unwrap();
        assert_eq!(list.len(), 1);
    }

    #[tokio::test]
    async fn test_memory_checkpointer_delete() {
        let checkpointer = MemoryCheckpointer::new();
        let state = State::new();
        let checkpoint = Checkpoint::new(state);
        let checkpoint_id = checkpoint.id.clone();

        let config = CheckpointConfig {
            thread_id: Some("test-thread".to_string()),
            ..Default::default()
        };

        checkpointer.put(checkpoint, config).await.unwrap();
        checkpointer.delete(&checkpoint_id).await.unwrap();

        let retrieved = checkpointer.get_tuple(&checkpoint_id).await.unwrap();
        assert!(retrieved.is_none());
    }

    #[tokio::test]
    async fn test_memory_checkpointer_delete_thread() {
        let checkpointer = MemoryCheckpointer::new();
        let state1 = State::new();
        let checkpoint1 = Checkpoint::new(state1);

        let state2 = State::new();
        let checkpoint2 = Checkpoint::new(state2);

        let config = CheckpointConfig {
            thread_id: Some("test-thread".to_string()),
            ..Default::default()
        };

        checkpointer.put(checkpoint1, config.clone()).await.unwrap();
        checkpointer.put(checkpoint2, config).await.unwrap();

        checkpointer.delete_thread("test-thread").await.unwrap();

        let list = checkpointer.list("test-thread", None).await.unwrap();
        assert!(list.is_empty());
    }
}

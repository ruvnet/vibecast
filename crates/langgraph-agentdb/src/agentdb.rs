//! AgentDB checkpointer with vector indexing

use crate::{Error, Result, PatternStore, EmbeddingModel, ReflexionMemory};
use async_trait::async_trait;
use langgraph_checkpoint::{Checkpoint, CheckpointConfig, CheckpointTuple, Checkpointer, SqliteCheckpointer};
use std::path::Path;
use std::sync::Arc;
use tracing::{debug, info};

/// AgentDB checkpointer combining SQLite persistence with vector search
pub struct AgentDbCheckpointer {
    /// Underlying checkpoint storage
    checkpoint_store: SqliteCheckpointer,

    /// Pattern storage for learning
    pattern_store: Option<Arc<dyn PatternStore>>,

    /// Reflexion memory for learning across executions
    reflexion: Option<Arc<ReflexionMemory>>,
}

impl AgentDbCheckpointer {
    /// Create a new AgentDB checkpointer
    pub fn new(path: impl AsRef<Path>) -> Result<Self> {
        let checkpoint_store = SqliteCheckpointer::new(path)?;

        Ok(Self {
            checkpoint_store,
            pattern_store: None,
            reflexion: None,
        })
    }

    /// Create an in-memory AgentDB checkpointer
    pub fn in_memory() -> Result<Self> {
        let checkpoint_store = SqliteCheckpointer::in_memory()?;

        Ok(Self {
            checkpoint_store,
            pattern_store: None,
            reflexion: None,
        })
    }

    /// Enable pattern storage
    pub fn with_pattern_store(mut self, pattern_store: Arc<dyn PatternStore>) -> Self {
        self.pattern_store = Some(pattern_store);
        self
    }

    /// Enable reflexion memory
    pub fn with_reflexion(mut self, reflexion: Arc<ReflexionMemory>) -> Self {
        self.reflexion = Some(reflexion);
        self
    }

    /// Record a successful execution pattern
    pub async fn record_success(&self, name: String, checkpoint: &Checkpoint, score: f32) -> Result<()> {
        if let Some(reflexion) = &self.reflexion {
            reflexion.record_success(name, &checkpoint.state, score).await?;
        }
        Ok(())
    }

    /// Record a failed execution pattern
    pub async fn record_failure(&self, name: String, checkpoint: &Checkpoint, error: &str) -> Result<()> {
        if let Some(reflexion) = &self.reflexion {
            reflexion.record_failure(name, &checkpoint.state, error).await?;
        }
        Ok(())
    }

    /// Get similar checkpoints based on state
    pub async fn find_similar(&self, checkpoint: &Checkpoint, limit: usize) -> Result<Vec<crate::Pattern>> {
        if let Some(reflexion) = &self.reflexion {
            let patterns = reflexion.recall_similar(&checkpoint.state).await?;
            Ok(patterns.into_iter().take(limit).collect())
        } else {
            Ok(Vec::new())
        }
    }
}

#[async_trait]
impl Checkpointer for AgentDbCheckpointer {
    async fn put(&self, checkpoint: Checkpoint, config: CheckpointConfig) -> langgraph_checkpoint::Result<()> {
        info!("Saving checkpoint {} with AgentDB", checkpoint.id);

        // Save to underlying store with sub-millisecond performance
        self.checkpoint_store.put(checkpoint, config).await?;

        debug!("Checkpoint saved successfully");
        Ok(())
    }

    async fn get_tuple(&self, checkpoint_id: &str) -> langgraph_checkpoint::Result<Option<CheckpointTuple>> {
        self.checkpoint_store.get_tuple(checkpoint_id).await
    }

    async fn list(&self, thread_id: &str, limit: Option<usize>) -> langgraph_checkpoint::Result<Vec<CheckpointTuple>> {
        self.checkpoint_store.list(thread_id, limit).await
    }

    async fn delete(&self, checkpoint_id: &str) -> langgraph_checkpoint::Result<()> {
        self.checkpoint_store.delete(checkpoint_id).await
    }

    async fn delete_thread(&self, thread_id: &str) -> langgraph_checkpoint::Result<()> {
        self.checkpoint_store.delete_thread(thread_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use langgraph_core::State;

    #[tokio::test]
    async fn test_agentdb_checkpointer() {
        let checkpointer = AgentDbCheckpointer::in_memory().unwrap();
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
    }

    #[tokio::test]
    async fn test_agentdb_with_reflexion() {
        use crate::{embeddings::MockEmbeddingModel, patterns::SqlitePatternStore};

        let pattern_store = Arc::new(SqlitePatternStore::in_memory(384).unwrap());
        let embedding_model = Arc::new(MockEmbeddingModel::standard());
        let reflexion = Arc::new(ReflexionMemory::new(
            pattern_store.clone(),
            embedding_model,
        ));

        let checkpointer = AgentDbCheckpointer::in_memory()
            .unwrap()
            .with_pattern_store(pattern_store)
            .with_reflexion(reflexion);

        let mut state = State::new();
        state.set("key".to_string(), serde_json::json!("value"));
        let checkpoint = Checkpoint::new(state);

        checkpointer
            .record_success("test_execution".to_string(), &checkpoint, 0.9)
            .await
            .unwrap();

        let similar = checkpointer.find_similar(&checkpoint, 5).await.unwrap();
        assert!(!similar.is_empty());
    }
}

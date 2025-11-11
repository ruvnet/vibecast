//! Reflexion memory for learning across executions

use crate::{Error, Result, Pattern, PatternStore, EmbeddingModel};
use langgraph_core::State;
use std::sync::Arc;
use tracing::{debug, info};

/// Reflexion memory system for learning from past executions
pub struct ReflexionMemory {
    /// Pattern store backend
    pattern_store: Arc<dyn PatternStore>,

    /// Embedding model
    embedding_model: Arc<dyn EmbeddingModel>,

    /// Minimum similarity threshold for pattern matching
    similarity_threshold: f32,

    /// Maximum patterns to consider
    max_patterns: usize,
}

impl ReflexionMemory {
    /// Create a new reflexion memory
    pub fn new(
        pattern_store: Arc<dyn PatternStore>,
        embedding_model: Arc<dyn EmbeddingModel>,
    ) -> Self {
        Self {
            pattern_store,
            embedding_model,
            similarity_threshold: 0.7,
            max_patterns: 10,
        }
    }

    /// Set the similarity threshold
    pub fn with_similarity_threshold(mut self, threshold: f32) -> Self {
        self.similarity_threshold = threshold.clamp(0.0, 1.0);
        self
    }

    /// Set the maximum number of patterns to consider
    pub fn with_max_patterns(mut self, max: usize) -> Self {
        self.max_patterns = max;
        self
    }

    /// Record a successful execution pattern
    pub async fn record_success(&self, name: String, state: &State, score: f32) -> Result<()> {
        info!("Recording successful pattern: {}", name);

        let content = serde_json::to_string(state)?;
        let embedding = self.embedding_model.embed(&content).await?;

        let mut pattern = Pattern::new(name, content, embedding);
        pattern.update_score(score);

        self.pattern_store.store(pattern).await?;

        debug!("Pattern recorded successfully");
        Ok(())
    }

    /// Record a failed execution pattern
    pub async fn record_failure(&self, name: String, state: &State, error: &str) -> Result<()> {
        info!("Recording failed pattern: {}", name);

        let mut content_map = serde_json::Map::new();
        content_map.insert("state".to_string(), serde_json::to_value(state)?);
        content_map.insert("error".to_string(), serde_json::Value::String(error.to_string()));

        let content = serde_json::to_string(&content_map)?;
        let embedding = self.embedding_model.embed(&content).await?;

        let mut pattern = Pattern::new(name, content, embedding);
        pattern.update_score(0.1); // Low score for failed patterns

        self.pattern_store.store(pattern).await?;

        debug!("Failed pattern recorded");
        Ok(())
    }

    /// Retrieve similar patterns for a given state
    pub async fn recall_similar(&self, state: &State) -> Result<Vec<Pattern>> {
        debug!("Recalling similar patterns");

        let content = serde_json::to_string(state)?;
        let query_embedding = self.embedding_model.embed(&content).await?;

        let patterns = self
            .pattern_store
            .search(query_embedding, self.max_patterns)
            .await?;

        info!("Recalled {} similar patterns", patterns.len());
        Ok(patterns)
    }

    /// Get the best patterns (highest scores)
    pub async fn get_best_patterns(&self, limit: usize) -> Result<Vec<Pattern>> {
        debug!("Retrieving top {} patterns", limit);
        self.pattern_store.top_patterns(limit).await
    }

    /// Update a pattern's score based on new feedback
    pub async fn update_pattern_score(&self, pattern_id: &str, new_score: f32) -> Result<()> {
        debug!("Updating pattern {} with new score {}", pattern_id, new_score);
        self.pattern_store.update_score(pattern_id, new_score).await
    }

    /// Reflect on execution outcomes and adjust patterns
    pub async fn reflect(&self, execution_results: Vec<(String, f32)>) -> Result<()> {
        info!("Reflecting on {} execution results", execution_results.len());

        for (pattern_id, score) in execution_results {
            self.update_pattern_score(&pattern_id, score).await?;
        }

        debug!("Reflection complete");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{embeddings::MockEmbeddingModel, patterns::SqlitePatternStore};

    #[tokio::test]
    async fn test_reflexion_memory() {
        let store = Arc::new(SqlitePatternStore::in_memory(384).unwrap());
        let model = Arc::new(MockEmbeddingModel::standard());
        let memory = ReflexionMemory::new(store, model);

        let mut state = State::new();
        state.set("test".to_string(), serde_json::json!("value"));

        memory
            .record_success("test_pattern".to_string(), &state, 0.9)
            .await
            .unwrap();

        let similar = memory.recall_similar(&state).await.unwrap();
        assert!(!similar.is_empty());
    }

    #[tokio::test]
    async fn test_reflect() {
        let store = Arc::new(SqlitePatternStore::in_memory(384).unwrap());
        let model = Arc::new(MockEmbeddingModel::standard());
        let memory = ReflexionMemory::new(store, model);

        let mut state = State::new();
        state.set("test".to_string(), serde_json::json!("value"));

        memory
            .record_success("pattern1".to_string(), &state, 0.5)
            .await
            .unwrap();

        let patterns = memory.get_best_patterns(10).await.unwrap();
        let pattern_id = patterns[0].id.clone();

        memory
            .reflect(vec![(pattern_id.clone(), 0.9)])
            .await
            .unwrap();

        // Verify score was updated
        let updated_patterns = memory.get_best_patterns(10).await.unwrap();
        assert_eq!(updated_patterns[0].score, 0.9);
    }
}

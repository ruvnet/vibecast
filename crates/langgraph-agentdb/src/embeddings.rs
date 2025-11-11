//! Embedding models for vector representations

use crate::{Error, Result};
use async_trait::async_trait;

/// Standard embedding dimension (384-dim for most models)
pub const EMBEDDING_DIM: usize = 384;

/// Trait for embedding models
#[async_trait]
pub trait EmbeddingModel: Send + Sync {
    /// Generate embeddings for text
    async fn embed(&self, text: &str) -> Result<Vec<f32>>;

    /// Get the dimension of embeddings
    fn dimension(&self) -> usize;
}

/// Mock embedding model for testing (generates random embeddings)
#[derive(Debug, Clone)]
pub struct MockEmbeddingModel {
    dimension: usize,
}

impl MockEmbeddingModel {
    /// Create a new mock embedding model
    pub fn new(dimension: usize) -> Self {
        Self { dimension }
    }

    /// Create with standard dimension
    pub fn standard() -> Self {
        Self::new(EMBEDDING_DIM)
    }
}

#[async_trait]
impl EmbeddingModel for MockEmbeddingModel {
    async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        // Simple deterministic hash-based embedding for testing
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        let hash = hasher.finish();

        let mut embedding = vec![0.0; self.dimension];
        for (i, val) in embedding.iter_mut().enumerate() {
            let mut h = DefaultHasher::new();
            (hash + i as u64).hash(&mut h);
            *val = (h.finish() % 1000) as f32 / 1000.0;
        }

        Ok(embedding)
    }

    fn dimension(&self) -> usize {
        self.dimension
    }
}

/// Calculate cosine similarity between two vectors
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }

    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if mag_a == 0.0 || mag_b == 0.0 {
        return 0.0;
    }

    dot / (mag_a * mag_b)
}

/// Calculate euclidean distance between two vectors
pub fn euclidean_distance(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return f32::MAX;
    }

    a.iter()
        .zip(b.iter())
        .map(|(x, y)| (x - y).powi(2))
        .sum::<f32>()
        .sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_embedding_model() {
        let model = MockEmbeddingModel::standard();
        let embedding = model.embed("test text").await.unwrap();
        assert_eq!(embedding.len(), EMBEDDING_DIM);
        assert!(embedding.iter().all(|&x| x >= 0.0 && x <= 1.0));
    }

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        let c = vec![1.0, 0.0, 0.0];

        assert_eq!(cosine_similarity(&a, &c), 1.0);
        assert_eq!(cosine_similarity(&a, &b), 0.0);
    }

    #[test]
    fn test_euclidean_distance() {
        let a = vec![0.0, 0.0];
        let b = vec![3.0, 4.0];

        assert_eq!(euclidean_distance(&a, &b), 5.0);
    }
}

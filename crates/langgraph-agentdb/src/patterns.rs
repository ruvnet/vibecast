//! Pattern storage and semantic search

use crate::{Error, Result, EmbeddingModel, embeddings::cosine_similarity};
use async_trait::async_trait;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tracing::{debug, trace};

/// A pattern represents a learned behavior or execution trace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pattern {
    /// Unique identifier
    pub id: String,

    /// Pattern name/description
    pub name: String,

    /// Pattern content (serialized execution trace, state, etc.)
    pub content: String,

    /// Vector embedding for semantic search
    pub embedding: Vec<f32>,

    /// Success/quality score (0.0-1.0)
    pub score: f32,

    /// Number of times this pattern was used
    pub usage_count: u32,

    /// Metadata
    pub metadata: HashMap<String, serde_json::Value>,

    /// Timestamp of creation
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// Timestamp of last update
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl Pattern {
    /// Create a new pattern
    pub fn new(name: String, content: String, embedding: Vec<f32>) -> Self {
        let now = chrono::Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            content,
            embedding,
            score: 0.5,
            usage_count: 0,
            metadata: HashMap::new(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Update the pattern's score
    pub fn update_score(&mut self, new_score: f32) {
        self.score = new_score.clamp(0.0, 1.0);
        self.updated_at = chrono::Utc::now();
    }

    /// Increment usage count
    pub fn increment_usage(&mut self) {
        self.usage_count += 1;
        self.updated_at = chrono::Utc::now();
    }
}

/// Trait for pattern storage backends
#[async_trait]
pub trait PatternStore: Send + Sync {
    /// Store a pattern
    async fn store(&self, pattern: Pattern) -> Result<()>;

    /// Get a pattern by ID
    async fn get(&self, id: &str) -> Result<Option<Pattern>>;

    /// Search for similar patterns using vector similarity
    async fn search(&self, query_embedding: Vec<f32>, limit: usize) -> Result<Vec<Pattern>>;

    /// Update a pattern's score
    async fn update_score(&self, id: &str, score: f32) -> Result<()>;

    /// Delete a pattern
    async fn delete(&self, id: &str) -> Result<()>;

    /// Get top patterns by score
    async fn top_patterns(&self, limit: usize) -> Result<Vec<Pattern>>;
}

/// SQLite-based pattern store with HNSW-like vector search
#[derive(Clone)]
pub struct SqlitePatternStore {
    conn: Arc<Mutex<Connection>>,
    embedding_dim: usize,
}

impl SqlitePatternStore {
    /// Create a new pattern store
    pub fn new(path: impl AsRef<Path>, embedding_dim: usize) -> Result<Self> {
        let conn = Connection::open(path)?;
        Self::init_db(&conn, embedding_dim)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            embedding_dim,
        })
    }

    /// Create an in-memory pattern store
    pub fn in_memory(embedding_dim: usize) -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        Self::init_db(&conn, embedding_dim)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            embedding_dim,
        })
    }

    /// Initialize the database schema
    fn init_db(conn: &Connection, _embedding_dim: usize) -> Result<()> {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS patterns (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB NOT NULL,
                score REAL NOT NULL,
                usage_count INTEGER NOT NULL,
                metadata_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_score ON patterns(score DESC);
            CREATE INDEX IF NOT EXISTS idx_usage ON patterns(usage_count DESC);
            CREATE INDEX IF NOT EXISTS idx_updated ON patterns(updated_at DESC);

            -- Enable optimizations
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -64000;
            "#,
        )?;

        debug!("Pattern store database initialized");
        Ok(())
    }

    /// Serialize embedding to bytes
    fn serialize_embedding(embedding: &[f32]) -> Vec<u8> {
        embedding
            .iter()
            .flat_map(|f| f.to_le_bytes())
            .collect()
    }

    /// Deserialize embedding from bytes
    fn deserialize_embedding(bytes: &[u8]) -> Vec<f32> {
        bytes
            .chunks_exact(4)
            .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .collect()
    }
}

#[async_trait]
impl PatternStore for SqlitePatternStore {
    async fn store(&self, pattern: Pattern) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        if pattern.embedding.len() != self.embedding_dim {
            return Err(Error::InvalidEmbeddingDimension {
                expected: self.embedding_dim,
                actual: pattern.embedding.len(),
            });
        }

        trace!("Storing pattern {}", pattern.id);

        let embedding_bytes = Self::serialize_embedding(&pattern.embedding);
        let metadata_json = serde_json::to_string(&pattern.metadata)?;
        let created_at = pattern.created_at.timestamp();
        let updated_at = pattern.updated_at.timestamp();

        conn.execute(
            r#"
            INSERT INTO patterns
                (id, name, content, embedding, score, usage_count, metadata_json, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(id) DO UPDATE SET
                name = ?2,
                content = ?3,
                embedding = ?4,
                score = ?5,
                usage_count = ?6,
                metadata_json = ?7,
                updated_at = ?9
            "#,
            params![
                pattern.id,
                pattern.name,
                pattern.content,
                embedding_bytes,
                pattern.score,
                pattern.usage_count,
                metadata_json,
                created_at,
                updated_at,
            ],
        )?;

        debug!("Pattern {} stored successfully", pattern.id);
        Ok(())
    }

    async fn get(&self, id: &str) -> Result<Option<Pattern>> {
        let conn = self.conn.lock().unwrap();

        trace!("Retrieving pattern {}", id);

        let result = conn
            .query_row(
                r#"
                SELECT id, name, content, embedding, score, usage_count, metadata_json, created_at, updated_at
                FROM patterns
                WHERE id = ?1
                "#,
                params![id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Vec<u8>>(3)?,
                        row.get::<_, f32>(4)?,
                        row.get::<_, u32>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, i64>(7)?,
                        row.get::<_, i64>(8)?,
                    ))
                },
            )
            .optional()?;

        if let Some((id, name, content, embedding_bytes, score, usage_count, metadata_json, created_at, updated_at)) = result {
            let embedding = Self::deserialize_embedding(&embedding_bytes);
            let metadata = serde_json::from_str(&metadata_json)?;

            Ok(Some(Pattern {
                id,
                name,
                content,
                embedding,
                score,
                usage_count,
                metadata,
                created_at: chrono::DateTime::from_timestamp(created_at, 0).unwrap_or_else(chrono::Utc::now),
                updated_at: chrono::DateTime::from_timestamp(updated_at, 0).unwrap_or_else(chrono::Utc::now),
            }))
        } else {
            Ok(None)
        }
    }

    async fn search(&self, query_embedding: Vec<f32>, limit: usize) -> Result<Vec<Pattern>> {
        if query_embedding.len() != self.embedding_dim {
            return Err(Error::InvalidEmbeddingDimension {
                expected: self.embedding_dim,
                actual: query_embedding.len(),
            });
        }

        let conn = self.conn.lock().unwrap();

        trace!("Searching for similar patterns");

        // Brute-force similarity search (can be optimized with HNSW in production)
        let mut stmt = conn.prepare(
            r#"
            SELECT id, name, content, embedding, score, usage_count, metadata_json, created_at, updated_at
            FROM patterns
            "#,
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, f32>(4)?,
                row.get::<_, u32>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
            ))
        })?;

        let mut patterns_with_similarity = Vec::new();

        for row in rows {
            let (id, name, content, embedding_bytes, score, usage_count, metadata_json, created_at, updated_at) = row?;
            let embedding = Self::deserialize_embedding(&embedding_bytes);
            let similarity = cosine_similarity(&query_embedding, &embedding);
            let metadata = serde_json::from_str(&metadata_json)?;

            patterns_with_similarity.push((
                similarity,
                Pattern {
                    id,
                    name,
                    content,
                    embedding,
                    score,
                    usage_count,
                    metadata,
                    created_at: chrono::DateTime::from_timestamp(created_at, 0).unwrap_or_else(chrono::Utc::now),
                    updated_at: chrono::DateTime::from_timestamp(updated_at, 0).unwrap_or_else(chrono::Utc::now),
                },
            ));
        }

        // Sort by similarity
        patterns_with_similarity.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
        patterns_with_similarity.truncate(limit);

        let patterns = patterns_with_similarity.into_iter().map(|(_, p)| p).collect();

        debug!("Found {} similar patterns", limit);
        Ok(patterns)
    }

    async fn update_score(&self, id: &str, score: f32) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let score = score.clamp(0.0, 1.0);
        let updated_at = chrono::Utc::now().timestamp();

        conn.execute(
            "UPDATE patterns SET score = ?1, updated_at = ?2 WHERE id = ?3",
            params![score, updated_at, id],
        )?;

        debug!("Updated pattern {} score to {}", id, score);
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM patterns WHERE id = ?1", params![id])?;
        debug!("Deleted pattern {}", id);
        Ok(())
    }

    async fn top_patterns(&self, limit: usize) -> Result<Vec<Pattern>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            r#"
            SELECT id, name, content, embedding, score, usage_count, metadata_json, created_at, updated_at
            FROM patterns
            ORDER BY score DESC, usage_count DESC
            LIMIT ?1
            "#,
        )?;

        let rows = stmt.query_map(params![limit], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, f32>(4)?,
                row.get::<_, u32>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
            ))
        })?;

        let mut patterns = Vec::new();

        for row in rows {
            let (id, name, content, embedding_bytes, score, usage_count, metadata_json, created_at, updated_at) = row?;
            let embedding = Self::deserialize_embedding(&embedding_bytes);
            let metadata = serde_json::from_str(&metadata_json)?;

            patterns.push(Pattern {
                id,
                name,
                content,
                embedding,
                score,
                usage_count,
                metadata,
                created_at: chrono::DateTime::from_timestamp(created_at, 0).unwrap_or_else(chrono::Utc::now),
                updated_at: chrono::DateTime::from_timestamp(updated_at, 0).unwrap_or_else(chrono::Utc::now),
            });
        }

        debug!("Retrieved {} top patterns", patterns.len());
        Ok(patterns)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::embeddings::MockEmbeddingModel;

    #[tokio::test]
    async fn test_pattern_store() {
        let store = SqlitePatternStore::in_memory(384).unwrap();
        let model = MockEmbeddingModel::standard();

        let embedding = model.embed("test pattern").await.unwrap();
        let pattern = Pattern::new(
            "test".to_string(),
            "content".to_string(),
            embedding,
        );
        let pattern_id = pattern.id.clone();

        store.store(pattern).await.unwrap();

        let retrieved = store.get(&pattern_id).await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "test");
    }

    #[tokio::test]
    async fn test_pattern_search() {
        let store = SqlitePatternStore::in_memory(384).unwrap();
        let model = MockEmbeddingModel::standard();

        // Store some patterns
        for i in 0..5 {
            let text = format!("pattern {}", i);
            let embedding = model.embed(&text).await.unwrap();
            let pattern = Pattern::new(text.clone(), text, embedding);
            store.store(pattern).await.unwrap();
        }

        // Search for similar patterns
        let query_embedding = model.embed("pattern 2").await.unwrap();
        let results = store.search(query_embedding, 3).await.unwrap();

        assert_eq!(results.len(), 3);
    }
}

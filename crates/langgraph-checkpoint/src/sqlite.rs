//! SQLite checkpoint backend with sub-millisecond performance

use crate::{Checkpoint, CheckpointConfig, CheckpointTuple, Checkpointer, Error, Result};
use async_trait::async_trait;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tracing::{debug, trace};

/// SQLite-based checkpointer with high performance
#[derive(Clone)]
pub struct SqliteCheckpointer {
    /// Database connection
    conn: Arc<Mutex<Connection>>,
}

impl SqliteCheckpointer {
    /// Create a new SQLite checkpointer with a file path
    pub fn new(path: impl AsRef<Path>) -> Result<Self> {
        let conn = Connection::open(path)?;
        Self::init_db(&conn)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Create an in-memory SQLite checkpointer
    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        Self::init_db(&conn)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Initialize the database schema
    fn init_db(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS checkpoints (
                id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL,
                parent_id TEXT,
                state_json TEXT NOT NULL,
                metadata_json TEXT NOT NULL,
                config_json TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_thread_timestamp
                ON checkpoints(thread_id, timestamp DESC);

            CREATE INDEX IF NOT EXISTS idx_parent
                ON checkpoints(parent_id);

            -- Enable optimizations for sub-millisecond performance
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -64000;  -- 64MB cache
            PRAGMA temp_store = MEMORY;
            "#,
        )?;

        debug!("SQLite checkpoint database initialized");
        Ok(())
    }

    /// Serialize a checkpoint to JSON strings
    fn serialize_checkpoint(checkpoint: &Checkpoint) -> Result<(String, String)> {
        let state_json = serde_json::to_string(&checkpoint.state)?;
        let metadata_json = serde_json::to_string(&checkpoint.metadata)?;
        Ok((state_json, metadata_json))
    }

    /// Deserialize a checkpoint from JSON strings
    fn deserialize_checkpoint(
        id: String,
        parent_id: Option<String>,
        state_json: &str,
        metadata_json: &str,
        timestamp: i64,
    ) -> Result<Checkpoint> {
        let state = serde_json::from_str(state_json)?;
        let metadata = serde_json::from_str(metadata_json)?;

        Ok(Checkpoint {
            id,
            state,
            parent_id,
            timestamp: chrono::DateTime::from_timestamp(timestamp, 0)
                .unwrap_or_else(chrono::Utc::now),
            metadata,
        })
    }
}

#[async_trait]
impl Checkpointer for SqliteCheckpointer {
    async fn put(&self, checkpoint: Checkpoint, config: CheckpointConfig) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let thread_id = config.thread_id.unwrap_or_else(|| "default".to_string());
        let (state_json, metadata_json) = Self::serialize_checkpoint(&checkpoint)?;
        let config_json = serde_json::to_string(&config.config)?;

        trace!("Saving checkpoint {} to thread {}", checkpoint.id, thread_id);

        let timestamp = checkpoint.timestamp.timestamp();
        let created_at = chrono::Utc::now().timestamp();

        conn.execute(
            r#"
            INSERT INTO checkpoints
                (id, thread_id, parent_id, state_json, metadata_json, config_json, timestamp, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
                state_json = ?4,
                metadata_json = ?5,
                config_json = ?6,
                timestamp = ?7
            "#,
            params![
                checkpoint.id,
                thread_id,
                checkpoint.parent_id,
                state_json,
                metadata_json,
                config_json,
                timestamp,
                created_at,
            ],
        )?;

        debug!("Checkpoint {} saved successfully", checkpoint.id);
        Ok(())
    }

    async fn get_tuple(&self, checkpoint_id: &str) -> Result<Option<CheckpointTuple>> {
        let conn = self.conn.lock().unwrap();

        trace!("Retrieving checkpoint {}", checkpoint_id);

        let result: Option<(String, Option<String>, String, String, String, i64)> = conn
            .query_row(
                r#"
                SELECT id, parent_id, state_json, metadata_json, config_json, timestamp
                FROM checkpoints
                WHERE id = ?1
                "#,
                params![checkpoint_id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                },
            )
            .optional()?;

        if let Some((id, parent_id, state_json, metadata_json, config_json, timestamp)) = result {
            let checkpoint =
                Self::deserialize_checkpoint(id, parent_id, &state_json, &metadata_json, timestamp)?;
            let config = serde_json::from_str(&config_json)?;

            Ok(Some(CheckpointTuple {
                checkpoint,
                config,
                pending_writes: Vec::new(),
            }))
        } else {
            Ok(None)
        }
    }

    async fn list(&self, thread_id: &str, limit: Option<usize>) -> Result<Vec<CheckpointTuple>> {
        let conn = self.conn.lock().unwrap();

        trace!("Listing checkpoints for thread {}", thread_id);

        let limit_clause = limit.map(|l| format!("LIMIT {}", l)).unwrap_or_default();

        let sql = format!(
            r#"
            SELECT id, parent_id, state_json, metadata_json, config_json, timestamp
            FROM checkpoints
            WHERE thread_id = ?1
            ORDER BY timestamp DESC
            {}
            "#,
            limit_clause
        );

        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(params![thread_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
            ))
        })?;

        let mut checkpoints = Vec::new();
        for row in rows {
            let (id, parent_id, state_json, metadata_json, config_json, timestamp) = row?;
            let checkpoint =
                Self::deserialize_checkpoint(id, parent_id, &state_json, &metadata_json, timestamp)?;
            let config = serde_json::from_str(&config_json)?;

            checkpoints.push(CheckpointTuple {
                checkpoint,
                config,
                pending_writes: Vec::new(),
            });
        }

        debug!("Retrieved {} checkpoints for thread {}", checkpoints.len(), thread_id);
        Ok(checkpoints)
    }

    async fn delete(&self, checkpoint_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        trace!("Deleting checkpoint {}", checkpoint_id);

        conn.execute(
            "DELETE FROM checkpoints WHERE id = ?1",
            params![checkpoint_id],
        )?;

        debug!("Checkpoint {} deleted", checkpoint_id);
        Ok(())
    }

    async fn delete_thread(&self, thread_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        trace!("Deleting all checkpoints for thread {}", thread_id);

        let deleted = conn.execute(
            "DELETE FROM checkpoints WHERE thread_id = ?1",
            params![thread_id],
        )?;

        debug!("Deleted {} checkpoints for thread {}", deleted, thread_id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use langgraph_core::State;

    #[tokio::test]
    async fn test_sqlite_checkpointer() {
        let checkpointer = SqliteCheckpointer::in_memory().unwrap();
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
    async fn test_sqlite_performance() {
        use std::time::Instant;

        let checkpointer = SqliteCheckpointer::in_memory().unwrap();

        // Test save performance
        let start = Instant::now();
        for i in 0..100 {
            let state = State::new();
            let checkpoint = Checkpoint::new(state);
            let config = CheckpointConfig {
                thread_id: Some("perf-test".to_string()),
                ..Default::default()
            };
            checkpointer.put(checkpoint, config).await.unwrap();
        }
        let save_duration = start.elapsed();
        let avg_save = save_duration.as_micros() / 100;
        println!("Average save time: {}μs", avg_save);

        // Test load performance
        let start = Instant::now();
        let list = checkpointer.list("perf-test", Some(10)).await.unwrap();
        let load_duration = start.elapsed();
        println!("Load time for 10 checkpoints: {}μs", load_duration.as_micros());

        assert_eq!(list.len(), 10);
        // Assert sub-millisecond performance (< 1000μs)
        assert!(load_duration.as_micros() < 1000);
    }
}

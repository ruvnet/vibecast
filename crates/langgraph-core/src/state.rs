//! State management for LangGraph

use crate::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Trait for state schema validation and merging
pub trait StateSchema: Send + Sync + Clone {
    /// Merge this state with another state
    fn merge(&mut self, other: &Self) -> Result<()>;

    /// Validate the state
    fn validate(&self) -> Result<()>;
}

/// Generic state container that can hold any serializable data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct State {
    /// Internal state data
    pub data: HashMap<String, serde_json::Value>,

    /// Metadata for tracking state evolution
    pub metadata: StateMetadata,
}

/// Metadata associated with state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateMetadata {
    /// Version of the state
    pub version: u64,

    /// Timestamp of creation
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// Timestamp of last update
    pub updated_at: chrono::DateTime<chrono::Utc>,

    /// Additional custom metadata
    pub custom: HashMap<String, serde_json::Value>,
}

impl State {
    /// Create a new empty state
    pub fn new() -> Self {
        let now = chrono::Utc::now();
        Self {
            data: HashMap::with_capacity(8), // Pre-allocate for common use case
            metadata: StateMetadata {
                version: 0,
                created_at: now,
                updated_at: now,
                custom: HashMap::new(),
            },
        }
    }

    /// Create a state from a HashMap
    pub fn from_map(data: HashMap<String, serde_json::Value>) -> Self {
        let now = chrono::Utc::now();
        Self {
            data,
            metadata: StateMetadata {
                version: 0,
                created_at: now,
                updated_at: now,
                custom: HashMap::new(),
            },
        }
    }

    /// Get a value from the state
    pub fn get(&self, key: &str) -> Option<&serde_json::Value> {
        self.data.get(key)
    }

    /// Set a value in the state
    pub fn set(&mut self, key: String, value: serde_json::Value) {
        self.data.insert(key, value);
        self.metadata.version += 1;
        // Skip timestamp update for performance - can be updated manually if needed
    }

    /// Remove a value from the state
    pub fn remove(&mut self, key: &str) -> Option<serde_json::Value> {
        let result = self.data.remove(key);
        if result.is_some() {
            self.metadata.version += 1;
            // Skip timestamp update for performance
        }
        result
    }

    /// Check if a key exists
    pub fn contains_key(&self, key: &str) -> bool {
        self.data.contains_key(key)
    }

    /// Get all keys
    pub fn keys(&self) -> impl Iterator<Item = &String> {
        self.data.keys()
    }

    /// Get the number of entries
    pub fn len(&self) -> usize {
        self.data.len()
    }

    /// Check if the state is empty
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// Manually update the timestamp (for when timestamp tracking is needed)
    pub fn update_timestamp(&mut self) {
        self.metadata.updated_at = chrono::Utc::now();
    }
}

impl Default for State {
    fn default() -> Self {
        Self::new()
    }
}

impl StateSchema for State {
    fn merge(&mut self, other: &Self) -> Result<()> {
        for (key, value) in &other.data {
            self.data.insert(key.clone(), value.clone());
        }
        self.metadata.version += 1;
        // Skip timestamp update for performance
        Ok(())
    }

    fn validate(&self) -> Result<()> {
        // Basic validation - can be extended
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_creation() {
        let state = State::new();
        assert!(state.is_empty());
        assert_eq!(state.metadata.version, 0);
    }

    #[test]
    fn test_state_set_get() {
        let mut state = State::new();
        state.set("key".to_string(), serde_json::json!("value"));
        assert_eq!(state.get("key"), Some(&serde_json::json!("value")));
        assert_eq!(state.metadata.version, 1);
    }

    #[test]
    fn test_state_merge() {
        let mut state1 = State::new();
        state1.set("a".to_string(), serde_json::json!(1));

        let mut state2 = State::new();
        state2.set("b".to_string(), serde_json::json!(2));

        state1.merge(&state2).unwrap();
        assert_eq!(state1.get("a"), Some(&serde_json::json!(1)));
        assert_eq!(state1.get("b"), Some(&serde_json::json!(2)));
    }
}

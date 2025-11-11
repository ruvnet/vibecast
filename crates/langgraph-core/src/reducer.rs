//! Reducers for state aggregation

use crate::{Result, State, StateSchema};
use async_trait::async_trait;

/// Trait for reducing multiple states into one
#[async_trait]
pub trait Reducer: Send + Sync {
    /// Reduce multiple states into a single state
    async fn reduce(&self, states: Vec<State>) -> Result<State>;
}

/// Default reducer that merges states sequentially
#[derive(Debug, Clone)]
pub struct DefaultReducer;

#[async_trait]
impl Reducer for DefaultReducer {
    async fn reduce(&self, states: Vec<State>) -> Result<State> {
        if states.is_empty() {
            return Ok(State::new());
        }

        let mut result = states[0].clone();
        for state in &states[1..] {
            result.merge(state)?;
        }
        Ok(result)
    }
}

/// Reducer that overwrites with the last state
#[derive(Debug, Clone)]
pub struct OverwriteReducer;

#[async_trait]
impl Reducer for OverwriteReducer {
    async fn reduce(&self, states: Vec<State>) -> Result<State> {
        Ok(states.last().cloned().unwrap_or_default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_default_reducer() {
        let reducer = DefaultReducer;

        let mut state1 = State::new();
        state1.set("a".to_string(), serde_json::json!(1));

        let mut state2 = State::new();
        state2.set("b".to_string(), serde_json::json!(2));

        let result = reducer.reduce(vec![state1, state2]).await.unwrap();
        assert_eq!(result.get("a"), Some(&serde_json::json!(1)));
        assert_eq!(result.get("b"), Some(&serde_json::json!(2)));
    }

    #[tokio::test]
    async fn test_overwrite_reducer() {
        let reducer = OverwriteReducer;

        let mut state1 = State::new();
        state1.set("a".to_string(), serde_json::json!(1));

        let mut state2 = State::new();
        state2.set("b".to_string(), serde_json::json!(2));

        let result = reducer.reduce(vec![state1, state2]).await.unwrap();
        assert_eq!(result.get("a"), None);
        assert_eq!(result.get("b"), Some(&serde_json::json!(2)));
    }
}

//! Node execution for graph operations

use crate::{Result, State};
use async_trait::async_trait;
use std::sync::Arc;

/// Trait for executable nodes in the graph
#[async_trait]
pub trait Node: Send + Sync {
    /// Execute the node with the given state
    async fn execute(&self, state: State) -> Result<State>;

    /// Get the name of this node
    fn name(&self) -> &str;

    /// Optional validation before execution
    async fn validate(&self, _state: &State) -> Result<()> {
        Ok(())
    }
}

/// A node executor that wraps an async function
pub struct NodeExecutor {
    /// Name of the node
    name: String,

    /// The execution function
    executor: Arc<dyn Fn(State) -> futures::future::BoxFuture<'static, Result<State>> + Send + Sync>,
}

impl NodeExecutor {
    /// Create a new node executor
    pub fn new<F, Fut>(name: impl Into<String>, f: F) -> Self
    where
        F: Fn(State) -> Fut + Send + Sync + 'static,
        Fut: futures::Future<Output = Result<State>> + Send + 'static,
    {
        let name = name.into();
        let executor = Arc::new(move |state: State| {
            let fut = f(state);
            Box::pin(fut) as futures::future::BoxFuture<'static, Result<State>>
        });

        Self { name, executor }
    }

    /// Create a synchronous node executor
    pub fn sync<F>(name: impl Into<String>, f: F) -> Self
    where
        F: Fn(State) -> Result<State> + Send + Sync + 'static,
    {
        Self::new(name, move |state| {
            let result = f(state);
            async move { result }
        })
    }
}

#[async_trait]
impl Node for NodeExecutor {
    async fn execute(&self, state: State) -> Result<State> {
        (self.executor)(state).await
    }

    fn name(&self) -> &str {
        &self.name
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_node_executor() {
        let node = NodeExecutor::new("test_node", |mut state| async move {
            state.set("executed".to_string(), serde_json::json!(true));
            Ok(state)
        });

        let state = State::new();
        let result = node.execute(state).await.unwrap();
        assert_eq!(result.get("executed"), Some(&serde_json::json!(true)));
        assert_eq!(node.name(), "test_node");
    }

    #[tokio::test]
    async fn test_sync_node_executor() {
        let node = NodeExecutor::sync("sync_node", |mut state| {
            state.set("sync".to_string(), serde_json::json!(true));
            Ok(state)
        });

        let state = State::new();
        let result = node.execute(state).await.unwrap();
        assert_eq!(result.get("sync"), Some(&serde_json::json!(true)));
    }
}

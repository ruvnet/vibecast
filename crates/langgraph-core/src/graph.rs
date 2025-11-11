//! Graph structures and execution engine

use crate::{Error, Result, Node, NodeExecutor, State, StateSchema, Reducer, Message, MessageList};
use async_trait::async_trait;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;
use tracing::{debug, info, trace};

/// Edge definition between nodes
#[derive(Clone)]
pub struct Edge {
    /// Source node name
    pub from: String,
    /// Target node name
    pub to: String,
    /// Optional condition for edge traversal
    pub condition: Option<Arc<dyn Fn(&State) -> bool + Send + Sync>>,
}

impl std::fmt::Debug for Edge {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Edge")
            .field("from", &self.from)
            .field("to", &self.to)
            .field("condition", &self.condition.as_ref().map(|_| "<function>"))
            .finish()
    }
}

/// Trait for graph execution
#[async_trait]
pub trait Graph: Send + Sync {
    /// Execute the graph with the given initial state
    async fn execute(&self, initial_state: State) -> Result<State>;

    /// Compile the graph (validate and optimize)
    fn compile(&mut self) -> Result<()>;

    /// Get the entry point node
    fn entry_point(&self) -> &str;

    /// Check if the graph is compiled
    fn is_compiled(&self) -> bool;
}

/// StateGraph - main graph implementation
pub struct StateGraph {
    /// Graph name
    name: String,

    /// Nodes in the graph
    nodes: HashMap<String, Arc<dyn Node>>,

    /// Edges between nodes
    edges: Vec<Edge>,

    /// Entry point node name
    entry: String,

    /// Exit point node names
    exits: HashSet<String>,

    /// Whether the graph is compiled
    compiled: bool,

    /// Reducer for state aggregation
    reducer: Arc<dyn Reducer>,
}

impl StateGraph {
    /// Create a new StateGraph
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            nodes: HashMap::new(),
            edges: Vec::new(),
            entry: String::new(),
            exits: HashSet::new(),
            compiled: false,
            reducer: Arc::new(crate::reducer::DefaultReducer),
        }
    }

    /// Add a node to the graph
    pub fn add_node(&mut self, node: impl Node + 'static) -> Result<&mut Self> {
        let name = node.name().to_string();
        if self.nodes.contains_key(&name) {
            return Err(Error::InvalidConfiguration(format!(
                "Node '{}' already exists",
                name
            )));
        }
        self.nodes.insert(name, Arc::new(node));
        self.compiled = false;
        Ok(self)
    }

    /// Add an edge between two nodes
    pub fn add_edge(&mut self, from: impl Into<String>, to: impl Into<String>) -> Result<&mut Self> {
        let from = from.into();
        let to = to.into();

        if !self.nodes.contains_key(&from) {
            return Err(Error::NodeNotFound(from));
        }
        if !self.nodes.contains_key(&to) {
            return Err(Error::NodeNotFound(to));
        }

        self.edges.push(Edge {
            from,
            to,
            condition: None,
        });
        self.compiled = false;
        Ok(self)
    }

    /// Add a conditional edge
    pub fn add_conditional_edge<F>(&mut self, from: impl Into<String>, to: impl Into<String>, condition: F) -> Result<&mut Self>
    where
        F: Fn(&State) -> bool + Send + Sync + 'static,
    {
        let from = from.into();
        let to = to.into();

        if !self.nodes.contains_key(&from) {
            return Err(Error::NodeNotFound(from));
        }
        if !self.nodes.contains_key(&to) {
            return Err(Error::NodeNotFound(to));
        }

        self.edges.push(Edge {
            from,
            to,
            condition: Some(Arc::new(condition)),
        });
        self.compiled = false;
        Ok(self)
    }

    /// Set the entry point
    pub fn set_entry_point(&mut self, node: impl Into<String>) -> Result<&mut Self> {
        let node = node.into();
        if !self.nodes.contains_key(&node) {
            return Err(Error::NodeNotFound(node));
        }
        self.entry = node;
        self.compiled = false;
        Ok(self)
    }

    /// Add an exit point
    pub fn add_exit_point(&mut self, node: impl Into<String>) -> Result<&mut Self> {
        let node = node.into();
        if !self.nodes.contains_key(&node) {
            return Err(Error::NodeNotFound(node));
        }
        self.exits.insert(node);
        self.compiled = false;
        Ok(self)
    }

    /// Set the reducer
    pub fn set_reducer(&mut self, reducer: impl Reducer + 'static) {
        self.reducer = Arc::new(reducer);
        self.compiled = false;
    }

    /// Detect cycles in the graph using DFS
    fn detect_cycles(&self) -> Result<()> {
        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();

        fn dfs(
            node: &str,
            edges: &[Edge],
            visited: &mut HashSet<String>,
            rec_stack: &mut HashSet<String>,
        ) -> Result<()> {
            visited.insert(node.to_string());
            rec_stack.insert(node.to_string());

            for edge in edges.iter().filter(|e| e.from == node) {
                if !visited.contains(&edge.to) {
                    dfs(&edge.to, edges, visited, rec_stack)?;
                } else if rec_stack.contains(&edge.to) {
                    return Err(Error::CycleDetected);
                }
            }

            rec_stack.remove(node);
            Ok(())
        }

        if !self.entry.is_empty() {
            dfs(&self.entry, &self.edges, &mut visited, &mut rec_stack)?;
        }

        Ok(())
    }

    /// Get outgoing edges from a node
    fn get_outgoing_edges(&self, node: &str) -> Vec<&Edge> {
        self.edges.iter().filter(|e| e.from == node).collect()
    }
}

#[async_trait]
impl Graph for StateGraph {
    async fn execute(&self, initial_state: State) -> Result<State> {
        if !self.compiled {
            return Err(Error::InvalidConfiguration(
                "Graph must be compiled before execution".to_string(),
            ));
        }

        if self.entry.is_empty() {
            return Err(Error::InvalidConfiguration(
                "Entry point not set".to_string(),
            ));
        }

        info!("Starting graph execution: {}", self.name);
        let mut current_state = initial_state;
        let mut current_node = self.entry.clone();
        let mut visited = HashSet::new();
        let max_iterations = 1000; // Prevent infinite loops
        let mut iteration = 0;

        loop {
            iteration += 1;
            if iteration > max_iterations {
                return Err(Error::ExecutionError(
                    "Maximum iterations exceeded".to_string(),
                ));
            }

            // Execute current node
            let node = self
                .nodes
                .get(&current_node)
                .ok_or_else(|| Error::NodeNotFound(current_node.clone()))?;

            debug!("Executing node: {}", current_node);
            trace!("State before execution: {:?}", current_state);

            current_state = node.execute(current_state).await?;

            trace!("State after execution: {:?}", current_state);

            // Check if we've reached an exit (after executing the node)
            if self.exits.contains(&current_node) {
                debug!("Reached exit node: {}", current_node);
                break;
            }

            // Find next node
            let outgoing = self.get_outgoing_edges(&current_node);
            if outgoing.is_empty() {
                debug!("No outgoing edges from {}, terminating", current_node);
                break;
            }

            // Select next edge based on conditions
            let next_edge = outgoing
                .iter()
                .find(|edge| {
                    edge.condition
                        .as_ref()
                        .map(|cond| cond(&current_state))
                        .unwrap_or(true)
                })
                .ok_or_else(|| {
                    Error::ExecutionError(format!(
                        "No valid edge found from node '{}'",
                        current_node
                    ))
                })?;

            current_node = next_edge.to.clone();
            visited.insert(current_node.clone());
        }

        info!("Graph execution completed: {}", self.name);
        Ok(current_state)
    }

    fn compile(&mut self) -> Result<()> {
        info!("Compiling graph: {}", self.name);

        // Validate entry point
        if self.entry.is_empty() {
            return Err(Error::InvalidConfiguration(
                "Entry point not set".to_string(),
            ));
        }

        // Validate all nodes referenced in edges exist
        for edge in &self.edges {
            if !self.nodes.contains_key(&edge.from) {
                return Err(Error::NodeNotFound(edge.from.clone()));
            }
            if !self.nodes.contains_key(&edge.to) {
                return Err(Error::NodeNotFound(edge.to.clone()));
            }
        }

        // Detect cycles
        self.detect_cycles()?;

        self.compiled = true;
        info!("Graph compilation successful: {}", self.name);
        Ok(())
    }

    fn entry_point(&self) -> &str {
        &self.entry
    }

    fn is_compiled(&self) -> bool {
        self.compiled
    }
}

/// MessageGraph - specialized graph for message-based workflows
pub struct MessageGraph {
    /// Underlying state graph
    state_graph: StateGraph,
}

impl MessageGraph {
    /// Create a new MessageGraph
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            state_graph: StateGraph::new(name),
        }
    }

    /// Add a node that processes messages
    pub fn add_message_node<F, Fut>(&mut self, name: impl Into<String>, f: F) -> Result<&mut Self>
    where
        F: Fn(MessageList) -> Fut + Send + Sync + 'static,
        Fut: futures::Future<Output = Result<MessageList>> + Send + 'static,
    {
        let f = Arc::new(f);
        let node = NodeExecutor::new(name, move |state| {
            let messages_value = state.get("messages").cloned().unwrap_or(serde_json::json!([]));
            let messages: MessageList = serde_json::from_value(messages_value)
                .unwrap_or_default();

            let f = Arc::clone(&f);
            async move {
                let result: MessageList = f(messages).await?;
                let mut new_state = state;
                new_state.set("messages".to_string(), serde_json::to_value(&result)?);
                Ok(new_state)
            }
        });

        self.state_graph.add_node(node)?;
        Ok(self)
    }

    /// Add an edge
    pub fn add_edge(&mut self, from: impl Into<String>, to: impl Into<String>) -> Result<&mut Self> {
        self.state_graph.add_edge(from, to)?;
        Ok(self)
    }

    /// Set entry point
    pub fn set_entry_point(&mut self, node: impl Into<String>) -> Result<&mut Self> {
        self.state_graph.set_entry_point(node)?;
        Ok(self)
    }

    /// Add exit point
    pub fn add_exit_point(&mut self, node: impl Into<String>) -> Result<&mut Self> {
        self.state_graph.add_exit_point(node)?;
        Ok(self)
    }

    /// Compile the graph
    pub fn compile(&mut self) -> Result<()> {
        self.state_graph.compile()
    }

    /// Execute with messages
    pub async fn execute_with_messages(&self, messages: MessageList) -> Result<MessageList> {
        let mut state = State::new();
        state.set("messages".to_string(), serde_json::to_value(messages)?);

        let result = self.state_graph.execute(state).await?;
        let messages_value = result.get("messages").cloned().unwrap_or(serde_json::json!([]));
        let messages: MessageList = serde_json::from_value(messages_value)?;
        Ok(messages)
    }
}

/// Builder for constructing graphs
pub struct GraphBuilder {
    graph: StateGraph,
}

impl GraphBuilder {
    /// Create a new graph builder
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            graph: StateGraph::new(name),
        }
    }

    /// Add a node
    pub fn add_node(mut self, node: impl Node + 'static) -> Result<Self> {
        self.graph.add_node(node)?;
        Ok(self)
    }

    /// Add an edge
    pub fn add_edge(mut self, from: impl Into<String>, to: impl Into<String>) -> Result<Self> {
        self.graph.add_edge(from, to)?;
        Ok(self)
    }

    /// Set entry point
    pub fn entry_point(mut self, node: impl Into<String>) -> Result<Self> {
        self.graph.set_entry_point(node)?;
        Ok(self)
    }

    /// Add exit point
    pub fn exit_point(mut self, node: impl Into<String>) -> Result<Self> {
        self.graph.add_exit_point(node)?;
        Ok(self)
    }

    /// Build and compile the graph
    pub fn build(mut self) -> Result<StateGraph> {
        self.graph.compile()?;
        Ok(self.graph)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_simple_graph() {
        let node1 = NodeExecutor::new("node1", |mut state| async move {
            state.set("step".to_string(), serde_json::json!(1));
            Ok(state)
        });

        let node2 = NodeExecutor::new("node2", |mut state| async move {
            state.set("step".to_string(), serde_json::json!(2));
            Ok(state)
        });

        let mut graph = StateGraph::new("test_graph");
        graph.add_node(node1).unwrap();
        graph.add_node(node2).unwrap();
        graph.add_edge("node1", "node2").unwrap();
        graph.set_entry_point("node1").unwrap();
        graph.add_exit_point("node2").unwrap();
        graph.compile().unwrap();

        let state = State::new();
        let result = graph.execute(state).await.unwrap();
        assert_eq!(result.get("step"), Some(&serde_json::json!(2)));
    }

    #[tokio::test]
    async fn test_conditional_edge() {
        let node1 = NodeExecutor::new("node1", |mut state| async move {
            state.set("value".to_string(), serde_json::json!(10));
            Ok(state)
        });

        let node2 = NodeExecutor::new("node2", |mut state| async move {
            state.set("path".to_string(), serde_json::json!("a"));
            Ok(state)
        });

        let node3 = NodeExecutor::new("node3", |mut state| async move {
            state.set("path".to_string(), serde_json::json!("b"));
            Ok(state)
        });

        let mut graph = StateGraph::new("conditional_graph");
        graph.add_node(node1).unwrap();
        graph.add_node(node2).unwrap();
        graph.add_node(node3).unwrap();
        graph.add_conditional_edge("node1", "node2", |state| {
            state.get("value")
                .and_then(|v| v.as_i64())
                .map(|v| v > 5)
                .unwrap_or(false)
        }).unwrap();
        graph.set_entry_point("node1").unwrap();
        graph.add_exit_point("node2").unwrap();
        graph.compile().unwrap();

        let state = State::new();
        let result = graph.execute(state).await.unwrap();
        assert_eq!(result.get("path"), Some(&serde_json::json!("a")));
    }

    #[test]
    fn test_cycle_detection() {
        let node1 = NodeExecutor::sync("node1", |state| Ok(state));
        let node2 = NodeExecutor::sync("node2", |state| Ok(state));

        let mut graph = StateGraph::new("cycle_graph");
        graph.add_node(node1).unwrap();
        graph.add_node(node2).unwrap();
        graph.add_edge("node1", "node2").unwrap();
        graph.add_edge("node2", "node1").unwrap(); // Creates a cycle
        graph.set_entry_point("node1").unwrap();

        let result = graph.compile();
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), Error::CycleDetected));
    }
}

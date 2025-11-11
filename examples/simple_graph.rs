//! Simple graph execution example

use langgraph_core::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    println!("=== Simple Graph Example ===\n");

    // Create a graph
    let mut graph = StateGraph::new("simple_workflow");

    // Node 1: Initialize
    let node1 = NodeExecutor::new("initialize", |mut state| async move {
        println!("Executing: initialize");
        state.set("count".to_string(), serde_json::json!(0));
        state.set("message".to_string(), serde_json::json!("Starting..."));
        Ok(state)
    });

    // Node 2: Process
    let node2 = NodeExecutor::new("process", |mut state| async move {
        println!("Executing: process");
        let count = state.get("count")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        state.set("count".to_string(), serde_json::json!(count + 10));
        state.set("message".to_string(), serde_json::json!("Processing..."));
        Ok(state)
    });

    // Node 3: Finalize
    let node3 = NodeExecutor::new("finalize", |mut state| async move {
        println!("Executing: finalize");
        let count = state.get("count")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        state.set("count".to_string(), serde_json::json!(count * 2));
        state.set("message".to_string(), serde_json::json!("Done!"));
        Ok(state)
    });

    // Build the graph
    graph.add_node(node1)?;
    graph.add_node(node2)?;
    graph.add_node(node3)?;
    graph.add_edge("initialize", "process")?;
    graph.add_edge("process", "finalize")?;
    graph.set_entry_point("initialize")?;
    graph.add_exit_point("finalize")?;

    // Compile
    println!("Compiling graph...");
    graph.compile()?;

    // Execute
    println!("Executing graph...\n");
    let initial_state = State::new();
    let result = graph.execute(initial_state).await?;

    // Print results
    println!("\n=== Results ===");
    println!("Final count: {:?}", result.get("count"));
    println!("Final message: {:?}", result.get("message"));
    println!("State version: {}", result.metadata.version);

    Ok(())
}

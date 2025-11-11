//! Quick benchmark for comparison with Python

use langgraph_core::{StateGraph, NodeExecutor, State, Graph};
use std::time::Instant;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("======================================================================");
    println!("Rust LangGraph Benchmark Results");
    println!("======================================================================");

    // 1. Graph Compilation
    println!("\n1. Graph Compilation (100 iterations)");
    println!("----------------------------------------------------------------------");
    let mut times = Vec::new();
    for _ in 0..100 {
        let start = Instant::now();

        let mut graph = StateGraph::new("bench_graph");
        let node1 = NodeExecutor::sync("node1", |mut state| {
            state.set("count".to_string(), serde_json::json!(1));
            Ok(state)
        });
        let node2 = NodeExecutor::sync("node2", |mut state| {
            state.set("count".to_string(), serde_json::json!(2));
            Ok(state)
        });

        graph.add_node(node1)?;
        graph.add_node(node2)?;
        graph.add_edge("node1", "node2")?;
        graph.set_entry_point("node1")?;
        graph.add_exit_point("node2")?;
        graph.compile()?;

        times.push(start.elapsed().as_secs_f64() * 1000.0);
    }

    let mean: f64 = times.iter().sum::<f64>() / times.len() as f64;
    let mut sorted = times.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let median = sorted[sorted.len() / 2];
    let min = sorted[0];
    let max = sorted[sorted.len() - 1];

    println!("  Mean:   {:.3} ms", mean);
    println!("  Median: {:.3} ms", median);
    println!("  Min:    {:.3} ms", min);
    println!("  Max:    {:.3} ms", max);

    // 2. Single Node Execution
    println!("\n2. Single Node Execution (100 iterations)");
    println!("----------------------------------------------------------------------");

    let mut graph = StateGraph::new("bench_graph");
    let node = NodeExecutor::new("node", |mut state| async move {
        state.set("count".to_string(), serde_json::json!(1));
        Ok(state)
    });
    graph.add_node(node)?;
    graph.set_entry_point("node")?;
    graph.add_exit_point("node")?;
    graph.compile()?;

    let mut times = Vec::new();
    for _ in 0..100 {
        let state = State::new();
        let start = Instant::now();
        let _ = graph.execute(state).await?;
        times.push(start.elapsed().as_secs_f64() * 1_000_000.0);
    }

    let mean: f64 = times.iter().sum::<f64>() / times.len() as f64;
    let mut sorted = times.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let median = sorted[sorted.len() / 2];
    let min = sorted[0];
    let max = sorted[sorted.len() - 1];

    println!("  Mean:   {:.3} μs", mean);
    println!("  Median: {:.3} μs", median);
    println!("  Min:    {:.3} μs", min);
    println!("  Max:    {:.3} μs", max);

    // 3. Multi-Node Execution
    println!("\n3. Multi-Node Execution");
    println!("----------------------------------------------------------------------");

    for node_count in [2, 5, 10, 20] {
        let mut graph = StateGraph::new("bench_graph");

        for i in 0..node_count {
            let node = NodeExecutor::new(format!("node_{}", i), |mut state| async move {
                let count = state.get("count")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                state.set("count".to_string(), serde_json::json!(count + 1));
                Ok(state)
            });
            graph.add_node(node)?;
        }

        for i in 0..node_count - 1 {
            graph.add_edge(format!("node_{}", i), format!("node_{}", i + 1))?;
        }

        graph.set_entry_point("node_0")?;
        graph.add_exit_point(format!("node_{}", node_count - 1))?;
        graph.compile()?;

        let mut times = Vec::new();
        for _ in 0..50 {
            let state = State::new();
            let start = Instant::now();
            let _ = graph.execute(state).await?;
            times.push(start.elapsed().as_secs_f64() * 1000.0);
        }

        let mean: f64 = times.iter().sum::<f64>() / times.len() as f64;
        let mut sorted = times.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let median = sorted[sorted.len() / 2];

        println!("  {} nodes:", node_count);
        println!("    Mean:   {:.3} ms", mean);
        println!("    Median: {:.3} ms", median);
    }

    // 4. State Operations
    println!("\n4. State Operations (10000 iterations)");
    println!("----------------------------------------------------------------------");

    // Creation
    let mut times = Vec::new();
    for _ in 0..10000 {
        let start = Instant::now();
        let _ = State::new();
        times.push(start.elapsed().as_secs_f64() * 1_000_000.0);
    }
    let creation_mean: f64 = times.iter().sum::<f64>() / times.len() as f64;
    let mut sorted = times.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let creation_median = sorted[sorted.len() / 2];

    // Set
    let mut state = State::new();
    let mut times = Vec::new();
    for i in 0..10000 {
        let start = Instant::now();
        state.set("count".to_string(), serde_json::json!(i));
        times.push(start.elapsed().as_secs_f64() * 1_000_000.0);
    }
    let set_mean: f64 = times.iter().sum::<f64>() / times.len() as f64;
    let mut sorted = times.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let set_median = sorted[sorted.len() / 2];

    // Get
    let mut times = Vec::new();
    for _ in 0..10000 {
        let start = Instant::now();
        let _ = state.get("count");
        times.push(start.elapsed().as_secs_f64() * 1_000_000.0);
    }
    let get_mean: f64 = times.iter().sum::<f64>() / times.len() as f64;
    let mut sorted = times.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let get_median = sorted[sorted.len() / 2];

    println!("  Creation - Mean: {:.3} μs, Median: {:.3} μs", creation_mean, creation_median);
    println!("  Set      - Mean: {:.3} μs, Median: {:.3} μs", set_mean, set_median);
    println!("  Get      - Mean: {:.3} μs, Median: {:.3} μs", get_mean, get_median);

    println!("\n======================================================================");
    println!("Benchmark Complete");
    println!("======================================================================");

    Ok(())
}

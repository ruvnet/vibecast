//! Comparison benchmarks - directly comparable to Python LangGraph

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use langgraph_core::prelude::*;
use std::time::{Duration, Instant};
use tokio::runtime::Runtime;

fn benchmark_graph_compilation(c: &mut Criterion) {
    c.bench_function("graph_compilation", |b| {
        b.iter(|| {
            let mut graph = StateGraph::new("bench_graph");
            let node1 = NodeExecutor::sync("node1", |mut state| {
                state.set("count".to_string(), serde_json::json!(1));
                Ok(state)
            });
            let node2 = NodeExecutor::sync("node2", |mut state| {
                state.set("count".to_string(), serde_json::json!(2));
                Ok(state)
            });

            graph.add_node(node1).unwrap();
            graph.add_node(node2).unwrap();
            graph.add_edge("node1", "node2").unwrap();
            graph.set_entry_point("node1").unwrap();
            graph.add_exit_point("node2").unwrap();

            black_box(graph.compile()).unwrap();
        });
    });
}

fn benchmark_single_node_execution(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut graph = StateGraph::new("bench_graph");
    let node = NodeExecutor::new("node", |mut state| async move {
        state.set("count".to_string(), serde_json::json!(1));
        Ok(state)
    });
    graph.add_node(node).unwrap();
    graph.set_entry_point("node").unwrap();
    graph.add_exit_point("node").unwrap();
    graph.compile().unwrap();

    c.bench_function("single_node_execution", |b| {
        b.iter(|| {
            let state = State::new();
            black_box(rt.block_on(graph.execute(state))).unwrap();
        });
    });
}

fn benchmark_multi_node_execution(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("multi_node_execution");

    for node_count in [2, 5, 10, 20].iter() {
        let mut graph = StateGraph::new("bench_graph");

        // Add nodes
        for i in 0..*node_count {
            let node = NodeExecutor::new(format!("node_{}", i), |mut state| async move {
                let count = state.get("count")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                state.set("count".to_string(), serde_json::json!(count + 1));
                Ok(state)
            });
            graph.add_node(node).unwrap();
        }

        // Add edges
        for i in 0..node_count - 1 {
            graph.add_edge(format!("node_{}", i), format!("node_{}", i + 1)).unwrap();
        }

        graph.set_entry_point("node_0").unwrap();
        graph.add_exit_point(format!("node_{}", node_count - 1)).unwrap();
        graph.compile().unwrap();

        group.bench_with_input(
            BenchmarkId::from_parameter(node_count),
            node_count,
            |b, _| {
                b.iter(|| {
                    let state = State::new();
                    black_box(rt.block_on(graph.execute(state))).unwrap();
                });
            },
        );
    }
    group.finish();
}

fn benchmark_state_operations(c: &mut Criterion) {
    c.bench_function("state_creation", |b| {
        b.iter(|| {
            black_box(State::new());
        });
    });

    c.bench_function("state_set", |b| {
        let mut state = State::new();
        b.iter(|| {
            state.set("count".to_string(), serde_json::json!(1));
        });
    });

    c.bench_function("state_get", |b| {
        let mut state = State::new();
        state.set("count".to_string(), serde_json::json!(1));
        b.iter(|| {
            black_box(state.get("count"));
        });
    });
}

criterion_group!(
    benches,
    benchmark_graph_compilation,
    benchmark_single_node_execution,
    benchmark_multi_node_execution,
    benchmark_state_operations
);
criterion_main!(benches);

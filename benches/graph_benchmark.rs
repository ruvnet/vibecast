//! Graph execution benchmarks

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use langgraph_core::prelude::*;
use tokio::runtime::Runtime;

fn simple_graph_execution(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    c.bench_function("graph_compilation", |b| {
        b.iter(|| {
            let mut graph = StateGraph::new("bench_graph");
            let node = NodeExecutor::sync("node", |state| Ok(state));
            graph.add_node(node).unwrap();
            graph.set_entry_point("node").unwrap();
            graph.add_exit_point("node").unwrap();
            black_box(graph.compile()).unwrap();
        });
    });

    c.bench_function("single_node_execution", |b| {
        let mut graph = StateGraph::new("bench_graph");
        let node = NodeExecutor::new("node", |state| async move { Ok(state) });
        graph.add_node(node).unwrap();
        graph.set_entry_point("node").unwrap();
        graph.add_exit_point("node").unwrap();
        graph.compile().unwrap();

        b.iter(|| {
            let state = State::new();
            black_box(rt.block_on(graph.execute(state))).unwrap();
        });
    });

    let mut group = c.benchmark_group("multi_node_execution");
    for node_count in [2, 5, 10, 20].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(node_count),
            node_count,
            |b, &node_count| {
                let mut graph = StateGraph::new("bench_graph");

                // Add nodes
                for i in 0..node_count {
                    let node = NodeExecutor::new(format!("node_{}", i), |mut state| async move {
                        state.set("count".to_string(), serde_json::json!(1));
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

                b.iter(|| {
                    let state = State::new();
                    black_box(rt.block_on(graph.execute(state))).unwrap();
                });
            },
        );
    }
    group.finish();
}

fn state_operations(c: &mut Criterion) {
    c.bench_function("state_creation", |b| {
        b.iter(|| {
            black_box(State::new());
        });
    });

    c.bench_function("state_set", |b| {
        let mut state = State::new();
        b.iter(|| {
            state.set("key".to_string(), serde_json::json!("value"));
        });
    });

    c.bench_function("state_get", |b| {
        let mut state = State::new();
        state.set("key".to_string(), serde_json::json!("value"));
        b.iter(|| {
            black_box(state.get("key"));
        });
    });

    c.bench_function("state_merge", |b| {
        let mut state1 = State::new();
        state1.set("a".to_string(), serde_json::json!(1));
        let mut state2 = State::new();
        state2.set("b".to_string(), serde_json::json!(2));

        b.iter(|| {
            let mut s1 = state1.clone();
            black_box(s1.merge(&state2)).unwrap();
        });
    });
}

criterion_group!(benches, simple_graph_execution, state_operations);
criterion_main!(benches);

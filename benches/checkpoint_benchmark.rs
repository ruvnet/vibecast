//! Checkpoint performance benchmarks

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use langgraph_core::prelude::*;
use langgraph_checkpoint::prelude::*;
use tokio::runtime::Runtime;

fn memory_checkpointer_bench(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    c.bench_function("memory_checkpoint_save", |b| {
        let checkpointer = MemoryCheckpointer::new();
        let state = State::new();
        let checkpoint = Checkpoint::new(state);
        let config = CheckpointConfig {
            thread_id: Some("bench".to_string()),
            ..Default::default()
        };

        b.iter(|| {
            let cp = checkpoint.clone();
            let cfg = config.clone();
            black_box(rt.block_on(checkpointer.put(cp, cfg))).unwrap();
        });
    });

    c.bench_function("memory_checkpoint_load", |b| {
        let checkpointer = MemoryCheckpointer::new();
        let state = State::new();
        let checkpoint = Checkpoint::new(state);
        let checkpoint_id = checkpoint.id.clone();
        let config = CheckpointConfig {
            thread_id: Some("bench".to_string()),
            ..Default::default()
        };

        rt.block_on(checkpointer.put(checkpoint, config)).unwrap();

        b.iter(|| {
            black_box(rt.block_on(checkpointer.get_tuple(&checkpoint_id))).unwrap();
        });
    });
}

fn sqlite_checkpointer_bench(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    c.bench_function("sqlite_checkpoint_save", |b| {
        let checkpointer = SqliteCheckpointer::in_memory().unwrap();
        let state = State::new();
        let checkpoint = Checkpoint::new(state);
        let config = CheckpointConfig {
            thread_id: Some("bench".to_string()),
            ..Default::default()
        };

        b.iter(|| {
            let cp = checkpoint.clone();
            let cfg = config.clone();
            black_box(rt.block_on(checkpointer.put(cp, cfg))).unwrap();
        });
    });

    c.bench_function("sqlite_checkpoint_load", |b| {
        let checkpointer = SqliteCheckpointer::in_memory().unwrap();
        let state = State::new();
        let checkpoint = Checkpoint::new(state);
        let checkpoint_id = checkpoint.id.clone();
        let config = CheckpointConfig {
            thread_id: Some("bench".to_string()),
            ..Default::default()
        };

        rt.block_on(checkpointer.put(checkpoint, config)).unwrap();

        b.iter(|| {
            black_box(rt.block_on(checkpointer.get_tuple(&checkpoint_id))).unwrap();
        });
    });

    let mut group = c.benchmark_group("sqlite_checkpoint_list");
    for count in [10, 50, 100, 500].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(count),
            count,
            |b, &count| {
                let checkpointer = SqliteCheckpointer::in_memory().unwrap();

                // Pre-populate
                for i in 0..count {
                    let state = State::new();
                    let checkpoint = Checkpoint::new(state);
                    let config = CheckpointConfig {
                        thread_id: Some("bench".to_string()),
                        ..Default::default()
                    };
                    rt.block_on(checkpointer.put(checkpoint, config)).unwrap();
                }

                b.iter(|| {
                    black_box(rt.block_on(checkpointer.list("bench", Some(10)))).unwrap();
                });
            },
        );
    }
    group.finish();
}

criterion_group!(benches, memory_checkpointer_bench, sqlite_checkpointer_bench);
criterion_main!(benches);

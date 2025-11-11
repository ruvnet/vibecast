//! Checkpoint demonstration

use langgraph_core::State;
use langgraph_checkpoint::{MemoryCheckpointer, Checkpointer, Checkpoint, CheckpointConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("=== Checkpoint Demo ===\n");

    // Create checkpointer
    let checkpointer = MemoryCheckpointer::new();

    // Create and save some checkpoints
    for i in 0..5 {
        let mut state = State::new();
        state.set("iteration".to_string(), serde_json::json!(i));
        state.set("timestamp".to_string(), serde_json::json!(chrono::Utc::now().to_rfc3339()));

        let checkpoint = Checkpoint::new(state);
        let checkpoint_id = checkpoint.id.clone();

        let config = CheckpointConfig {
            thread_id: Some("demo-thread".to_string()),
            ..Default::default()
        };

        checkpointer.put(checkpoint, config).await?;
        println!("Saved checkpoint {}: {}", i, checkpoint_id);
    }

    // List checkpoints
    println!("\n=== Listing Checkpoints ===");
    let checkpoints = checkpointer.list("demo-thread", None).await?;
    println!("Found {} checkpoints", checkpoints.len());

    // Retrieve latest
    println!("\n=== Latest Checkpoint ===");
    if let Some(latest) = checkpointer.get_latest("demo-thread").await? {
        println!("Latest checkpoint ID: {}", latest.checkpoint.id);
        println!("Iteration: {:?}", latest.checkpoint.state.get("iteration"));
    }

    // Performance test
    println!("\n=== Performance Test ===");
    let start = std::time::Instant::now();
    for i in 0..100 {
        let state = State::new();
        let checkpoint = Checkpoint::new(state);
        let config = CheckpointConfig {
            thread_id: Some("perf-test".to_string()),
            ..Default::default()
        };
        checkpointer.put(checkpoint, config).await?;
    }
    let duration = start.elapsed();
    println!("Saved 100 checkpoints in {:?}", duration);
    println!("Average: {:?} per checkpoint", duration / 100);

    Ok(())
}

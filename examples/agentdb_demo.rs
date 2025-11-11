//! AgentDB pattern storage and reflexion demo

use langgraph_core::State;
use langgraph_agentdb::{SqlitePatternStore, MockEmbeddingModel, ReflexionMemory};
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("=== AgentDB Pattern Storage Demo ===\n");

    // Create pattern store
    let pattern_store = Arc::new(SqlitePatternStore::in_memory(384)?);
    let embedding_model = Arc::new(MockEmbeddingModel::standard());
    let reflexion = ReflexionMemory::new(pattern_store.clone(), embedding_model.clone());

    // Create some execution patterns
    println!("Recording execution patterns...");
    for i in 0..10 {
        let mut state = State::new();
        state.set("task_id".to_string(), serde_json::json!(i));
        state.set("result".to_string(), serde_json::json!(format!("Result {}", i)));

        let score = 0.5 + (i as f32 * 0.05);
        reflexion.record_success(
            format!("pattern_{}", i),
            &state,
            score,
        ).await?;

        println!("  Recorded pattern_{} with score {:.2}", i, score);
    }

    // Get best patterns
    println!("\n=== Top Patterns ===");
    let top_patterns = reflexion.get_best_patterns(5).await?;
    for (i, pattern) in top_patterns.iter().enumerate() {
        println!("{}. {} - Score: {:.2}, Usage: {}",
            i + 1,
            pattern.name,
            pattern.score,
            pattern.usage_count
        );
    }

    // Record a failure
    println!("\n=== Recording Failure ===");
    let mut failed_state = State::new();
    failed_state.set("error".to_string(), serde_json::json!("timeout"));
    reflexion.record_failure(
        "failed_pattern".to_string(),
        &failed_state,
        "Task timed out after 30s",
    ).await?;
    println!("Recorded failed pattern");

    // Search for similar patterns
    println!("\n=== Searching Similar Patterns ===");
    let mut query_state = State::new();
    query_state.set("task_id".to_string(), serde_json::json!(5));
    query_state.set("result".to_string(), serde_json::json!("Result 5"));

    let similar = reflexion.recall_similar(&query_state).await?;
    println!("Found {} similar patterns:", similar.len());
    for (i, pattern) in similar.iter().take(3).enumerate() {
        println!("  {}. {} - Score: {:.2}", i + 1, pattern.name, pattern.score);
    }

    // Reflection - update scores based on feedback
    println!("\n=== Reflection ===");
    let feedback = vec![
        (top_patterns[0].id.clone(), 0.95),
        (top_patterns[1].id.clone(), 0.85),
    ];
    reflexion.reflect(feedback).await?;
    println!("Updated pattern scores based on feedback");

    // Verify updates
    let updated_patterns = reflexion.get_best_patterns(5).await?;
    println!("\nUpdated top patterns:");
    for (i, pattern) in updated_patterns.iter().enumerate() {
        println!("{}. {} - Score: {:.2}",
            i + 1,
            pattern.name,
            pattern.score
        );
    }

    Ok(())
}

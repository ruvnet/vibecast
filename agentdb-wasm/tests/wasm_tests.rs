use wasm_bindgen_test::*;
use agentdb_wasm::*;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn test_wasm_db_creation() {
    let db = WasmAgentDb::new();
    let stats = db.get_stats();
    assert!(stats.success());
}

#[wasm_bindgen_test]
fn test_wasm_create_agent() {
    let db = WasmAgentDb::new();
    let result = db.create_agent("Test Agent".to_string(), "worker".to_string());
    assert!(result.success());
}

#[wasm_bindgen_test]
fn test_wasm_create_franchise() {
    let db = WasmAgentDb::new();
    let result = db.create_franchise(
        "Test Franchise".to_string(),
        "owner-123".to_string(),
        "New York".to_string(),
    );
    assert!(result.success());
}

#[wasm_bindgen_test]
fn test_wasm_assign_agent() {
    let db = WasmAgentDb::new();

    let agent_result = db.create_agent("Test Agent".to_string(), "worker".to_string());
    assert!(agent_result.success());

    let franchise_result = db.create_franchise(
        "Test Franchise".to_string(),
        "owner-123".to_string(),
        "New York".to_string(),
    );
    assert!(franchise_result.success());

    // Note: In real test, we'd extract IDs from the results
    // This is a simplified version
}

#[wasm_bindgen_test]
fn test_wasm_query_agents() {
    let db = WasmAgentDb::new();

    db.create_agent("Agent 1".to_string(), "worker".to_string());
    db.create_agent("Agent 2".to_string(), "manager".to_string());

    let filter = serde_wasm_bindgen::to_value(&serde_json::json!({
        "limit": 10
    }))
    .unwrap();

    let result = db.query_agents(filter);
    assert!(result.success());
}

#[wasm_bindgen_test]
fn test_wasm_export_import() {
    let db = WasmAgentDb::new();

    db.create_agent("Test Agent".to_string(), "worker".to_string());

    let export_result = db.export();
    assert!(export_result.success());

    let new_db = WasmAgentDb::new();
    let import_result = new_db.import(export_result.data().as_string().unwrap());
    assert!(import_result.success());
}

#[wasm_bindgen_test]
fn test_wasm_get_events() {
    let db = WasmAgentDb::new();

    db.create_agent("Test Agent".to_string(), "worker".to_string());

    let events = db.get_events(None, Some(10));
    assert!(events.success());
}

#[wasm_bindgen_test]
fn test_wasm_version() {
    let version = version();
    assert!(!version.is_empty());
    assert_eq!(version, env!("CARGO_PKG_VERSION"));
}

#[wasm_bindgen_test]
fn test_wasm_performance_now() {
    let start = now();
    let end = now();
    assert!(end >= start);
}

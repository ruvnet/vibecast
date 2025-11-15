/*!
# AgentDB WASM

High-performance WASM database layer for franchise platform agent management.

## Features

- **In-memory storage** with efficient indexing
- **Event sourcing** for complete audit trails
- **Query interface** with filtering and pagination
- **TypeScript support** with full type definitions
- **Lightweight** and optimized for WASM

## Usage

```javascript
import { WasmAgentDb } from 'agentdb-wasm';

const db = new WasmAgentDb();

// Create an agent
const result = db.createAgent('Agent Smith', 'worker');
if (result.success) {
    console.log('Agent created:', result.data);
}

// Query agents
const agents = db.queryAgents({ status: 'active', limit: 10 });
```
*/

mod database;
mod types;
mod wasm_bindings;

pub use database::{AgentDb, DbError};
pub use types::*;
pub use wasm_bindings::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_creation() {
        let mut db = AgentDb::new();
        let agent = Agent::new("Test Agent".to_string(), AgentRole::Worker);
        let result = db.upsert_agent(agent.clone());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().name, "Test Agent");
    }

    #[test]
    fn test_franchise_creation() {
        let mut db = AgentDb::new();
        let franchise = Franchise::new(
            "Test Franchise".to_string(),
            "owner-123".to_string(),
            "New York".to_string(),
        );
        let result = db.upsert_franchise(franchise.clone());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().name, "Test Franchise");
    }

    #[test]
    fn test_agent_assignment() {
        let mut db = AgentDb::new();

        let agent = Agent::new("Test Agent".to_string(), AgentRole::Worker);
        let agent = db.upsert_agent(agent).unwrap();

        let franchise = Franchise::new(
            "Test Franchise".to_string(),
            "owner-123".to_string(),
            "New York".to_string(),
        );
        let franchise = db.upsert_franchise(franchise).unwrap();

        let result = db.assign_agent_to_franchise(&agent.id, &franchise.id);
        assert!(result.is_ok());

        let updated_agent = db.get_agent(&agent.id).unwrap();
        assert_eq!(updated_agent.franchise_id, Some(franchise.id.clone()));

        let updated_franchise = db.get_franchise(&franchise.id).unwrap();
        assert!(updated_franchise.agents.contains(&agent.id));
    }

    #[test]
    fn test_query_agents() {
        let mut db = AgentDb::new();

        let agent1 = Agent::new("Agent 1".to_string(), AgentRole::Worker);
        let agent2 = Agent::new("Agent 2".to_string(), AgentRole::Manager);

        db.upsert_agent(agent1).unwrap();
        db.upsert_agent(agent2).unwrap();

        let filter = QueryFilter {
            role: Some("Worker".to_string()),
            ..Default::default()
        };

        let results = db.query_agents(&filter);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Agent 1");
    }

    #[test]
    fn test_event_sourcing() {
        let mut db = AgentDb::new();

        let agent = Agent::new("Test Agent".to_string(), AgentRole::Worker);
        let agent = db.upsert_agent(agent).unwrap();

        let events = db.get_events(Some(&agent.id), None);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type, EventType::Created);
    }

    #[test]
    fn test_export_import() {
        let mut db = AgentDb::new();

        let agent = Agent::new("Test Agent".to_string(), AgentRole::Worker);
        db.upsert_agent(agent).unwrap();

        let exported = db.export().unwrap();

        let mut new_db = AgentDb::new();
        new_db.import(&exported).unwrap();

        let stats = new_db.get_stats();
        assert_eq!(stats.total_agents, 1);
    }

    #[test]
    fn test_delete_agent() {
        let mut db = AgentDb::new();

        let agent = Agent::new("Test Agent".to_string(), AgentRole::Worker);
        let agent = db.upsert_agent(agent).unwrap();

        let result = db.delete_agent(&agent.id);
        assert!(result.is_ok());

        let get_result = db.get_agent(&agent.id);
        assert!(get_result.is_err());
    }

    #[test]
    fn test_pagination() {
        let mut db = AgentDb::new();

        for i in 0..10 {
            let agent = Agent::new(format!("Agent {}", i), AgentRole::Worker);
            db.upsert_agent(agent).unwrap();
        }

        let filter = QueryFilter {
            limit: Some(5),
            offset: Some(3),
            ..Default::default()
        };

        let results = db.query_agents(&filter);
        assert_eq!(results.len(), 5);
    }
}

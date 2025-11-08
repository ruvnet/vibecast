use crate::types::*;
use chrono::Utc;
use std::collections::HashMap;
use thiserror::Error;

/// Database errors
#[derive(Error, Debug)]
pub enum DbError {
    #[error("Entity not found: {0}")]
    NotFound(String),
    #[error("Invalid query: {0}")]
    InvalidQuery(String),
    #[error("Duplicate entity: {0}")]
    DuplicateEntity(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Constraint violation: {0}")]
    ConstraintViolation(String),
}

/// Main database structure with in-memory storage
#[derive(Debug, Clone)]
pub struct AgentDb {
    agents: HashMap<String, Agent>,
    franchises: HashMap<String, Franchise>,
    events: Vec<Event>,
    // Indices for faster queries
    agents_by_franchise: HashMap<String, Vec<String>>,
    agents_by_status: HashMap<String, Vec<String>>,
}

impl Default for AgentDb {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentDb {
    /// Create a new database instance
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
            franchises: HashMap::new(),
            events: Vec::new(),
            agents_by_franchise: HashMap::new(),
            agents_by_status: HashMap::new(),
        }
    }

    /// Insert or update an agent
    pub fn upsert_agent(&mut self, mut agent: Agent) -> Result<Agent, DbError> {
        agent.updated_at = Utc::now();
        let agent_id = agent.id.clone();
        let status_key = format!("{:?}", agent.status);

        // Update indices
        if let Some(franchise_id) = &agent.franchise_id {
            self.agents_by_franchise
                .entry(franchise_id.clone())
                .or_insert_with(Vec::new)
                .push(agent_id.clone());
        }

        self.agents_by_status
            .entry(status_key)
            .or_insert_with(Vec::new)
            .push(agent_id.clone());

        // Log event
        let event = Event::new(
            if self.agents.contains_key(&agent_id) {
                EventType::Updated
            } else {
                EventType::Created
            },
            agent_id.clone(),
            EntityType::Agent,
            serde_json::to_value(&agent).map_err(|e| DbError::SerializationError(e.to_string()))?,
        );
        self.events.push(event);

        self.agents.insert(agent_id, agent.clone());
        Ok(agent)
    }

    /// Get agent by ID
    pub fn get_agent(&self, id: &str) -> Result<Agent, DbError> {
        self.agents
            .get(id)
            .cloned()
            .ok_or_else(|| DbError::NotFound(format!("Agent {}", id)))
    }

    /// Query agents with filters
    pub fn query_agents(&self, filter: &QueryFilter) -> Vec<Agent> {
        let mut results: Vec<Agent> = self.agents.values().cloned().collect();

        // Apply filters
        if let Some(franchise_id) = &filter.franchise_id {
            results.retain(|a| a.franchise_id.as_ref() == Some(franchise_id));
        }

        if let Some(status) = &filter.status {
            results.retain(|a| format!("{:?}", a.status).to_lowercase() == status.to_lowercase());
        }

        if let Some(role) = &filter.role {
            results.retain(|a| format!("{:?}", a.role).to_lowercase() == role.to_lowercase());
        }

        // Apply pagination
        let offset = filter.offset.unwrap_or(0);
        let limit = filter.limit.unwrap_or(results.len());

        results.into_iter().skip(offset).take(limit).collect()
    }

    /// Delete agent by ID
    pub fn delete_agent(&mut self, id: &str) -> Result<(), DbError> {
        let agent = self.get_agent(id)?;

        // Remove from indices
        if let Some(franchise_id) = &agent.franchise_id {
            if let Some(agents) = self.agents_by_franchise.get_mut(franchise_id) {
                agents.retain(|aid| aid != id);
            }
        }

        let status_key = format!("{:?}", agent.status);
        if let Some(agents) = self.agents_by_status.get_mut(&status_key) {
            agents.retain(|aid| aid != id);
        }

        // Log event
        let event = Event::new(
            EventType::Deleted,
            id.to_string(),
            EntityType::Agent,
            serde_json::json!({"id": id}),
        );
        self.events.push(event);

        self.agents.remove(id);
        Ok(())
    }

    /// Insert or update a franchise
    pub fn upsert_franchise(&mut self, franchise: Franchise) -> Result<Franchise, DbError> {
        let franchise_id = franchise.id.clone();

        // Log event
        let event = Event::new(
            if self.franchises.contains_key(&franchise_id) {
                EventType::Updated
            } else {
                EventType::Created
            },
            franchise_id.clone(),
            EntityType::Franchise,
            serde_json::to_value(&franchise)
                .map_err(|e| DbError::SerializationError(e.to_string()))?,
        );
        self.events.push(event);

        self.franchises.insert(franchise_id, franchise.clone());
        Ok(franchise)
    }

    /// Get franchise by ID
    pub fn get_franchise(&self, id: &str) -> Result<Franchise, DbError> {
        self.franchises
            .get(id)
            .cloned()
            .ok_or_else(|| DbError::NotFound(format!("Franchise {}", id)))
    }

    /// Query franchises with filters
    pub fn query_franchises(&self, filter: &QueryFilter) -> Vec<Franchise> {
        let mut results: Vec<Franchise> = self.franchises.values().cloned().collect();

        // Apply pagination
        let offset = filter.offset.unwrap_or(0);
        let limit = filter.limit.unwrap_or(results.len());

        results.into_iter().skip(offset).take(limit).collect()
    }

    /// Delete franchise by ID
    pub fn delete_franchise(&mut self, id: &str) -> Result<(), DbError> {
        self.get_franchise(id)?;

        // Log event
        let event = Event::new(
            EventType::Deleted,
            id.to_string(),
            EntityType::Franchise,
            serde_json::json!({"id": id}),
        );
        self.events.push(event);

        // Remove from indices
        self.agents_by_franchise.remove(id);

        self.franchises.remove(id);
        Ok(())
    }

    /// Assign agent to franchise
    pub fn assign_agent_to_franchise(
        &mut self,
        agent_id: &str,
        franchise_id: &str,
    ) -> Result<(), DbError> {
        let mut agent = self.get_agent(agent_id)?;
        let mut franchise = self.get_franchise(franchise_id)?;

        // Update agent
        agent.franchise_id = Some(franchise_id.to_string());
        agent.updated_at = Utc::now();

        // Update franchise
        franchise.add_agent(agent_id.to_string());

        // Log event
        let event = Event::new(
            EventType::Assigned,
            agent_id.to_string(),
            EntityType::Agent,
            serde_json::json!({
                "agent_id": agent_id,
                "franchise_id": franchise_id,
            }),
        );
        self.events.push(event);

        self.agents.insert(agent_id.to_string(), agent);
        self.franchises.insert(franchise_id.to_string(), franchise);

        Ok(())
    }

    /// Unassign agent from franchise
    pub fn unassign_agent_from_franchise(&mut self, agent_id: &str) -> Result<(), DbError> {
        let mut agent = self.get_agent(agent_id)?;

        if let Some(franchise_id) = agent.franchise_id.clone() {
            if let Ok(mut franchise) = self.get_franchise(&franchise_id) {
                franchise.remove_agent(agent_id);
                self.franchises.insert(franchise_id.clone(), franchise);
            }
        }

        agent.franchise_id = None;
        agent.updated_at = Utc::now();

        // Log event
        let event = Event::new(
            EventType::Unassigned,
            agent_id.to_string(),
            EntityType::Agent,
            serde_json::json!({"agent_id": agent_id}),
        );
        self.events.push(event);

        self.agents.insert(agent_id.to_string(), agent);
        Ok(())
    }

    /// Get events for an entity
    pub fn get_events(&self, entity_id: Option<&str>, limit: Option<usize>) -> Vec<Event> {
        let mut events: Vec<Event> = if let Some(id) = entity_id {
            self.events.iter()
                .filter(|e| e.entity_id == id)
                .cloned()
                .collect()
        } else {
            self.events.clone()
        };

        // Sort by timestamp (newest first)
        events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        if let Some(limit) = limit {
            events.truncate(limit);
        }

        events
    }

    /// Get database statistics
    pub fn get_stats(&self) -> DbStats {
        let active_agents = self.agents
            .values()
            .filter(|a| matches!(a.status, AgentStatus::Active | AgentStatus::Busy))
            .count();

        DbStats {
            total_agents: self.agents.len(),
            total_franchises: self.franchises.len(),
            total_events: self.events.len(),
            active_agents,
            memory_usage: self.estimate_memory_usage(),
        }
    }

    /// Estimate memory usage (rough approximation)
    fn estimate_memory_usage(&self) -> usize {
        let agent_size = std::mem::size_of::<Agent>();
        let franchise_size = std::mem::size_of::<Franchise>();
        let event_size = std::mem::size_of::<Event>();

        (self.agents.len() * agent_size)
            + (self.franchises.len() * franchise_size)
            + (self.events.len() * event_size)
    }

    /// Export database state as JSON
    pub fn export(&self) -> Result<String, DbError> {
        let export_data = serde_json::json!({
            "agents": self.agents,
            "franchises": self.franchises,
            "events": self.events,
        });

        serde_json::to_string(&export_data)
            .map_err(|e| DbError::SerializationError(e.to_string()))
    }

    /// Import database state from JSON
    pub fn import(&mut self, json: &str) -> Result<(), DbError> {
        let data: serde_json::Value = serde_json::from_str(json)
            .map_err(|e| DbError::SerializationError(e.to_string()))?;

        if let Some(agents) = data.get("agents") {
            self.agents = serde_json::from_value(agents.clone())
                .map_err(|e| DbError::SerializationError(e.to_string()))?;
        }

        if let Some(franchises) = data.get("franchises") {
            self.franchises = serde_json::from_value(franchises.clone())
                .map_err(|e| DbError::SerializationError(e.to_string()))?;
        }

        if let Some(events) = data.get("events") {
            self.events = serde_json::from_value(events.clone())
                .map_err(|e| DbError::SerializationError(e.to_string()))?;
        }

        // Rebuild indices
        self.rebuild_indices();

        Ok(())
    }

    /// Rebuild internal indices
    fn rebuild_indices(&mut self) {
        self.agents_by_franchise.clear();
        self.agents_by_status.clear();

        for (agent_id, agent) in &self.agents {
            if let Some(franchise_id) = &agent.franchise_id {
                self.agents_by_franchise
                    .entry(franchise_id.clone())
                    .or_insert_with(Vec::new)
                    .push(agent_id.clone());
            }

            let status_key = format!("{:?}", agent.status);
            self.agents_by_status
                .entry(status_key)
                .or_insert_with(Vec::new)
                .push(agent_id.clone());
        }
    }

    /// Clear all data
    pub fn clear(&mut self) {
        self.agents.clear();
        self.franchises.clear();
        self.events.clear();
        self.agents_by_franchise.clear();
        self.agents_by_status.clear();
    }
}

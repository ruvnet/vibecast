use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Agent state representation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub role: AgentRole,
    pub status: AgentStatus,
    pub franchise_id: Option<String>,
    pub capabilities: Vec<String>,
    pub metadata: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Agent roles in the franchise system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgentRole {
    Owner,
    Manager,
    Worker,
    Specialist,
    Coordinator,
}

/// Agent operational status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Active,
    Idle,
    Busy,
    Offline,
    Error,
}

/// Franchise data structure
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Franchise {
    pub id: String,
    pub name: String,
    pub owner_id: String,
    pub location: String,
    pub tier: FranchiseTier,
    pub agents: Vec<String>, // Agent IDs
    pub revenue: f64,
    pub established_at: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

/// Franchise tier levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FranchiseTier {
    Starter,
    Professional,
    Enterprise,
    Elite,
}

/// Event sourcing event for audit trails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub event_type: EventType,
    pub entity_id: String,
    pub entity_type: EntityType,
    pub data: serde_json::Value,
    pub timestamp: DateTime<Utc>,
    pub user_id: Option<String>,
}

/// Types of events in the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    Created,
    Updated,
    Deleted,
    StatusChanged,
    Assigned,
    Unassigned,
    Custom(String),
}

/// Entity types for event sourcing
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EntityType {
    Agent,
    Franchise,
    Task,
    User,
}

/// Query filter for database operations
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct QueryFilter {
    pub entity_type: Option<String>,
    pub status: Option<String>,
    pub franchise_id: Option<String>,
    pub role: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Database statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbStats {
    pub total_agents: usize,
    pub total_franchises: usize,
    pub total_events: usize,
    pub active_agents: usize,
    pub memory_usage: usize,
}

impl Agent {
    pub fn new(name: String, role: AgentRole) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            role,
            status: AgentStatus::Idle,
            franchise_id: None,
            capabilities: Vec::new(),
            metadata: HashMap::new(),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn with_capabilities(mut self, capabilities: Vec<String>) -> Self {
        self.capabilities = capabilities;
        self
    }

    pub fn with_franchise(mut self, franchise_id: String) -> Self {
        self.franchise_id = Some(franchise_id);
        self
    }
}

impl Franchise {
    pub fn new(name: String, owner_id: String, location: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            owner_id,
            location,
            tier: FranchiseTier::Starter,
            agents: Vec::new(),
            revenue: 0.0,
            established_at: Utc::now(),
            metadata: HashMap::new(),
        }
    }

    pub fn add_agent(&mut self, agent_id: String) {
        if !self.agents.contains(&agent_id) {
            self.agents.push(agent_id);
        }
    }

    pub fn remove_agent(&mut self, agent_id: &str) {
        self.agents.retain(|id| id != agent_id);
    }
}

impl Event {
    pub fn new(
        event_type: EventType,
        entity_id: String,
        entity_type: EntityType,
        data: serde_json::Value,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            event_type,
            entity_id,
            entity_type,
            data,
            timestamp: Utc::now(),
            user_id: None,
        }
    }

    pub fn with_user(mut self, user_id: String) -> Self {
        self.user_id = Some(user_id);
        self
    }
}

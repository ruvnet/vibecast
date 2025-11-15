use crate::database::{AgentDb, DbError};
use crate::types::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use web_sys::console;

/// WASM-compatible database wrapper
#[wasm_bindgen]
pub struct WasmAgentDb {
    db: Rc<RefCell<AgentDb>>,
}

/// Result type for WASM operations
#[wasm_bindgen]
pub struct DbResult {
    success: bool,
    error: Option<String>,
    data: JsValue,
}

#[wasm_bindgen]
impl DbResult {
    #[wasm_bindgen(getter)]
    pub fn success(&self) -> bool {
        self.success
    }

    #[wasm_bindgen(getter)]
    pub fn error(&self) -> Option<String> {
        self.error.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn data(&self) -> JsValue {
        self.data.clone()
    }
}

impl DbResult {
    fn ok(data: JsValue) -> Self {
        Self {
            success: true,
            error: None,
            data,
        }
    }

    fn err(error: String) -> Self {
        Self {
            success: false,
            error: Some(error),
            data: JsValue::NULL,
        }
    }
}

#[wasm_bindgen]
impl WasmAgentDb {
    /// Create a new database instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_error_panic_hook::set_once();
        Self {
            db: Rc::new(RefCell::new(AgentDb::new())),
        }
    }

    /// Create an agent
    #[wasm_bindgen(js_name = createAgent)]
    pub fn create_agent(&self, name: String, role: String) -> DbResult {
        let role_enum = match role.to_lowercase().as_str() {
            "owner" => AgentRole::Owner,
            "manager" => AgentRole::Manager,
            "worker" => AgentRole::Worker,
            "specialist" => AgentRole::Specialist,
            "coordinator" => AgentRole::Coordinator,
            _ => return DbResult::err(format!("Invalid role: {}", role)),
        };

        let agent = Agent::new(name, role_enum);

        match self.db.borrow_mut().upsert_agent(agent) {
            Ok(agent) => match serde_wasm_bindgen::to_value(&agent) {
                Ok(val) => DbResult::ok(val),
                Err(e) => DbResult::err(format!("Serialization error: {}", e)),
            },
            Err(e) => DbResult::err(e.to_string()),
        }
    }

    /// Upsert an agent from JS object
    #[wasm_bindgen(js_name = upsertAgent)]
    pub fn upsert_agent(&self, agent_obj: JsValue) -> DbResult {
        match serde_wasm_bindgen::from_value::<Agent>(agent_obj) {
            Ok(agent) => match self.db.borrow_mut().upsert_agent(agent) {
                Ok(agent) => match serde_wasm_bindgen::to_value(&agent) {
                    Ok(val) => DbResult::ok(val),
                    Err(e) => DbResult::err(format!("Serialization error: {}", e)),
                },
                Err(e) => DbResult::err(e.to_string()),
            },
            Err(e) => DbResult::err(format!("Invalid agent object: {}", e)),
        }
    }

    /// Get agent by ID
    #[wasm_bindgen(js_name = getAgent)]
    pub fn get_agent(&self, id: String) -> DbResult {
        match self.db.borrow().get_agent(&id) {
            Ok(agent) => match serde_wasm_bindgen::to_value(&agent) {
                Ok(val) => DbResult::ok(val),
                Err(e) => DbResult::err(format!("Serialization error: {}", e)),
            },
            Err(e) => DbResult::err(e.to_string()),
        }
    }

    /// Query agents with filter
    #[wasm_bindgen(js_name = queryAgents)]
    pub fn query_agents(&self, filter_obj: JsValue) -> DbResult {
        let filter: QueryFilter = match serde_wasm_bindgen::from_value(filter_obj) {
            Ok(f) => f,
            Err(e) => return DbResult::err(format!("Invalid filter: {}", e)),
        };

        let agents = self.db.borrow().query_agents(&filter);

        match serde_wasm_bindgen::to_value(&agents) {
            Ok(val) => DbResult::ok(val),
            Err(e) => DbResult::err(format!("Serialization error: {}", e)),
        }
    }

    /// Delete agent by ID
    #[wasm_bindgen(js_name = deleteAgent)]
    pub fn delete_agent(&self, id: String) -> DbResult {
        match self.db.borrow_mut().delete_agent(&id) {
            Ok(_) => DbResult::ok(JsValue::from_str("deleted")),
            Err(e) => DbResult::err(e.to_string()),
        }
    }

    /// Create a franchise
    #[wasm_bindgen(js_name = createFranchise)]
    pub fn create_franchise(&self, name: String, owner_id: String, location: String) -> DbResult {
        let franchise = Franchise::new(name, owner_id, location);

        match self.db.borrow_mut().upsert_franchise(franchise) {
            Ok(franchise) => match serde_wasm_bindgen::to_value(&franchise) {
                Ok(val) => DbResult::ok(val),
                Err(e) => DbResult::err(format!("Serialization error: {}", e)),
            },
            Err(e) => DbResult::err(e.to_string()),
        }
    }

    /// Upsert a franchise from JS object
    #[wasm_bindgen(js_name = upsertFranchise)]
    pub fn upsert_franchise(&self, franchise_obj: JsValue) -> DbResult {
        match serde_wasm_bindgen::from_value::<Franchise>(franchise_obj) {
            Ok(franchise) => match self.db.borrow_mut().upsert_franchise(franchise) {
                Ok(franchise) => match serde_wasm_bindgen::to_value(&franchise) {
                    Ok(val) => DbResult::ok(val),
                    Err(e) => DbResult::err(format!("Serialization error: {}", e)),
                },
                Err(e) => DbResult::err(e.to_string()),
            },
            Err(e) => DbResult::err(format!("Invalid franchise object: {}", e)),
        }
    }

    /// Get franchise by ID
    #[wasm_bindgen(js_name = getFranchise)]
    pub fn get_franchise(&self, id: String) -> DbResult {
        match self.db.borrow().get_franchise(&id) {
            Ok(franchise) => match serde_wasm_bindgen::to_value(&franchise) {
                Ok(val) => DbResult::ok(val),
                Err(e) => DbResult::err(format!("Serialization error: {}", e)),
            },
            Err(e) => DbResult::err(e.to_string()),
        }
    }

    /// Query franchises with filter
    #[wasm_bindgen(js_name = queryFranchises)]
    pub fn query_franchises(&self, filter_obj: JsValue) -> DbResult {
        let filter: QueryFilter = match serde_wasm_bindgen::from_value(filter_obj) {
            Ok(f) => f,
            Err(e) => return DbResult::err(format!("Invalid filter: {}", e)),
        };

        let franchises = self.db.borrow().query_franchises(&filter);

        match serde_wasm_bindgen::to_value(&franchises) {
            Ok(val) => DbResult::ok(val),
            Err(e) => DbResult::err(format!("Serialization error: {}", e)),
        }
    }

    /// Delete franchise by ID
    #[wasm_bindgen(js_name = deleteFranchise)]
    pub fn delete_franchise(&self, id: String) -> DbResult {
        match self.db.borrow_mut().delete_franchise(&id) {
            Ok(_) => DbResult::ok(JsValue::from_str("deleted")),
            Err(e) => DbResult::err(e.to_string()),
        }
    }

    /// Assign agent to franchise
    #[wasm_bindgen(js_name = assignAgent)]
    pub fn assign_agent(&self, agent_id: String, franchise_id: String) -> DbResult {
        match self
            .db
            .borrow_mut()
            .assign_agent_to_franchise(&agent_id, &franchise_id)
        {
            Ok(_) => DbResult::ok(JsValue::from_str("assigned")),
            Err(e) => DbResult::err(e.to_string()),
        }
    }

    /// Unassign agent from franchise
    #[wasm_bindgen(js_name = unassignAgent)]
    pub fn unassign_agent(&self, agent_id: String) -> DbResult {
        match self.db.borrow_mut().unassign_agent_from_franchise(&agent_id) {
            Ok(_) => DbResult::ok(JsValue::from_str("unassigned")),
            Err(e) => DbResult::err(e.to_string()),
        }
    }

    /// Get events for an entity
    #[wasm_bindgen(js_name = getEvents)]
    pub fn get_events(&self, entity_id: Option<String>, limit: Option<usize>) -> DbResult {
        let events = self
            .db
            .borrow()
            .get_events(entity_id.as_deref(), limit);

        match serde_wasm_bindgen::to_value(&events) {
            Ok(val) => DbResult::ok(val),
            Err(e) => DbResult::err(format!("Serialization error: {}", e)),
        }
    }

    /// Get database statistics
    #[wasm_bindgen(js_name = getStats)]
    pub fn get_stats(&self) -> DbResult {
        let stats = self.db.borrow().get_stats();

        match serde_wasm_bindgen::to_value(&stats) {
            Ok(val) => DbResult::ok(val),
            Err(e) => DbResult::err(format!("Serialization error: {}", e)),
        }
    }

    /// Export database as JSON string
    #[wasm_bindgen(js_name = export)]
    pub fn export(&self) -> DbResult {
        match self.db.borrow().export() {
            Ok(json) => DbResult::ok(JsValue::from_str(&json)),
            Err(e) => DbResult::err(e.to_string()),
        }
    }

    /// Import database from JSON string
    #[wasm_bindgen(js_name = import)]
    pub fn import(&self, json: String) -> DbResult {
        match self.db.borrow_mut().import(&json) {
            Ok(_) => DbResult::ok(JsValue::from_str("imported")),
            Err(e) => DbResult::err(e.to_string()),
        }
    }

    /// Clear all data
    #[wasm_bindgen(js_name = clear)]
    pub fn clear(&self) -> DbResult {
        self.db.borrow_mut().clear();
        DbResult::ok(JsValue::from_str("cleared"))
    }

    /// Log a message (for debugging)
    #[wasm_bindgen(js_name = logInfo)]
    pub fn log_info(&self, message: String) {
        console::log_1(&JsValue::from_str(&message));
    }
}

/// Utility functions for performance measurement
#[wasm_bindgen]
pub fn now() -> f64 {
    web_sys::window()
        .expect("should have a Window")
        .performance()
        .expect("should have a Performance")
        .now()
}

/// Get WASM module version
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

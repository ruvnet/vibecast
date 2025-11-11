//! Message types for MessageGraph

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A message in the message graph
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Message {
    /// Role of the message sender (e.g., "user", "assistant", "system")
    pub role: String,

    /// Content of the message
    pub content: String,

    /// Optional name of the sender
    pub name: Option<String>,

    /// Additional metadata
    pub metadata: HashMap<String, serde_json::Value>,

    /// Timestamp of message creation
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl Message {
    /// Create a new message
    pub fn new(role: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            role: role.into(),
            content: content.into(),
            name: None,
            metadata: HashMap::new(),
            timestamp: chrono::Utc::now(),
        }
    }

    /// Create a user message
    pub fn user(content: impl Into<String>) -> Self {
        Self::new("user", content)
    }

    /// Create an assistant message
    pub fn assistant(content: impl Into<String>) -> Self {
        Self::new("assistant", content)
    }

    /// Create a system message
    pub fn system(content: impl Into<String>) -> Self {
        Self::new("system", content)
    }

    /// Set the name of the sender
    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: String, value: serde_json::Value) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

/// A collection of messages
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MessageList {
    /// The messages
    pub messages: Vec<Message>,
}

impl MessageList {
    /// Create a new empty message list
    pub fn new() -> Self {
        Self {
            messages: Vec::new(),
        }
    }

    /// Add a message
    pub fn push(&mut self, message: Message) {
        self.messages.push(message);
    }

    /// Get the number of messages
    pub fn len(&self) -> usize {
        self.messages.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }

    /// Get an iterator over messages
    pub fn iter(&self) -> impl Iterator<Item = &Message> {
        self.messages.iter()
    }

    /// Get the last message
    pub fn last(&self) -> Option<&Message> {
        self.messages.last()
    }

    /// Filter messages by role
    pub fn filter_by_role(&self, role: &str) -> Vec<&Message> {
        self.messages
            .iter()
            .filter(|m| m.role == role)
            .collect()
    }
}

impl FromIterator<Message> for MessageList {
    fn from_iter<T: IntoIterator<Item = Message>>(iter: T) -> Self {
        Self {
            messages: iter.into_iter().collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_creation() {
        let msg = Message::user("Hello");
        assert_eq!(msg.role, "user");
        assert_eq!(msg.content, "Hello");
    }

    #[test]
    fn test_message_with_name() {
        let msg = Message::user("Hello").with_name("Alice");
        assert_eq!(msg.name, Some("Alice".to_string()));
    }

    #[test]
    fn test_message_list() {
        let mut list = MessageList::new();
        list.push(Message::user("Hello"));
        list.push(Message::assistant("Hi there"));
        assert_eq!(list.len(), 2);
        assert_eq!(list.filter_by_role("user").len(), 1);
    }
}

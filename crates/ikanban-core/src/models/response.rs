use serde::{Deserialize, Serialize};

/// Standard API response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(message: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.to_string()),
        }
    }
}

/// WebSocket event message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsEvent {
    // Project events
    ProjectCreated(super::Project),
    ProjectUpdated(super::Project),
    ProjectDeleted { id: uuid::Uuid },

    // Task events
    TaskCreated(super::Task),
    TaskUpdated(super::Task),
    TaskDeleted { id: uuid::Uuid },

    // Connection events
    Connected,
    Ping,
    Pong,
}

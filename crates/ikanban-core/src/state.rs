use sqlx::SqlitePool;
use tokio::sync::broadcast;

use crate::models::WsEvent;

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub event_tx: broadcast::Sender<WsEvent>,
}

impl AppState {
    pub fn new(pool: SqlitePool) -> Self {
        // Create broadcast channel for events with buffer of 100 messages
        let (event_tx, _) = broadcast::channel(100);

        Self { pool, event_tx }
    }

    /// Broadcast an event to all connected WebSocket clients
    pub fn broadcast(&self, event: WsEvent) {
        // Ignore send errors (no receivers connected)
        let _ = self.event_tx.send(event);
    }

    /// Subscribe to events
    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.event_tx.subscribe()
    }
}

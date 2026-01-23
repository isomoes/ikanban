use crate::db::models::{LogEntry, LogType, Session, SessionStatus};
use crate::executor::{ExecutionEnv, Executor, LogMsg, MsgStore};
use crate::worktree::WorktreeManager;
use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

/// Container for a running session
struct SessionContainer {
    session: Session,
    msg_store: Arc<MsgStore>,
    child: Option<tokio::process::Child>,
}

pub struct SessionManager {
    pool: SqlitePool,
    worktree_manager: WorktreeManager,
    sessions: Arc<RwLock<HashMap<String, SessionContainer>>>,
}

impl SessionManager {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            worktree_manager: WorktreeManager::new(),
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new session with worktree and spawn agent
    pub async fn create_session(
        &self,
        task_id: &str,
        project_path: &Path,
        prompt: &str,
        executor: &dyn Executor,
        branch_name: Option<&str>,
    ) -> Result<Session> {
        let session_id = Uuid::new_v4().to_string();
        let default_branch = format!("task/{}", task_id);
        let branch = branch_name.unwrap_or(&default_branch);

        // Create worktree
        let worktree_path = self
            .worktree_manager
            .create_worktree(project_path, task_id, branch)
            .context("Failed to create worktree")?;

        // Create session record
        let now = Utc::now();
        let session = Session {
            id: session_id.clone(),
            task_id: task_id.to_string(),
            worktree_path: Some(worktree_path.clone()),
            branch_name: Some(branch.to_string()),
            executor_type: executor.executor_type().to_string(),
            status: SessionStatus::Running,
            exit_code: None,
            created_at: now,
            started_at: Some(now),
            finished_at: None,
        };

        // Insert into database
        sqlx::query(
            r#"
            INSERT INTO sessions (
                id, task_id, worktree_path, branch_name, executor_type,
                status, exit_code, created_at, started_at, finished_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&session.id)
        .bind(&session.task_id)
        .bind(session.worktree_path.as_ref().map(|p| p.to_string_lossy().to_string()))
        .bind(&session.branch_name)
        .bind(&session.executor_type)
        .bind(session.status.to_string())
        .bind(&session.exit_code)
        .bind(&session.created_at)
        .bind(&session.started_at)
        .bind(&session.finished_at)
        .execute(&self.pool)
        .await
        .context("Failed to insert session into database")?;

        // Create execution environment
        let env = ExecutionEnv::new()
            .with_repo_path(project_path.to_path_buf())
            .with_env_var("TASK_ID".to_string(), task_id.to_string());

        // Create message store
        let msg_store = MsgStore::new();

        // Spawn executor
        let mut spawned = executor
            .spawn(&worktree_path, prompt, &env)
            .await
            .context("Failed to spawn executor")?;

        // Store session container
        let container = SessionContainer {
            session: session.clone(),
            msg_store: msg_store.clone(),
            child: Some(spawned.child),
        };

        self.sessions
            .write()
            .await
            .insert(session_id.clone(), container);

        // Spawn background task to monitor session
        let session_id_clone = session_id.clone();
        let pool_clone = self.pool.clone();
        let sessions_clone = self.sessions.clone();
        let exit_signal = spawned.exit_signal.take();

        tokio::spawn(async move {
            if let Some(exit_rx) = exit_signal {
                let _ = exit_rx.await;
            }

            // Update session status
            let mut sessions = sessions_clone.write().await;
            if let Some(container) = sessions.get_mut(&session_id_clone) {
                container.session.status = SessionStatus::Completed;
                container.session.finished_at = Some(Utc::now());

                // Update database
                let _ = sqlx::query(
                    r#"
                    UPDATE sessions
                    SET status = ?, finished_at = ?
                    WHERE id = ?
                    "#,
                )
                .bind(container.session.status.to_string())
                .bind(&container.session.finished_at)
                .bind(&session_id_clone)
                .execute(&pool_clone)
                .await;
            }
        });

        Ok(session)
    }

    /// Stop a running session
    pub async fn stop_session(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;

        if let Some(container) = sessions.get_mut(session_id) {
            // Kill the child process
            if let Some(child) = &mut container.child {
                child.kill().await.context("Failed to kill child process")?;
            }

            // Update status
            container.session.status = SessionStatus::Killed;
            container.session.finished_at = Some(Utc::now());

            // Update database
            sqlx::query(
                r#"
                UPDATE sessions
                SET status = ?, finished_at = ?
                WHERE id = ?
                "#,
            )
            .bind(container.session.status.to_string())
            .bind(&container.session.finished_at)
            .bind(session_id)
            .execute(&self.pool)
            .await
            .context("Failed to update session status")?;
        }

        Ok(())
    }

    /// Cleanup session and remove worktree
    pub async fn cleanup_session(&self, session_id: &str, _delete_branch: bool) -> Result<()> {
        // Get session info
        let session = sqlx::query_as::<_, Session>(
            r#"
            SELECT * FROM sessions WHERE id = ?
            "#,
        )
        .bind(session_id)
        .fetch_one(&self.pool)
        .await
        .context("Session not found")?;

        // Remove worktree if it exists
        if let Some(worktree_path) = &session.worktree_path {
            self.worktree_manager
                .remove_worktree(worktree_path)
                .context("Failed to remove worktree")?;

            // TODO: Optionally delete branch if delete_branch is true
            // This would require additional git commands
        }

        // Remove from active sessions
        self.sessions.write().await.remove(session_id);

        Ok(())
    }

    /// Get logs for a session
    pub async fn get_logs(&self, session_id: &str) -> Result<Vec<LogEntry>> {
        let logs = sqlx::query_as::<_, LogEntry>(
            r#"
            SELECT * FROM log_entries
            WHERE session_id = ?
            ORDER BY timestamp ASC
            "#,
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
        .context("Failed to fetch logs")?;

        Ok(logs)
    }

    /// Subscribe to live logs for a session
    pub async fn subscribe_logs(&self, session_id: &str) -> Result<broadcast::Receiver<LogMsg>> {
        let sessions = self.sessions.read().await;

        if let Some(container) = sessions.get(session_id) {
            Ok(container.msg_store.subscribe())
        } else {
            anyhow::bail!("Session not found or not running")
        }
    }

    /// Get a session by ID
    pub async fn get_session(&self, session_id: &str) -> Result<Session> {
        let session = sqlx::query_as::<_, Session>(
            r#"
            SELECT * FROM sessions WHERE id = ?
            "#,
        )
        .bind(session_id)
        .fetch_one(&self.pool)
        .await
        .context("Session not found")?;

        Ok(session)
    }

    /// List all sessions for a task
    pub async fn list_sessions(&self, task_id: &str) -> Result<Vec<Session>> {
        let sessions = sqlx::query_as::<_, Session>(
            r#"
            SELECT * FROM sessions
            WHERE task_id = ?
            ORDER BY created_at DESC
            "#,
        )
        .bind(task_id)
        .fetch_all(&self.pool)
        .await
        .context("Failed to fetch sessions")?;

        Ok(sessions)
    }

    /// Save a log entry to the database
    pub async fn save_log_entry(
        &self,
        session_id: &str,
        log_type: LogType,
        content: &str,
    ) -> Result<()> {
        let log_id = Uuid::new_v4().to_string();
        let timestamp = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO log_entries (id, session_id, timestamp, log_type, content)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&log_id)
        .bind(session_id)
        .bind(&timestamp)
        .bind(log_type.to_string())
        .bind(content)
        .execute(&self.pool)
        .await
        .context("Failed to insert log entry")?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::create_pool;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_session_manager_creation() {
        let dir = TempDir::new().unwrap();
        let db_path = dir.path().join("test.db");
        let pool = create_pool(&db_path).await.unwrap();

        let manager = SessionManager::new(pool);
        assert!(manager.sessions.read().await.is_empty());
    }
}

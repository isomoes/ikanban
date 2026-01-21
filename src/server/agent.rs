use crate::server::db::DbPool;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::{broadcast, mpsc, RwLock};

#[derive(Debug, Clone)]
pub enum AgentEvent {
    OutputLine(String),
    StderrLine(String),
    TurnStarted { turn_number: i64 },
    TurnCompleted { turn_number: i64, output: String },
    ProcessStarted { pid: u32 },
    ProcessExited { exit_code: Option<i32> },
    Error(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentProcessStatus {
    Starting,
    Running,
    Completed,
    Failed,
    Cancelled,
}

pub struct OutputBuffer {
    lines: Vec<String>,
    max_lines: usize,
}

impl OutputBuffer {
    pub fn new(max_lines: usize) -> Self {
        Self {
            lines: Vec::new(),
            max_lines,
        }
    }

    pub fn push(&mut self, line: String) {
        self.lines.push(line);
        if self.lines.len() > self.max_lines {
            self.lines.remove(0);
        }
    }

    pub fn get_all(&self) -> Vec<String> {
        self.lines.clone()
    }

    pub fn get_recent(&self, count: usize) -> Vec<String> {
        let start = self.lines.len().saturating_sub(count);
        self.lines[start..].to_vec()
    }

    pub fn clear(&mut self) {
        self.lines.clear();
    }
}

struct RunningAgent {
    #[allow(dead_code)]
    execution_id: String,
    status: AgentProcessStatus,
    current_turn: i64,
    stdout_buffer: OutputBuffer,
    stderr_buffer: OutputBuffer,
    event_tx: broadcast::Sender<AgentEvent>,
    cancel_tx: Option<mpsc::Sender<()>>,
}

pub struct AgentProcessManager {
    pool: DbPool,
    running_agents: Arc<RwLock<HashMap<String, RunningAgent>>>,
}

impl AgentProcessManager {
    pub fn new(pool: DbPool) -> Self {
        Self {
            pool,
            running_agents: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn spawn_agent(
        &self,
        session_id: &str,
        execution_id: &str,
        worktree_path: &str,
        prompt: &str,
        model: Option<&str>,
    ) -> Result<broadcast::Receiver<AgentEvent>, AgentError> {
        let (event_tx, event_rx) = broadcast::channel(256);
        let (cancel_tx, mut cancel_rx) = mpsc::channel::<()>(1);

        let mut cmd = Command::new("claude");
        cmd.arg("--print")
            .arg("--dangerously-skip-permissions")
            .arg(prompt)
            .current_dir(worktree_path)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(m) = model {
            cmd.arg("--model").arg(m);
        }

        let mut child = cmd.spawn().map_err(|e| {
            AgentError::SpawnFailed(format!("Failed to spawn claude process: {}", e))
        })?;

        let pid = child.id();
        if let Some(p) = pid {
            let _ = event_tx.send(AgentEvent::ProcessStarted { pid: p });
        }

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let running_agent = RunningAgent {
            execution_id: execution_id.to_string(),
            status: AgentProcessStatus::Starting,
            current_turn: 0,
            stdout_buffer: OutputBuffer::new(10000),
            stderr_buffer: OutputBuffer::new(1000),
            event_tx: event_tx.clone(),
            cancel_tx: Some(cancel_tx),
        };

        {
            let mut agents = self.running_agents.write().await;
            agents.insert(session_id.to_string(), running_agent);
        }

        if let Some(p) = pid {
            sqlx::query("UPDATE execution_processes SET pid = ?, status = ? WHERE id = ?")
                .bind(p as i64)
                .bind("running")
                .bind(execution_id)
                .execute(&self.pool)
                .await
                .ok();
        }

        let pool = self.pool.clone();
        let exec_id = execution_id.to_string();
        let sess_id = session_id.to_string();
        let agents = self.running_agents.clone();

        if let Some(stdout) = stdout {
            let stdout_event_tx = event_tx.clone();
            let stdout_session_id = sess_id.clone();
            let stdout_agents = agents.clone();
            let stdout_pool = pool.clone();
            let stdout_exec_id = exec_id.clone();

            tokio::spawn(async move {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();
                let mut turn_number = 0i64;
                let mut accumulated_output = String::new();

                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = stdout_event_tx.send(AgentEvent::OutputLine(line.clone()));

                    accumulated_output.push_str(&line);
                    accumulated_output.push('\n');

                    {
                        let mut agents_lock = stdout_agents.write().await;
                        if let Some(agent) = agents_lock.get_mut(&stdout_session_id) {
                            agent.stdout_buffer.push(line.clone());
                            agent.status = AgentProcessStatus::Running;
                        }
                    }

                    if line.contains("---") || line.starts_with("## ") {
                        turn_number += 1;
                        let _ = stdout_event_tx.send(AgentEvent::TurnStarted { turn_number });

                        {
                            let mut agents_lock = stdout_agents.write().await;
                            if let Some(agent) = agents_lock.get_mut(&stdout_session_id) {
                                agent.current_turn = turn_number;
                            }
                        }
                    }
                }

                turn_number = turn_number.max(1);
                let turn_id = format!("{}-turn-{}", stdout_exec_id, turn_number);
                let now = chrono_now();

                let _ = sqlx::query(
                    r#"
                    INSERT INTO coding_agent_turns (id, execution_id, turn_number, output, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    "#,
                )
                .bind(&turn_id)
                .bind(&stdout_exec_id)
                .bind(turn_number)
                .bind(&accumulated_output)
                .bind(&now)
                .execute(&stdout_pool)
                .await;

                let _ = stdout_event_tx.send(AgentEvent::TurnCompleted {
                    turn_number,
                    output: accumulated_output,
                });
            });
        }

        if let Some(stderr) = stderr {
            let stderr_event_tx = event_tx.clone();
            let stderr_session_id = sess_id.clone();
            let stderr_agents = agents.clone();

            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = stderr_event_tx.send(AgentEvent::StderrLine(line.clone()));

                    let mut agents_lock = stderr_agents.write().await;
                    if let Some(agent) = agents_lock.get_mut(&stderr_session_id) {
                        agent.stderr_buffer.push(line);
                    }
                }
            });
        }

        let wait_event_tx = event_tx.clone();
        let wait_session_id = sess_id.clone();
        let wait_exec_id = exec_id.clone();
        let wait_agents = agents.clone();
        let wait_pool = pool.clone();

        tokio::spawn(async move {
            tokio::select! {
                result = child.wait() => {
                    let exit_code = result.ok().and_then(|s| s.code());
                    let _ = wait_event_tx.send(AgentEvent::ProcessExited { exit_code });

                    let now = chrono_now();
                    let status = if exit_code == Some(0) { "completed" } else { "failed" };

                    let _ = sqlx::query(
                        "UPDATE execution_processes SET status = ?, ended_at = ? WHERE id = ?"
                    )
                    .bind(status)
                    .bind(&now)
                    .bind(&wait_exec_id)
                    .execute(&wait_pool)
                    .await;

                    let mut agents_lock = wait_agents.write().await;
                    if let Some(agent) = agents_lock.get_mut(&wait_session_id) {
                        agent.status = if exit_code == Some(0) {
                            AgentProcessStatus::Completed
                        } else {
                            AgentProcessStatus::Failed
                        };
                    }
                }
                _ = cancel_rx.recv() => {
                    let _ = child.kill().await;
                    let _ = wait_event_tx.send(AgentEvent::ProcessExited { exit_code: None });

                    let now = chrono_now();
                    let _ = sqlx::query(
                        "UPDATE execution_processes SET status = ?, ended_at = ? WHERE id = ?"
                    )
                    .bind("cancelled")
                    .bind(&now)
                    .bind(&wait_exec_id)
                    .execute(&wait_pool)
                    .await;

                    let mut agents_lock = wait_agents.write().await;
                    if let Some(agent) = agents_lock.get_mut(&wait_session_id) {
                        agent.status = AgentProcessStatus::Cancelled;
                    }
                }
            }
        });

        Ok(event_rx)
    }

    pub async fn kill_agent(&self, session_id: &str) -> Result<(), AgentError> {
        let mut agents = self.running_agents.write().await;
        if let Some(agent) = agents.get_mut(session_id) {
            if let Some(cancel_tx) = agent.cancel_tx.take() {
                let _ = cancel_tx.send(()).await;
            }
            Ok(())
        } else {
            Err(AgentError::NotFound(session_id.to_string()))
        }
    }

    pub async fn get_status(&self, session_id: &str) -> Option<AgentProcessStatus> {
        let agents = self.running_agents.read().await;
        agents.get(session_id).map(|a| a.status)
    }

    pub async fn get_current_turn(&self, session_id: &str) -> Option<i64> {
        let agents = self.running_agents.read().await;
        agents.get(session_id).map(|a| a.current_turn)
    }

    pub async fn get_stdout_buffer(&self, session_id: &str) -> Option<Vec<String>> {
        let agents = self.running_agents.read().await;
        agents.get(session_id).map(|a| a.stdout_buffer.get_all())
    }

    pub async fn get_stderr_buffer(&self, session_id: &str) -> Option<Vec<String>> {
        let agents = self.running_agents.read().await;
        agents.get(session_id).map(|a| a.stderr_buffer.get_all())
    }

    pub async fn get_recent_output(&self, session_id: &str, lines: usize) -> Option<Vec<String>> {
        let agents = self.running_agents.read().await;
        agents
            .get(session_id)
            .map(|a| a.stdout_buffer.get_recent(lines))
    }

    pub async fn subscribe(&self, session_id: &str) -> Option<broadcast::Receiver<AgentEvent>> {
        let agents = self.running_agents.read().await;
        agents.get(session_id).map(|a| a.event_tx.subscribe())
    }

    pub async fn is_running(&self, session_id: &str) -> bool {
        let agents = self.running_agents.read().await;
        agents.get(session_id).map_or(false, |a| {
            matches!(
                a.status,
                AgentProcessStatus::Starting | AgentProcessStatus::Running
            )
        })
    }

    pub async fn wait_for_completion(
        &self,
        session_id: &str,
    ) -> Result<AgentProcessStatus, AgentError> {
        let rx = self.subscribe(session_id).await;
        let Some(mut rx) = rx else {
            return Err(AgentError::NotFound(session_id.to_string()));
        };

        loop {
            match rx.recv().await {
                Ok(AgentEvent::ProcessExited { .. }) => {
                    return self
                        .get_status(session_id)
                        .await
                        .ok_or_else(|| AgentError::NotFound(session_id.to_string()));
                }
                Ok(AgentEvent::Error(_)) => {
                    return Ok(AgentProcessStatus::Failed);
                }
                Err(broadcast::error::RecvError::Closed) => {
                    return self
                        .get_status(session_id)
                        .await
                        .ok_or_else(|| AgentError::NotFound(session_id.to_string()));
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                _ => continue,
            }
        }
    }

    pub async fn cleanup_finished(&self) {
        let mut agents = self.running_agents.write().await;
        agents.retain(|_, agent| {
            matches!(
                agent.status,
                AgentProcessStatus::Starting | AgentProcessStatus::Running
            )
        });
    }

    pub async fn list_running(&self) -> Vec<String> {
        let agents = self.running_agents.read().await;
        agents
            .iter()
            .filter(|(_, a)| {
                matches!(
                    a.status,
                    AgentProcessStatus::Starting | AgentProcessStatus::Running
                )
            })
            .map(|(id, _)| id.clone())
            .collect()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("Failed to spawn agent: {0}")]
    SpawnFailed(String),
    #[error("Agent not found: {0}")]
    NotFound(String),
    #[error("Failed to kill agent: {0}")]
    KillFailed(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    let secs = duration.as_secs();
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        1970 + secs / 31536000,
        (secs % 31536000) / 2592000 + 1,
        (secs % 2592000) / 86400 + 1,
        (secs % 86400) / 3600,
        (secs % 3600) / 60,
        secs % 60
    )
}

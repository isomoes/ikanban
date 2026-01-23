use std::{path::Path, sync::Arc, time::Duration};

use anyhow::Result;
use async_trait::async_trait;
use tokio::{
    io::AsyncBufReadExt,
    process::Command,
    sync::{mpsc, oneshot},
};

use super::{msg_store::MsgStore, ExecutionEnv, Executor, SpawnedChild};

pub mod normalize;
pub mod sdk;
pub mod types;

pub use types::{OpencodeExecutorEvent, SdkEvent};

use sdk::{run_session, RunConfig};

/// OpenCode executor configuration
#[derive(Debug, Clone)]
pub struct OpenCodeExecutor {
    /// AI model to use (optional)
    pub model: Option<String>,
    /// Auto-approve agent actions
    pub auto_approve: bool,
}

impl OpenCodeExecutor {
    /// Create a new OpenCodeExecutor with default settings
    pub fn new() -> Self {
        Self {
            model: None,
            auto_approve: true,
        }
    }

    /// Set the model to use
    pub fn with_model(mut self, model: String) -> Self {
        self.model = Some(model);
        self
    }

    /// Set auto-approve setting
    pub fn with_auto_approve(mut self, auto_approve: bool) -> Self {
        self.auto_approve = auto_approve;
        self
    }

    async fn spawn_inner(
        &self,
        working_dir: &Path,
        prompt: &str,
        resume_session_id: Option<&str>,
        _env: &ExecutionEnv,
    ) -> Result<SpawnedChild> {
        // Spawn the OpenCode server
        let mut command = Command::new("npx");
        command
            .kill_on_drop(true)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .current_dir(working_dir)
            .args([
                "-y",
                "opencode-ai",
                "serve",
                "--hostname",
                "127.0.0.1",
                "--port",
                "0",
            ])
            .env("NODE_NO_WARNINGS", "1")
            .env("NO_COLOR", "1");

        let mut child = command.spawn()?;
        let server_stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow::anyhow!("OpenCode server missing stdout"))?;

        // Wait for server to start and capture the URL
        let base_url = wait_for_server_url(server_stdout).await?;

        // Create message store for logs
        let msg_store = MsgStore::new();

        // Create interrupt channel (mpsc for compatibility with SpawnedChild)
        let (interrupt_tx, mut interrupt_rx) = mpsc::channel(1);
        let (exit_signal_tx, exit_signal_rx) = oneshot::channel();

        // Convert mpsc to oneshot for SDK
        let (interrupt_oneshot_tx, interrupt_oneshot_rx) = oneshot::channel();

        // Configure session
        let config = RunConfig {
            base_url,
            directory: working_dir.to_string_lossy().to_string(),
            prompt: prompt.to_string(),
            resume_session_id: resume_session_id.map(|s| s.to_string()),
            model: self.model.clone(),
        };

        // Spawn task to forward mpsc interrupt to oneshot
        tokio::spawn(async move {
            if interrupt_rx.recv().await.is_some() {
                let _ = interrupt_oneshot_tx.send(());
            }
        });

        // Spawn the session runner in background
        tokio::spawn(async move {
            let result = run_session(config, msg_store, interrupt_oneshot_rx).await;
            let _ = exit_signal_tx.send(());
            result
        });

        Ok(SpawnedChild {
            child,
            exit_signal: Some(exit_signal_rx),
            interrupt_sender: Some(interrupt_tx),
        })
    }
}

impl Default for OpenCodeExecutor {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Executor for OpenCodeExecutor {
    async fn spawn(
        &self,
        working_dir: &Path,
        prompt: &str,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild> {
        self.spawn_inner(working_dir, prompt, None, env).await
    }

    async fn spawn_follow_up(
        &self,
        working_dir: &Path,
        prompt: &str,
        session_id: &str,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild> {
        self.spawn_inner(working_dir, prompt, Some(session_id), env)
            .await
    }

    fn executor_type(&self) -> &str {
        "opencode"
    }
}

/// Wait for the OpenCode server to start and return the base URL
async fn wait_for_server_url(stdout: tokio::process::ChildStdout) -> Result<String> {
    let mut lines = tokio::io::BufReader::new(stdout).lines();
    let deadline = tokio::time::Instant::now() + Duration::from_secs(180);
    let mut captured: Vec<String> = Vec::new();

    loop {
        if tokio::time::Instant::now() > deadline {
            return Err(anyhow::anyhow!(
                "Timed out waiting for OpenCode server to print listening URL.\nServer output tail:\n{}",
                format_tail(captured)
            ));
        }

        let line = match tokio::time::timeout_at(deadline, lines.next_line()).await {
            Ok(Ok(Some(line))) => line,
            Ok(Ok(None)) => {
                return Err(anyhow::anyhow!(
                    "OpenCode server exited before printing listening URL.\nServer output tail:\n{}",
                    format_tail(captured)
                ));
            }
            Ok(Err(err)) => return Err(err.into()),
            Err(_) => continue,
        };

        if captured.len() < 64 {
            captured.push(line.clone());
        }

        // Look for the server URL in the output
        // OpenCode prints: "opencode server listening on http://127.0.0.1:xxxxx"
        if let Some(url) = line.trim().strip_prefix("opencode server listening on ") {
            // Keep draining stdout to avoid backpressure
            tokio::spawn(async move {
                let mut lines = tokio::io::BufReader::new(lines.into_inner()).lines();
                while let Ok(Some(_)) = lines.next_line().await {}
            });
            return Ok(url.trim().to_string());
        }
    }
}

/// Format the tail of captured output for error messages
fn format_tail(captured: Vec<String>) -> String {
    captured
        .into_iter()
        .rev()
        .take(12)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n")
}

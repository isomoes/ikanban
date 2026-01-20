use reqwest::Client;
use uuid::Uuid;

use crate::models::{ApiResponse, CreateProject, CreateTask, Project, Task, UpdateProject, UpdateTask};

/// HTTP API client for iKanban server
#[derive(Clone)]
pub struct ApiClient {
    client: Client,
    base_url: String,
}

impl ApiClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    /// Get the base URL for WebSocket connections
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    // Project endpoints

    pub async fn list_projects(&self) -> anyhow::Result<Vec<Project>> {
        let url = format!("{}/api/projects", self.base_url);
        let response: ApiResponse<Vec<Project>> = self.client.get(&url).send().await?.json().await?;

        if response.success {
            Ok(response.data.unwrap_or_default())
        } else {
            anyhow::bail!(response.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    pub async fn create_project(&self, payload: &CreateProject) -> anyhow::Result<Project> {
        let url = format!("{}/api/projects", self.base_url);
        let response: ApiResponse<Project> = self
            .client
            .post(&url)
            .json(payload)
            .send()
            .await?
            .json()
            .await?;

        if response.success {
            response.data.ok_or_else(|| anyhow::anyhow!("No data returned"))
        } else {
            anyhow::bail!(response.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    pub async fn update_project(&self, id: Uuid, payload: &UpdateProject) -> anyhow::Result<Project> {
        let url = format!("{}/api/projects/{}", self.base_url, id);
        let response: ApiResponse<Project> = self
            .client
            .put(&url)
            .json(payload)
            .send()
            .await?
            .json()
            .await?;

        if response.success {
            response.data.ok_or_else(|| anyhow::anyhow!("No data returned"))
        } else {
            anyhow::bail!(response.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    pub async fn delete_project(&self, id: Uuid) -> anyhow::Result<()> {
        let url = format!("{}/api/projects/{}", self.base_url, id);
        let response: ApiResponse<()> = self.client.delete(&url).send().await?.json().await?;

        if response.success {
            Ok(())
        } else {
            anyhow::bail!(response.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    // Task endpoints

    pub async fn list_tasks(&self, project_id: Uuid) -> anyhow::Result<Vec<Task>> {
        let url = format!("{}/api/tasks?project_id={}", self.base_url, project_id);
        let response: ApiResponse<Vec<Task>> = self.client.get(&url).send().await?.json().await?;

        if response.success {
            Ok(response.data.unwrap_or_default())
        } else {
            anyhow::bail!(response.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    pub async fn create_task(&self, payload: &CreateTask) -> anyhow::Result<Task> {
        let url = format!("{}/api/tasks", self.base_url);
        let response: ApiResponse<Task> = self
            .client
            .post(&url)
            .json(payload)
            .send()
            .await?
            .json()
            .await?;

        if response.success {
            response.data.ok_or_else(|| anyhow::anyhow!("No data returned"))
        } else {
            anyhow::bail!(response.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    pub async fn update_task(&self, id: Uuid, payload: &UpdateTask) -> anyhow::Result<Task> {
        let url = format!("{}/api/tasks/{}", self.base_url, id);
        let response: ApiResponse<Task> = self
            .client
            .put(&url)
            .json(payload)
            .send()
            .await?
            .json()
            .await?;

        if response.success {
            response.data.ok_or_else(|| anyhow::anyhow!("No data returned"))
        } else {
            anyhow::bail!(response.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    pub async fn delete_task(&self, id: Uuid) -> anyhow::Result<()> {
        let url = format!("{}/api/tasks/{}", self.base_url, id);
        let response: ApiResponse<()> = self.client.delete(&url).send().await?.json().await?;

        if response.success {
            Ok(())
        } else {
            anyhow::bail!(response.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    /// Get WebSocket URL for projects stream
    pub fn projects_ws_url(&self) -> String {
        let ws_base = self.base_url.replace("http://", "ws://").replace("https://", "wss://");
        format!("{}/api/projects/stream/ws", ws_base)
    }

    /// Get WebSocket URL for tasks stream
    pub fn tasks_ws_url(&self, project_id: Uuid) -> String {
        let ws_base = self.base_url.replace("http://", "ws://").replace("https://", "wss://");
        format!("{}/api/tasks/stream/ws?project_id={}", ws_base, project_id)
    }
}

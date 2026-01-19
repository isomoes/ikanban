use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
}

impl Default for TaskStatus {
    fn default() -> Self {
        Self::Todo
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTask {
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTask {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
}

#[derive(Debug, Deserialize)]
pub struct TaskQuery {
    pub project_id: Uuid,
}

impl Task {
    pub async fn find_by_project_id(
        pool: &sqlx::SqlitePool,
        project_id: Uuid,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC",
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_id(pool: &sqlx::SqlitePool, id: Uuid) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>("SELECT * FROM tasks WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

    pub async fn create(
        pool: &sqlx::SqlitePool,
        payload: &CreateTask,
    ) -> Result<Self, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let status = payload.status.unwrap_or_default();

        sqlx::query(
            "INSERT INTO tasks (id, project_id, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(payload.project_id)
        .bind(&payload.title)
        .bind(&payload.description)
        .bind(status)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        Ok(Self {
            id,
            project_id: payload.project_id,
            title: payload.title.clone(),
            description: payload.description.clone(),
            status,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn update(
        pool: &sqlx::SqlitePool,
        id: Uuid,
        payload: &UpdateTask,
    ) -> Result<Option<Self>, sqlx::Error> {
        let existing = Self::find_by_id(pool, id).await?;
        let Some(existing) = existing else {
            return Ok(None);
        };

        let title = payload.title.as_ref().unwrap_or(&existing.title);
        let description = payload.description.as_ref().or(existing.description.as_ref());
        let status = payload.status.unwrap_or(existing.status);
        let now = Utc::now();

        sqlx::query(
            "UPDATE tasks SET title = ?, description = ?, status = ?, updated_at = ? WHERE id = ?",
        )
        .bind(title)
        .bind(description)
        .bind(status)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        Ok(Some(Self {
            id,
            project_id: existing.project_id,
            title: title.clone(),
            description: description.cloned(),
            status,
            created_at: existing.created_at,
            updated_at: now,
        }))
    }

    pub async fn delete(pool: &sqlx::SqlitePool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM tasks WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn delete_by_project_id(
        pool: &sqlx::SqlitePool,
        project_id: Uuid,
    ) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM tasks WHERE project_id = ?")
            .bind(project_id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }
}

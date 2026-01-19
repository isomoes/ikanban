use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProject {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProject {
    pub name: Option<String>,
    pub description: Option<String>,
}

impl Project {
    pub async fn find_all(pool: &sqlx::SqlitePool) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>("SELECT * FROM projects ORDER BY created_at DESC")
            .fetch_all(pool)
            .await
    }

    pub async fn find_by_id(pool: &sqlx::SqlitePool, id: Uuid) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>("SELECT * FROM projects WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

    pub async fn create(
        pool: &sqlx::SqlitePool,
        payload: &CreateProject,
    ) -> Result<Self, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query(
            "INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(&payload.name)
        .bind(&payload.description)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        Ok(Self {
            id,
            name: payload.name.clone(),
            description: payload.description.clone(),
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn update(
        pool: &sqlx::SqlitePool,
        id: Uuid,
        payload: &UpdateProject,
    ) -> Result<Option<Self>, sqlx::Error> {
        let existing = Self::find_by_id(pool, id).await?;
        let Some(existing) = existing else {
            return Ok(None);
        };

        let name = payload.name.as_ref().unwrap_or(&existing.name);
        let description = payload.description.as_ref().or(existing.description.as_ref());
        let now = Utc::now();

        sqlx::query("UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?")
            .bind(name)
            .bind(description)
            .bind(now)
            .bind(id)
            .execute(pool)
            .await?;

        Ok(Some(Self {
            id,
            name: name.clone(),
            description: description.cloned(),
            created_at: existing.created_at,
            updated_at: now,
        }))
    }

    pub async fn delete(pool: &sqlx::SqlitePool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM projects WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }
}

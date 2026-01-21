use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::env;
use std::path::PathBuf;

/// Database connection pool type alias
pub type DbPool = Pool<Sqlite>;

/// Initialize the SQLite connection pool
pub async fn init_pool() -> Result<DbPool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
        // Default to a local SQLite database
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("ikanban");

        // Ensure the directory exists
        std::fs::create_dir_all(&data_dir).ok();

        format!("sqlite://{}?mode=rwc", data_dir.join("ikanban.db").display())
    });

    tracing::info!("Connecting to database: {}", database_url);

    SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
}

/// Run database migrations
pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::migrate::MigrateError> {
    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations").run(pool).await
}

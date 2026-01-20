use axum::{routing::get, Json, Router};

use crate::{entities::response::ApiResponse, AppState};

pub async fn health_check() -> Json<ApiResponse<String>> {
    Json(ApiResponse::success("OK".to_string()))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/health", get(health_check))
}

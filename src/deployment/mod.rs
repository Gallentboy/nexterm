pub mod model;
pub mod handler;
pub mod service;

use axum::{
    routing::{get, post, put, delete},
    Router,
};
pub use handler::*;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // 路径自动补全
        .route("/path-autocomplete", get(path_autocomplete))
        // 执行计划 CRUD
        .route("/plans", get(get_plans).post(create_plan))
        .route("/plans/{id}", get(get_plan).put(update_plan).delete(delete_plan))
        // 部署任务 CRUD
        .route("/tasks", get(get_tasks).post(create_task))
        .route("/tasks/{id}", get(get_task).put(update_task).delete(delete_task))
        // 执行历史
        .route("/history", get(get_all_history).post(create_history).delete(clear_all_history))
        .route("/history/{id}", get(get_history).delete(delete_history))
}

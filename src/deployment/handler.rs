use axum::{
    extract::{Query, Path, State},
    Json,
    response::IntoResponse,
    http::StatusCode,
};
use crate::deployment::model::*;
use crate::AppState;
use chrono::Utc;

/// 路径自动补全处理函数
/// 
/// <ul>
///     <li>获取请求路径的父目录和前缀</li>
///     <li>读取目录内容并过滤匹配前缀的项</li>
///     <li>返回建议列表, 目录优先排序</li>
/// </ul>
/// 
/// @author zhangyue
/// @date 2026-01-17
pub async fn path_autocomplete(
    Query(query): Query<PathAutocompleteRequest>,
) -> impl IntoResponse {
    use std::fs;
    use std::path::Path as StdPath;

    let target_path = &query.path;
    
    // 解析路径,分离目录和前缀
    let (dir_path, prefix) = if target_path.ends_with('/') {
        (target_path.to_string(), String::new())
    } else {
        match target_path.rfind('/') {
            Some(pos) => {
                let dir = &target_path[..=pos];
                let prefix = &target_path[pos + 1..];
                (dir.to_string(), prefix.to_string())
            }
            None => ("/".to_string(), target_path.to_string()),
        }
    };

    let mut suggestions = Vec::new();

    if let Ok(entries) = fs::read_dir(&dir_path) {
        for entry in entries.flatten() {
            if let Ok(file_name) = entry.file_name().into_string() {
                if file_name.starts_with(&prefix) {
                    let full_path = format!("{}{}", dir_path, file_name);
                    let metadata = entry.metadata().ok();
                    let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
                    
                    let path_with_slash = if is_dir {
                        format!("{}/", full_path)
                    } else {
                        full_path
                    };

                    suggestions.push(PathSuggestion {
                        path: path_with_slash,
                        entry_type: if is_dir { "directory".to_string() } else { "file".to_string() },
                        size: metadata.and_then(|m| if !is_dir { Some(m.len()) } else { None }),
                    });
                }
            }
        }
    }

    // 排序: 目录在前,文件在后,同类按字母排序
    suggestions.sort_by(|a, b| {
        match (a.entry_type.as_str(), b.entry_type.as_str()) {
            ("directory", "file") => std::cmp::Ordering::Less,
            ("file", "directory") => std::cmp::Ordering::Greater,
            _ => a.path.cmp(&b.path),
        }
    });

    Json(PathAutocompleteResponse {
        suggestions: suggestions.into_iter().take(20).collect(),
    })
}

// ==================== 执行计划 CRUD ====================

/// 获取所有执行计划
pub async fn get_plans(State(state): State<AppState>) -> impl IntoResponse {
    match state.deployment_service.get_all_plans().await {
        Ok(plans) => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "data": plans
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("查询失败: {}", e)
        }))).into_response(),
    }
}

/// 获取单个执行计划
pub async fn get_plan(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    match state.deployment_service.get_plan(id).await {
        Ok(Some(plan)) => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "data": plan
        }))).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "status": "error",
            "message": "执行计划不存在"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("查询失败: {}", e)
        }))).into_response(),
    }
}

/// 创建执行计划
pub async fn create_plan(
    State(state): State<AppState>,
    Json(req): Json<CreatePlanRequest>,
) -> impl IntoResponse {
    match state.deployment_service.create_plan(req).await {
        Ok(plan) => (StatusCode::CREATED, Json(serde_json::json!({
            "status": "success",
            "data": plan
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("创建失败: {}", e)
        }))).into_response(),
    }
}

/// 更新执行计划
pub async fn update_plan(
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(req): Json<UpdatePlanRequest>,
) -> impl IntoResponse {
    match state.deployment_service.update_plan(id, req).await {
        Ok(rows) if rows > 0 => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "message": "更新成功"
        }))).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "status": "error",
            "message": "执行计划不存在"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("更新失败: {}", e)
        }))).into_response(),
    }
}

/// 删除执行计划
pub async fn delete_plan(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    match state.deployment_service.delete_plan(id).await {
        Ok(rows) if rows > 0 => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "message": "删除成功"
        }))).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "status": "error",
            "message": "执行计划不存在"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("删除失败: {}", e)
        }))).into_response(),
    }
}

// ==================== 部署任务 CRUD ====================

/// 获取所有部署任务
pub async fn get_tasks(State(state): State<AppState>) -> impl IntoResponse {
    match state.deployment_service.get_all_tasks().await {
        Ok(tasks) => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "data": tasks
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("查询失败: {}", e)
        }))).into_response(),
    }
}

/// 获取单个部署任务
pub async fn get_task(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    match state.deployment_service.get_task(id).await {
        Ok(Some(task)) => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "data": task
        }))).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "status": "error",
            "message": "部署任务不存在"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("查询失败: {}", e)
        }))).into_response(),
    }
}

/// 创建部署任务
pub async fn create_task(
    State(state): State<AppState>,
    Json(req): Json<CreateTaskRequest>,
) -> impl IntoResponse {
    match state.deployment_service.create_task(req).await {
        Ok(task) => (StatusCode::CREATED, Json(serde_json::json!({
            "status": "success",
            "data": task
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("创建失败: {}", e)
        }))).into_response(),
    }
}

/// 更新部署任务
pub async fn update_task(
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(req): Json<UpdateTaskRequest>,
) -> impl IntoResponse {
    match state.deployment_service.update_task(id, req).await {
        Ok(rows) if rows > 0 => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "message": "更新成功"
        }))).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "status": "error",
            "message": "部署任务不存在"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("更新失败: {}", e)
        }))).into_response(),
    }
}

/// 删除部署任务
pub async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    match state.deployment_service.delete_task(id).await {
        Ok(rows) if rows > 0 => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "message": "删除成功"
        }))).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "status": "error",
            "message": "部署任务不存在"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("删除失败: {}", e)
        }))).into_response(),
    }
}

// ==================== 执行历史 ====================

/// 创建执行历史
pub async fn create_history(
    State(state): State<AppState>,
    Json(req): Json<CreateHistoryRequest>,
) -> impl IntoResponse {
    match state.deployment_service.create_history(req).await {
        Ok(history) => (StatusCode::CREATED, Json(serde_json::json!({
            "status": "success",
            "data": history
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("创建失败: {}", e)
        }))).into_response(),
    }
}

/// 获取所有执行历史
pub async fn get_all_history(State(state): State<AppState>) -> impl IntoResponse {
    match state.deployment_service.get_all_history().await {
        Ok(history) => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "data": history
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("查询失败: {}", e)
        }))).into_response(),
    }
}

/// 获取单个执行历史(包含日志)
pub async fn get_history(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    match state.deployment_service.get_history(id).await {
        Ok(history) => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "data": history
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("查询失败: {}", e)
        }))).into_response(),
    }
}

/// 删除执行历史
pub async fn delete_history(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    match state.deployment_service.delete_history(id).await {
        Ok(rows) if rows > 0 => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "message": "删除成功"
        }))).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "status": "error",
            "message": "执行历史不存在"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("删除失败: {}", e)
        }))).into_response(),
    }
}

/// 清空所有执行历史
pub async fn clear_all_history(State(state): State<AppState>) -> impl IntoResponse {
    match state.deployment_service.clear_all_history().await {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!({
            "status": "success",
            "message": format!("已清空 {} 条历史记录", rows)
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "status": "error",
            "message": format!("清空失败: {}", e)
        }))).into_response(),
    }
}

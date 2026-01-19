use crate::server::models::*;
use crate::server::service::ServerService;
use crate::user::middleware::CurrentUser;
use axum::{
    extract::{Path, State, Extension, Query},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use tracing::info;
use validator::Validate;

/// 创建服务器
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn create_server(
    State(app_state): State<crate::AppState>,
    Extension(current_user): Extension<CurrentUser>,
    Json(req): Json<CreateServerRequest>,
) -> impl IntoResponse {
    let server_service = &app_state.server_service;

    // 验证请求参数
    if let Err(e) = req.validate() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "status": "error",
                "message": format!("参数验证失败: {}", e)
            }))
        );
    }

    match server_service.create_server(current_user.user_id, &current_user.username, req).await {
        Ok(server) => {
            let server_resp: ServerResponse = server.into();
            info!("用户 {} 创建服务器: {}", current_user.username, server_resp.name);
            (
                StatusCode::CREATED,
                Json(json!({
                    "status": "success",
                    "message": "服务器创建成功",
                    "data": server_resp
                }))
            )
        }
        Err(e) => {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

/// 获取服务器列表
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn list_servers(
    State(app_state): State<crate::AppState>,
    Extension(current_user): Extension<CurrentUser>,
    Query(pagination): Query<PaginationParams>,
) -> impl IntoResponse {
    let server_service = &app_state.server_service;

    match server_service.list_servers(current_user.user_id, pagination).await {
        Ok(paginated) => {
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "data": paginated
                }))
            )
        }
        Err(e) => {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

/// 获取单个服务器
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn get_server(
    State(app_state): State<crate::AppState>,
    Extension(current_user): Extension<CurrentUser>,
    Path(server_id): Path<i64>,
) -> impl IntoResponse {
    let server_service = &app_state.server_service;

    match server_service.get_server_by_id(current_user.user_id, server_id).await {
        Ok(Some(server)) => {
            let server_resp: ServerResponse = server.into();
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "data": server_resp
                }))
            )
        }
        Ok(None) => {
            (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "status": "error",
                    "message": "服务器不存在"
                }))
            )
        }
        Err(e) => {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

/// 更新服务器
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn update_server(
    State(app_state): State<crate::AppState>,
    Extension(current_user): Extension<CurrentUser>,
    Path(server_id): Path<i64>,
    Json(req): Json<UpdateServerRequest>,
) -> impl IntoResponse {
    let server_service = &app_state.server_service;

    // 验证请求参数
    if let Err(e) = req.validate() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "status": "error",
                "message": format!("参数验证失败: {}", e)
            }))
        );
    }

    match server_service.update_server(current_user.user_id, &current_user.username, server_id, req).await {
        Ok(server) => {
            let server_resp: ServerResponse = server.into();
            info!("用户 {} 更新服务器: {}", current_user.username, server_resp.name);
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "message": "服务器更新成功",
                    "data": server_resp
                }))
            )
        }
        Err(e) => {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

/// 删除服务器
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn delete_server(
    State(app_state): State<crate::AppState>,
    Extension(current_user): Extension<CurrentUser>,
    Path(server_id): Path<i64>,
) -> impl IntoResponse {
    let server_service = &app_state.server_service;

    match server_service.delete_server(current_user.user_id, &current_user.username, server_id).await {
        Ok(server_name) => {
            info!("用户 {} 删除服务器: {}", current_user.username, server_name);
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "message": "服务器删除成功"
                }))
            )
        }
        Err(e) => {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

/// 批量删除服务器
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn batch_delete_servers(
    State(app_state): State<crate::AppState>,
    Extension(current_user): Extension<CurrentUser>,
    Json(req): Json<BatchDeleteRequest>,
) -> impl IntoResponse {
    let server_service = &app_state.server_service;

    // 验证请求参数
    if let Err(e) = req.validate() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "status": "error",
                "message": format!("参数验证失败: {}", e)
            }))
        );
    }

    match server_service.batch_delete_servers(current_user.user_id, &current_user.username, req.ids).await {
        Ok(_) => {
            info!("用户 {} 批量删除服务器", current_user.username);
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "message": "服务器批量删除成功"
                }))
            )
        }
        Err(e) => {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

/// 创建分组
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn create_group(
    State(app_state): State<crate::AppState>,
    Extension(current_user): Extension<CurrentUser>,
    Json(req): Json<CreateGroupRequest>,
) -> impl IntoResponse {
    let server_service = &app_state.server_service;

    if let Err(e) = req.validate() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "status": "error",
                "message": format!("参数验证失败: {}", e)
            }))
        );
    }

    match server_service.create_group(current_user.user_id, req).await {
        Ok(group) => {
            (
                StatusCode::CREATED,
                Json(json!({
                    "status": "success",
                    "message": "分组创建成功",
                    "data": group
                }))
            )
        }
        Err(e) => {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

/// 获取分组列表
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn list_groups(
    State(app_state): State<crate::AppState>,
    Query(pagination): Query<PaginationParams>,
    Extension(current_user): Extension<CurrentUser>,
) -> impl IntoResponse {
    let server_service = &app_state.server_service;

    match server_service.list_groups(current_user.user_id, pagination).await {
        Ok(paginated) => {
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "data": paginated
                }))
            )
        }
        Err(e) => {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

/// 更新分组
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn update_group(
    State(app_state): State<crate::AppState>,
    Path(group_id): Path<i64>,
    Extension(current_user): Extension<CurrentUser>,
    Json(req): Json<UpdateGroupRequest>,
) -> impl IntoResponse {
    let server_service = &app_state.server_service;

    if let Err(e) = req.validate() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "status": "error",
                "message": format!("参数验证失败: {}", e)
            }))
        );
    }

    match server_service.update_group(current_user.user_id, group_id, req).await {
        Ok(group) => {
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "message": "分组更新成功",
                    "data": group
                }))
            )
        }
        Err(e) => {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

/// 删除分组
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn delete_group(
    State(app_state): State<crate::AppState>,
    Path(group_id): Path<i64>,
    Extension(current_user): Extension<CurrentUser>,
) -> impl IntoResponse {
    let server_service = &app_state.server_service;

    match server_service.delete_group(current_user.user_id, group_id).await {
        Ok(_) => {
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "message": "分组删除成功"
                }))
            )
        }
        Err(e) => {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

/// 批量删除分组
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn batch_delete_groups(
    State(app_state): State<crate::AppState>,
    Extension(current_user): Extension<CurrentUser>,
    Json(req): Json<BatchDeleteRequest>,
) -> impl IntoResponse {
    let server_service = &app_state.server_service;

    // 验证请求参数
    if let Err(e) = req.validate() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "status": "error",
                "message": format!("参数验证失败: {}", e)
            }))
        );
    }

    match server_service.batch_delete_groups(current_user.user_id, req.ids).await {
        Ok(_) => {
            info!("用户 {} 批量删除分组", current_user.username);
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "message": "分组批量删除成功"
                }))
            )
        }
        Err(e) => {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

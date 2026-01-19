use crate::user::models::{LoginRequest, RegisterRequest, ChangePasswordRequest, UserResponse};
use crate::user::service::UserService;
use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use tower_sessions::Session;
use tracing::info;
use validator::Validate;

/// 用户注册
///
/// <ul>
///   <li>验证请求参数</li>
///   <li>调用服务层创建用户</li>
///   <li>返回用户信息</li>
/// </ul>
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn register(
    State(app_state): State<crate::AppState>,
    Json(req): Json<RegisterRequest>,
) -> impl IntoResponse {
    let user_service = &app_state.user_service;
    
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

    // 注册用户
    match user_service.register(req).await {
        Ok(user) => {
            let user_resp: UserResponse = user.into();
            info!("用户注册成功: {}", user_resp.username);
            (
                StatusCode::CREATED,
                Json(json!({
                    "status": "success",
                    "message": "注册成功",
                    "data": user_resp
                }))
            )
        }
        Err(e) => {
            info!("用户注册失败: {}", e);
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

/// 用户登录
///
/// <ul>
///   <li>验证用户名和密码</li>
///   <li>设置 session</li>
///   <li>返回用户信息</li>
/// </ul>
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn login(
    State(app_state): State<crate::AppState>,
    session: Session,
    Json(req): Json<LoginRequest>,
) -> impl IntoResponse {
    let user_service = &app_state.user_service;
    
    match user_service.login(req).await {
        Ok(user) => {
            // 设置 session 数据
            session.insert("user_id", user.id).await.ok();
            session.insert("username", user.username.clone()).await.ok();
            
            // 保存 session,确保 session ID 被创建
            if let Err(e) = session.save().await {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({
                        "status": "error",
                        "message": format!("Session 保存失败: {}", e)
                    }))
                );
            }
            
            let session_id = session.id()
                .map(|id| id.to_string())
                .unwrap_or_else(|| "unknown".to_string());
            
            let user_resp: UserResponse = user.into();
            info!("用户登录成功: {}, session ID: {}", user_resp.username, session_id);
            
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "message": "登录成功",
                    "data": user_resp,
                    "session_id": session_id
                }))
            )
        }
        Err(e) => {
            info!("用户登录失败: {}", e);
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "status": "error",
                    "message": e.to_string()
                }))
            )
        }
    }
}

/// 用户登出
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn logout(session: Session) -> impl IntoResponse {
    let username: Option<String> = session.get("username").await.ok().flatten();
    
    // 清除 session
    session.delete().await.ok();
    
    info!("用户登出: {:?}", username);
    
    Json(json!({
        "status": "success",
        "message": "登出成功"
    }))
}

/// 获取当前用户信息
///
/// <b>注意:</b> 此接口需要认证中间件保护
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn get_current_user(
    State(app_state): State<crate::AppState>,
    axum::extract::Extension(current_user): axum::extract::Extension<crate::user::middleware::CurrentUser>,
) -> impl IntoResponse {
    let user_service = &app_state.user_service;
    
    // 从中间件注入的 CurrentUser 获取 user_id
    match user_service.get_by_id(current_user.user_id).await {
        Ok(Some(user)) => {
            let user_resp: UserResponse = user.into();
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "data": user_resp
                }))
            )
        }
        Ok(None) => {
            (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "status": "error",
                    "message": "用户不存在"
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

/// 修改密码
///
/// <b>注意:</b> 此接口需要认证中间件保护
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn change_password(
    State(app_state): State<crate::AppState>,
    axum::extract::Extension(current_user): axum::extract::Extension<crate::user::middleware::CurrentUser>,
    Json(req): Json<ChangePasswordRequest>,
) -> impl IntoResponse {
    let user_service = &app_state.user_service;
    
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

    // 从中间件注入的 CurrentUser 获取 user_id
    match user_service.change_password(current_user.user_id, &req.old_password, &req.new_password).await {
        Ok(_) => {
            info!("用户 {} 修改密码成功", current_user.user_id);
            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "message": "密码修改成功"
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

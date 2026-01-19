use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use tower_sessions::Session;
use tracing::warn;

/// 认证中间件
///
/// <ul>
///   <li>检查 session 中是否存在 user_id</li>
///   <li>如果未登录,返回 401 错误</li>
///   <li>如果已登录,继续处理请求</li>
/// </ul>
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn auth_middleware(
    session: Session,
    mut request: Request,
    next: Next,
) -> Result<Response, Response> {
    // 从 session 获取 user_id 和 username
    let user_id: Option<i64> = session.get("user_id").await.ok().flatten();
    let username: Option<String> = session.get("username").await.ok().flatten();

    match (user_id, username) {
        (Some(id), Some(name)) => {
            // 将用户信息存入 request extensions,供后续处理器使用
            request.extensions_mut().insert(CurrentUser { 
                user_id: id,
                username: name,
            });
            Ok(next.run(request).await)
        }
        _ => {
            warn!("未授权访问: session ID {:?}", session.id());
            Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "status": "error",
                    "message": "未登录,请先登录"
                })),
            )
                .into_response())
        }
    }
}

/// 当前用户信息(存储在 request extensions 中)
#[derive(Clone, Debug)]
pub struct CurrentUser {
    pub user_id: i64,
    pub username: String,
}

mod deployment;
mod logger;
mod server;
mod sftp;
mod ssh;
mod user;
mod util;

use crate::server::{
    batch_delete_groups, batch_delete_servers, create_group, create_server, delete_group,
    delete_server, get_server, list_groups, list_servers, update_group, update_server,
    ServerService,
};
use crate::sftp::handler::handle_sftp_socket;
use crate::ssh::handler::handle_socket;
use crate::user::{
    auth_middleware, change_password, get_current_user, login, logout, register, UserService,
};
use crate::util::buffer_pool::BufferManager;
use crate::util::BufferPool;
use anyhow::{anyhow, Result};
use axum::body::Body;
use axum::extract::WebSocketUpgrade;
use axum::http::{header, HeaderValue, Method, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post, put};
use axum::{middleware, Router};
use deadpool::managed::{Object, Pool};
use rust_embed::RustEmbed;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
#[cfg(debug_assertions)]
use tower_http::cors::CorsLayer;
use tower_sessions::{Session, SessionManagerLayer};
use tower_sessions_sqlx_store::SqliteStore;
use tracing::{debug, info, warn};

/// 应用共享状态
#[derive(Clone)]
pub struct AppState {
    pub(crate) user_service: UserService,
    pub(crate) server_service: ServerService,
    pub(crate) deployment_service: deployment::service::DeploymentService,
    pub(crate) buffer_pool: Pool<BufferManager, Object<BufferManager>>,
}

/// 嵌入的静态资源
#[derive(RustEmbed)]
#[folder = "fronted/dist"]
struct Assets;

/// 静态文件处理器
async fn static_handler(uri: Uri) -> Response<Body> {
    let path = uri.path().trim_start_matches('/');

    // 空路径默认为 index.html
    let path = if path.is_empty() { "index.html" } else { path };

    match Assets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();

            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime.as_ref())
                .header(header::CACHE_CONTROL, "public, max-age=31536000")
                .body(Body::from(content.data))
                .unwrap()
        }
        None => {
            // 对于 SPA,未找到的路径返回 index.html
            if !path.starts_with("api/") {
                if let Some(index) = Assets::get("index.html") {
                    return Response::builder()
                        .status(StatusCode::OK)
                        .header(header::CONTENT_TYPE, "text/html")
                        .body(Body::from(index.data))
                        .unwrap();
                }
            }

            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Body::from("404 Not Found"))
                .unwrap()
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // 初始化日志系统
    logger::init();

    // 配置 SQLite 数据库文件路径
    // 优先使用环境变量 DATABASE_URL,否则使用当前目录下的 app.db
    let db_file = std::env::var("DATABASE_FILE").unwrap_or_else(|_| "app.db".to_string());

    debug!("数据库文件: {}", db_file);

    // 确保数据库文件所在目录存在
    let db_path = std::path::Path::new(&db_file);
    if let Some(parent) = db_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent)?;
            debug!("创建数据库目录: {:?}", parent);
        }
    }

    // 配置 SQLite 连接选项
    use sqlx::sqlite::SqliteConnectOptions;
    use std::str::FromStr;

    let connect_options =
        SqliteConnectOptions::from_str(&format!("sqlite://{}", db_file))?.create_if_missing(true); // 自动创建数据库文件

    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options)
        .await?;

    // 运行数据库迁移
    sqlx::migrate!("./migrations").run(&pool).await?;

    let buffer_pool = BufferPool::builder(BufferManager::new(5 * 1024 * 1024))
        .max_size(10)
        .build()?;
    // 创建共享应用状态
    let app_state = AppState {
        user_service: UserService::new(pool.clone()),
        server_service: ServerService::new(pool.clone()),
        deployment_service: deployment::service::DeploymentService::new(pool.clone()),
        buffer_pool,
    };

    // 配置 session 存储(使用 SQLite 存储以支持持久化)
    let session_store = SqliteStore::new(pool.clone());
    session_store.migrate().await?;

    let session_layer = SessionManagerLayer::new(session_store)
        .with_secure(false) // 开发环境设置为 false,生产环境应该为 true
        .with_same_site(tower_sessions::cookie::SameSite::Lax) // 允许跨站点请求携带 cookie
        .with_expiry(tower_sessions::Expiry::OnInactivity(
            time::Duration::days(30), // 30 天不活动后过期
        ));

    // 公开路由(不需要认证)
    // 公开路由
    let public_routes = Router::new()
        .route("/api/status", get(status_handler))
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login));

    // 受保护路由(需要认证)
    let protected_routes = Router::new()
        // 用户认证
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/me", get(get_current_user))
        .route("/api/auth/change-password", post(change_password))
        // 服务器管理
        .route("/api/servers", post(create_server))
        .route("/api/servers", get(list_servers))
        .route("/api/servers/{id}", get(get_server))
        .route("/api/servers/{id}", put(update_server))
        .route("/api/servers/{id}", delete(delete_server))
        .route("/api/servers/batch-delete", post(batch_delete_servers))
        // 服务器分组
        .route("/api/server-groups", post(create_group))
        .route("/api/server-groups", get(list_groups))
        .route("/api/server-groups/{id}", put(update_group))
        .route("/api/server-groups/{id}", delete(delete_group))
        .route("/api/server-groups/batch-delete", post(batch_delete_groups))
        // SSH 连接
        .route("/ssh", get(ssh_handler))
        // SFTP 连接
        .route("/sftp", get(sftp_handler))
        // 部署管理
        .nest("/api/deployment", deployment::router())
        // 应用认证中间件
        .layer(middleware::from_fn(auth_middleware));

    // 合并路由并添加静态文件 fallback
    let app = public_routes
        .merge(protected_routes)
        // 静态文件处理(必须在最后)
        .fallback(static_handler)
        // 共享状态
        .with_state(app_state)
        // Session 管理层
        .layer(session_layer);

    // 只有在 debug 模式下配置允许跨域(开发模式)
    #[cfg(debug_assertions)]
    let app = app.layer(
        CorsLayer::new()
            .allow_origin([
                "http://localhost:5173".parse::<HeaderValue>().unwrap(),
                "http://localhost:5174".parse::<HeaderValue>().unwrap(),
                "http://127.0.0.1:5173".parse::<HeaderValue>().unwrap(),
                "http://127.0.0.1:5174".parse::<HeaderValue>().unwrap(),
            ])
            // 允许携带凭证(Cookie)
            .allow_credentials(true)
            // 允许的 HTTP 方法
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::DELETE,
                Method::OPTIONS,
            ])
            // 允许的请求头
            .allow_headers([
                header::CONTENT_TYPE,
                header::AUTHORIZATION,
                header::ACCEPT,
                header::COOKIE,
            ])
            // 暴露的响应头
            .expose_headers([header::SET_COOKIE, header::CONTENT_TYPE]),
    );

    // 获取起始端口(从环境变量 PORT 获取,或默认为 3000)
    let mut port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);

    let listener = loop {
        let addr = format!("0.0.0.0:{}", port);
        match tokio::net::TcpListener::bind(&addr).await {
            Ok(listener) => {
                info!("服务器运行在 http://{}", addr);
                info!("WebSocket 端点: ws://{}/ws", addr);
                break listener;
            }
            Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
                warn!("端口 {} 已在占用,尝试端口 {}", port, port + 1);
                port += 1;
                if port > 65535 {
                    return Err(anyhow!("没有可用的端口"));
                }
            }
            Err(e) => return Err(e.into()),
        }
    };

    // 创建优雅关闭信号
    let shutdown_signal = async {
        tokio::signal::ctrl_c()
            .await
            .expect("无法安装 Ctrl+C 信号处理器");
        info!("收到关闭信号,正在优雅关闭服务器...");
    };

    // 启动服务器并监听关闭信号
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal)
        .await
        .map_err(|e| anyhow!(e))?;

    info!("服务器已关闭");
    Ok(())
}

// HTTP 路由处理器
async fn status_handler() -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "status": "ok",
        "version": "1.0.0"
    }))
}

// WebSocket 升级处理器
async fn ssh_handler(
    ws: WebSocketUpgrade,
    session: Session,
    axum::extract::State(state): axum::extract::State<AppState>,
) -> impl IntoResponse {
    info!(
        "WebSocket 连接请求 - session ID: {:?}, 用户: {:?} (ID: {:?})",
        session.id(),
        session.get::<String>("username").await.ok().flatten(),
        session.get::<i64>("user_id").await.ok().flatten()
    );

    // 升级连接,并传递用户信息和应用状态
    ws.on_upgrade(move |socket| handle_socket(socket, session, state))
}

// SFTP WebSocket 升级处理器
async fn sftp_handler(
    ws: WebSocketUpgrade,
    session: Session,
    axum::extract::State(state): axum::extract::State<AppState>,
) -> impl IntoResponse {
    debug!(
        "SFTP WebSocket 连接请求 - session ID: {:?}, 用户: {:?} (ID: {:?})",
        session.id(),
        session.get::<String>("username").await.ok().flatten(),
        session.get::<i64>("user_id").await.ok().flatten()
    );

    // 升级连接
    ws.on_upgrade(move |socket| handle_sftp_socket(socket, session, state))
}

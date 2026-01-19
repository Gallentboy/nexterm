use crate::sftp::session::SftpConnection;
use anyhow::anyhow;
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use russh::client;
use serde::{Deserialize, Serialize};

use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tower_sessions::Session;
use tracing::{debug, error, info, warn};

/// SFTP 连接参数
#[derive(Debug, Deserialize)]
pub struct SftpConnectParams {
    pub server_id: Option<i64>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub private_key: Option<String>,
}

/// 客户端命令
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SftpClientCommand {
    /// 列出目录
    ListDir { path: String },
    /// 下载文件(流式)
    DownloadFile { path: String },
    /// 上传文件开始
    UploadFileStart { path: String, total_size: u64 },
    /// 上传文件块
    UploadFileChunk { chunk_id: u64, data: Vec<u8> },
    /// 上传文件完成
    UploadFileEnd,
    /// 取消上传
    UploadFileCancel,
    /// 删除文件
    DeleteFile { path: String },
    /// 删除目录
    DeleteDir { path: String },
    /// 创建目录
    CreateDir { path: String },
    /// 重命名
    Rename { old_path: String, new_path: String },
    /// 获取文件属性
    GetAttr { path: String },
    /// 从本地路径上传
    UploadLocal {
        local_path: String,
        remote_path: String,
    },
    /// 读取文件内容
    ReadFileContent { path: String },
    /// 保存文件内容
    SaveFileContent { path: String, content: String },
}

/// 服务器消息
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SftpServerMessage {
    /// 连接成功
    Connected,
    /// 目录列表
    DirList {
        path: String,
        entries: Vec<FileEntry>,
    },
    /// 下载开始
    DownloadStart { total_size: u64 },
    /// 文件块(使用二进制消息发送)
    DownloadChunk { chunk_id: u64, size: usize },
    /// 下载完成
    DownloadEnd,
    /// 上传进度
    UploadProgress { received: u64, total: u64 },
    /// 文件属性
    FileAttr { attr: FileAttrInfo },
    /// 操作成功
    Success { message: String },
    /// 错误
    Error { message: String },
    /// 连接关闭
    Closed,
    /// 文件内容
    FileContent { path: String, content: String },
}

/// 文件条目
#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub permissions: Option<u32>,
    pub is_content_editable: bool,
}

/// 文件属性信息
#[derive(Debug, Serialize)]
pub struct FileAttrInfo {
    pub size: u64,
    pub is_dir: bool,
    pub modified: Option<u64>,
    pub permissions: Option<u32>,
}

/// 分块大小常量 (1MB)
const CHUNK_SIZE: usize = 1024 * 1024;

/// 上传状态
struct UploadState {
    path: String,
    total_size: u64,
    received: u64,
    file: Option<russh_sftp::client::fs::File>,
    last_activity: std::time::Instant,
}

impl UploadState {
    fn new(path: String, total_size: u64) -> Self {
        Self {
            path,
            total_size,
            received: 0,
            file: None,
            last_activity: std::time::Instant::now(),
        }
    }

    /// 更新最后活动时间
    fn update_activity(&mut self) {
        self.last_activity = std::time::Instant::now();
    }

    /// 检查是否超时 (5分钟无活动)
    fn is_timeout(&self) -> bool {
        self.last_activity.elapsed() > Duration::from_secs(300)
    }
}

/// 实现Drop确保文件句柄被释放
impl Drop for UploadState {
    fn drop(&mut self) {
        if self.file.is_some() {
            debug!("UploadState 被释放,文件: {}", self.path);
            let _ = self.file.take().unwrap();
        }
    }
}

/// SFTP 连接守卫,确保连接总是被关闭
struct SftpConnectionGuard {
    conn: Option<SftpConnection>,
}

impl SftpConnectionGuard {
    fn new(conn: SftpConnection) -> Self {
        Self { conn: Some(conn) }
    }

    fn get_mut(&mut self) -> &mut SftpConnection {
        self.conn.as_mut().expect("SFTP connection already closed")
    }
}

impl Drop for SftpConnectionGuard {
    fn drop(&mut self) {
        if let Some(conn) = self.conn.take() {
            tracing::info!("正在关闭 SFTP 连接...");
            // 在 Drop 中不能使用 async,所以使用 tokio::spawn
            tokio::spawn(async move {
                if let Err(e) = conn.close().await {
                    tracing::error!("关闭 SFTP 连接失败: {}", e);
                } else {
                    tracing::info!("SFTP 连接已关闭");
                }
            });
        }
    }
}

/// SFTP WebSocket 处理器
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn handle_sftp_socket(mut socket: WebSocket, session: Session, state: crate::AppState) {
    // 获取当前用户 ID
    let user_id = match session.get::<i64>("user_id").await {
        Ok(Some(id)) => id,
        _ => {
            let _ = send_sftp_error(&mut socket, "请先登录".to_string()).await;
            return;
        }
    };

    // 1. 接收连接参数
    let mut params = match socket.recv().await {
        Some(Ok(Message::Text(json))) => match serde_json::from_str::<SftpConnectParams>(&json) {
            Ok(p) => p,
            Err(e) => {
                let _ = send_sftp_error(&mut socket, format!("参数错误: {}", e)).await;
                return;
            }
        },
        _ => {
            error!("未收到 SFTP 连接参数");
            return;
        }
    };

    // 2. 如果提供了 server_id，从数据库加载详情
    if let Some(id) = params.server_id {
        match state.server_service.get_server_by_id(user_id, id).await {
            Ok(Some(server)) => {
                params.host = Some(server.host);
                params.port = Some(server.port as u16);
                params.username = Some(server.username);
                params.password = server.password;
            }
            Ok(None) => {
                let _ = send_sftp_error(&mut socket, "服务器不存在或无权访问".to_string()).await;
                return;
            }
            Err(e) => {
                let _ = send_sftp_error(&mut socket, format!("加载服务器信息失败: {}", e)).await;
                return;
            }
        }
    }

    // 验证必要参数
    let (host, port, username, password) = match (
        params.host.as_ref(),
        params.port,
        params.username.as_ref(),
        params.password.as_ref(),
    ) {
        (Some(h), Some(p), Some(u), Some(pw)) => (h, p, u, pw),
        _ => {
            let _ = send_sftp_error(&mut socket, "缺少连接所需的服务器信息".to_string()).await;
            return;
        }
    };

    debug!("SFTP 连接请求 {}@{}:{}", username, host, port);

    // 2. 配置 SSH
    let config = client::Config {
        inactivity_timeout: Some(Duration::from_secs(300)),
        keepalive_interval: Some(Duration::from_secs(30)),
        ..<_>::default()
    };

    // 3. 建立 SFTP 连接
    let sftp_conn = match SftpConnection::connect_by_password(
        username.clone(),
        password.clone(),
        format!("{}:{}", host, port),
        config,
    )
    .await
    {
        Ok(conn) => conn,
        Err(e) => {
            let _ = send_sftp_error(&mut socket, format!("连接失败: {}", e)).await;
            return;
        }
    };

    // 使用 Guard 确保连接总是被关闭
    let mut sftp_guard = SftpConnectionGuard::new(sftp_conn);

    info!("SFTP 连接成功");

    // 4. 通知客户端连接成功
    let _ = socket
        .send(Message::Text(
            serde_json::to_string(&SftpServerMessage::Connected)
                .unwrap()
                .into(),
        ))
        .await;

    // 5. 上传状态管理
    let mut upload_state: Option<UploadState> = None;

    // 6. 处理命令循环
    while let Some(msg) = socket.recv().await {
        // 检查上传超时
        if let Some(ref state) = upload_state {
            if state.is_timeout() {
                warn!(
                    "上传超时,自动清理: {} ({}/{} 字节)",
                    state.path, state.received, state.total_size
                );
                upload_state = None;
                let _ = send_sftp_error(&mut socket, "上传超时,已自动取消".to_string()).await;
            }
        }

        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(cmd) = serde_json::from_str::<SftpClientCommand>(&text) {
                    if let Err(e) = handle_sftp_command(
                        sftp_guard.get_mut(),
                        &mut socket,
                        cmd,
                        &mut upload_state,
                    )
                    .await
                    {
                        error!("处理 SFTP 命令失败: {}", e);
                        let _ = send_sftp_error(&mut socket, e.to_string()).await;
                        // 清理上传状态(Drop trait会自动释放资源)
                        upload_state = None;
                    }
                } else {
                    warn!("无法解析 SFTP 命令: {}", text);
                }
            }
            Ok(Message::Close(reason)) => {
                if let Some(frame) = reason {
                    debug!("客户端关闭 SFTP: {}[{}]", frame.code, frame.reason);
                } else {
                    debug!("客户端关闭 SFTP");
                }
                break;
            }
            Err(e) => {
                error!("WebSocket 错误: {}", e);
                break;
            }
            _ => {}
        }
    }

    // 7. 清理上传状态(Drop trait会自动释放资源)
    drop(upload_state);

    // 8. 发送关闭消息
    let _ = socket
        .send(Message::Text(
            serde_json::to_string(&SftpServerMessage::Closed)
                .unwrap()
                .into(),
        ))
        .await;

    // sftp_guard 会在这里自动 Drop,触发连接关闭
    info!("SFTP 会话结束");
}

/// 处理 SFTP 命令
async fn handle_sftp_command(
    sftp_conn: &mut SftpConnection,
    socket: &mut WebSocket,
    cmd: SftpClientCommand,
    upload_state: &mut Option<UploadState>,
) -> anyhow::Result<()> {
    match cmd {
        SftpClientCommand::ListDir { path } => {
            debug!("列出目录: {}", path);
            let mut dir = sftp_conn.sftp.read_dir(&path).await?;
            let mut entries = Vec::new();

            while let Some(entry) = dir.next() {
                let attr = entry.metadata();
                let name = entry.file_name();
                let size = attr.size.unwrap_or(0);
                entries.push(FileEntry {
                    is_content_editable: is_content_editable(&name, size),
                    name,
                    is_dir: attr.is_dir(),
                    size,
                    modified: attr.mtime.map(|t| t as u64),
                    permissions: attr.permissions,
                });
            }

            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::DirList {
                        path: path.clone(),
                        entries,
                    })?
                    .into(),
                ))
                .await?;
        }

        SftpClientCommand::DownloadFile { path } => {
            debug!("下载文件: {}", path);

            // 获取文件大小
            let attr = sftp_conn.sftp.metadata(&path).await?;
            let total_size = attr.size.unwrap_or(0);

            // 发送下载开始消息
            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::DownloadStart { total_size })?.into(),
                ))
                .await?;

            // 打开文件
            let mut file = sftp_conn.sftp.open(&path).await?;

            // 分块读取并发送
            let mut chunk_id = 0u64;
            let mut buffer = vec![0u8; CHUNK_SIZE];

            loop {
                let n = file.read(&mut buffer).await?;
                if n == 0 {
                    break;
                }

                // 发送块信息
                socket
                    .send(Message::Text(
                        serde_json::to_string(&SftpServerMessage::DownloadChunk {
                            chunk_id,
                            size: n,
                        })?
                        .into(),
                    ))
                    .await?;

                // 发送块数据(二进制)
                socket
                    .send(Message::Binary(buffer[..n].to_vec().into()))
                    .await?;

                chunk_id += 1;
            }

            // 发送下载完成消息
            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::DownloadEnd)?.into(),
                ))
                .await?;

            debug!("文件下载完成: {} ({} 块)", path, chunk_id);

            // 显式释放资源
            drop(buffer);
            drop(file);
        }

        SftpClientCommand::UploadFileStart { path, total_size } => {
            // 检查是否已有活动的上传会话
            if upload_state.is_some() {
                return Err(anyhow!("已有活动的上传会话,请先完成或取消当前上传"));
            }

            debug!("开始上传文件: {} ({} 字节)", path, total_size);

            let final_path = path.clone();

            // 检查远程路径是否为目录
            if let Ok(metadata) = sftp_conn.sftp.metadata(&path).await {
                if metadata.is_dir() {
                    // 如果是目录,则在此线下创建文件
                    // 这种情况下由于只提供了远程路径,我们需要从路径中提取文件名(如果可能)
                    // 或者告知错误。但在 UploadFileStart 模式下,通常前端会提供完整路径。
                    // 为了保险起见,如果 path 确实是目录,且没指定文件名,create 会失败。
                }
            }

            // 确保父目录存在
            if let Some(parent) = std::path::Path::new(&final_path).parent() {
                if let Some(parent_str) = parent.to_str() {
                    if !parent_str.is_empty() && parent_str != "/" {
                        let _ = create_dir_recursive(sftp_conn, parent_str).await;
                    }
                }
            }

            // 创建文件
            let file = sftp_conn.sftp.create(&final_path).await?;

            // 初始化上传状态
            let mut state = UploadState::new(path.clone(), total_size);
            state.file = Some(file);
            *upload_state = Some(state);

            // 发送确认
            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::Success {
                        message: "准备接收文件".to_string(),
                    })?
                    .into(),
                ))
                .await?;
        }

        SftpClientCommand::UploadFileChunk { chunk_id, data } => {
            let state = upload_state
                .as_mut()
                .ok_or_else(|| anyhow!("没有活动的上传会话"))?;

            let file = state.file.as_mut().ok_or_else(|| anyhow!("文件未打开"))?;

            // 写入数据
            file.write_all(&data).await?;
            state.received += data.len() as u64;

            // 更新活动时间
            state.update_activity();

            debug!(
                "接收文件块 #{}: {} 字节 ({}/{})",
                chunk_id,
                data.len(),
                state.received,
                state.total_size
            );

            // 发送进度
            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::UploadProgress {
                        received: state.received,
                        total: state.total_size,
                    })?
                    .into(),
                ))
                .await?;
        }

        SftpClientCommand::UploadFileEnd => {
            let mut state = upload_state
                .take()
                .ok_or_else(|| anyhow!("没有活动的上传会话"))?;

            if let Some(ref mut file) = state.file {
                file.sync_all().await?;
            }

            debug!("文件上传完成: {} ({} 字节)", state.path, state.received);

            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::Success {
                        message: "文件上传成功".to_string(),
                    })?
                    .into(),
                ))
                .await?;

            // state在这里自动drop,触发Drop trait释放资源
        }

        SftpClientCommand::UploadFileCancel => {
            if let Some(state) = upload_state.take() {
                debug!(
                    "取消上传: {} ({}/{} 字节)",
                    state.path, state.received, state.total_size
                );
                // state会自动drop,释放文件句柄
            }

            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::Success {
                        message: "上传已取消".to_string(),
                    })?
                    .into(),
                ))
                .await?;
        }

        SftpClientCommand::DeleteFile { path } => {
            debug!("删除文件: {}", path);
            sftp_conn.sftp.remove_file(&path).await?;

            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::Success {
                        message: "文件删除成功".to_string(),
                    })?
                    .into(),
                ))
                .await?;
        }

        SftpClientCommand::DeleteDir { path } => {
            debug!("删除目录: {}", path);
            sftp_conn.sftp.remove_dir(&path).await?;

            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::Success {
                        message: "目录删除成功".to_string(),
                    })?
                    .into(),
                ))
                .await?;
        }

        SftpClientCommand::CreateDir { path } => {
            debug!("创建目录: {}", path);
            sftp_conn.sftp.create_dir(&path).await?;

            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::Success {
                        message: "目录创建成功".to_string(),
                    })?
                    .into(),
                ))
                .await?;
        }

        SftpClientCommand::Rename { old_path, new_path } => {
            debug!("重命名: {} -> {}", old_path, new_path);
            sftp_conn.sftp.rename(&old_path, &new_path).await?;

            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::Success {
                        message: "重命名成功".to_string(),
                    })?
                    .into(),
                ))
                .await?;
        }

        SftpClientCommand::GetAttr { path } => {
            debug!("获取文件属性: {}", path);
            let attr = sftp_conn.sftp.metadata(&path).await?;

            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::FileAttr {
                        attr: FileAttrInfo {
                            size: attr.size.unwrap_or(0),
                            is_dir: attr.is_dir(),
                            modified: attr.mtime.map(|t| t as u64),
                            permissions: attr.permissions,
                        },
                    })?
                    .into(),
                ))
                .await?;
        }

        SftpClientCommand::UploadLocal {
            local_path,
            remote_path,
        } => {
            info!("从本地上传文件: {} -> {}", local_path, remote_path);

            // 检查本地文件
            let metadata = tokio::fs::metadata(&local_path)
                .await
                .map_err(|e| anyhow!("无法访问本地路径: {}", e))?;

            if metadata.is_dir() {
                return Err(anyhow!("目前不支持目录上传,请指定具体文件"));
            }

            let mut final_remote_path = remote_path.clone();

            // 检查远程路径是否为目录
            if let Ok(remote_metadata) = sftp_conn.sftp.metadata(&remote_path).await {
                if remote_metadata.is_dir() {
                    // 如果远程路径是目录,则将本地文件名拼接到该目录下
                    let local_file_name = std::path::Path::new(&local_path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .ok_or_else(|| anyhow!("无法获取本地文件名"))?;

                    final_remote_path =
                        format!("{}/{}", remote_path.trim_end_matches('/'), local_file_name);
                    debug!("目标路径是目录, 调整为: {}", final_remote_path);
                }
            }

            let mut local_file = tokio::fs::File::open(&local_path)
                .await
                .map_err(|e| anyhow!("打开本地文件失败: {}", e))?;

            let total_size = metadata.len();

            // 确保远程父目录存在 (针对 final_remote_path)
            if let Some(parent) = std::path::Path::new(&final_remote_path).parent() {
                if let Some(parent_str) = parent.to_str() {
                    if !parent_str.is_empty() && parent_str != "/" {
                        let _ = create_dir_recursive(sftp_conn, parent_str).await;
                    }
                }
            }

            // 创建远程文件
            let mut remote_file = sftp_conn
                .sftp
                .create(&final_remote_path)
                .await
                .map_err(|e| anyhow!("创建远程文件失败: {} (目标: {})", e, final_remote_path))?;

            // 流式传输
            let mut buffer = vec![0u8; CHUNK_SIZE];
            let mut received = 0u64;

            loop {
                let n = local_file
                    .read(&mut buffer)
                    .await
                    .map_err(|e| anyhow!("读取本地文件失败: {}", e))?;
                if n == 0 {
                    break;
                }

                remote_file
                    .write_all(&buffer[..n])
                    .await
                    .map_err(|e| anyhow!("写入远程文件失败: {}", e))?;

                received += n as u64;

                // 每传 1MB 发送一次进度 (或者至少 1MB)
                let _ = socket
                    .send(Message::Text(
                        serde_json::to_string(&SftpServerMessage::UploadProgress {
                            received,
                            total: total_size,
                        })?
                        .into(),
                    ))
                    .await;
            }

            remote_file.sync_all().await?;
            info!(
                "本地上传完成: {} -> {} ({} bytes)",
                local_path, remote_path, received
            );

            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::Success {
                        message: "文件上传成功".to_string(),
                    })?
                    .into(),
                ))
                .await?;

            // 显式释放资源
            drop(buffer);
            drop(local_file);
            drop(remote_file);
        }
        SftpClientCommand::ReadFileContent { path } => {
            debug!("读取文件内容: {}", path);

            // 检查文件大小
            let metadata = sftp_conn.sftp.metadata(&path).await?;
            let size = metadata.size.unwrap_or(0);
            if size > 2 * 1024 * 1024 {
                return Err(anyhow!("文件过大 ({} bytes), 超过 2MB 限制", size));
            }

            let mut file = sftp_conn.sftp.open(&path).await?;
            let mut content = String::new();
            file.read_to_string(&mut content).await?;

            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::FileContent { path, content })?
                        .into(),
                ))
                .await?;
        }

        SftpClientCommand::SaveFileContent { path, content } => {
            debug!("保存文件内容: {}", path);
            let mut file = sftp_conn.sftp.create(&path).await?;
            file.write_all(content.as_bytes()).await?;
            file.sync_all().await?;

            socket
                .send(Message::Text(
                    serde_json::to_string(&SftpServerMessage::Success {
                        message: "文件保存成功".to_string(),
                    })?
                    .into(),
                ))
                .await?;
        }
    }

    Ok(())
}

/// 发送错误消息
#[inline(always)]
pub(crate) async fn send_sftp_error(socket: &mut WebSocket, message: String) -> anyhow::Result<()> {
    error!("SFTP 错误: {}", message);
    socket
        .send(Message::Text(
            serde_json::to_string(&SftpServerMessage::Error { message })?.into(),
        ))
        .await
        .map_err(|e| anyhow!(e))
}

/// 递归创建目录
async fn create_dir_recursive(sftp_conn: &mut SftpConnection, path: &str) -> anyhow::Result<()> {
    let mut current = String::new();
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();

    if path.starts_with('/') {
        current.push('/');
    }

    for part in parts {
        current.push_str(part);
        // 尝试创建,如果已存在会报失败,我们忽略失败
        let _ = sftp_conn.sftp.create_dir(&current).await;
        current.push('/');
    }

    Ok(())
}

/// 判断文件是否可编辑 (文本类型, 且大小不超过 2MB)
fn is_content_editable(name: &str, size: u64) -> bool {
    // 限制 2MB
    if size > 2 * 1024 * 1024 {
        return false;
    }

    let text_extensions = [
        "txt",
        "md",
        "json",
        "js",
        "ts",
        "jsx",
        "tsx",
        "html",
        "css",
        "scss",
        "py",
        "sh",
        "yml",
        "yaml",
        "xml",
        "rs",
        "go",
        "java",
        "c",
        "cpp",
        "sql",
        "env",
        "conf",
        "ini",
        "log",
        "list",
        "local",
        "dockerfile",
        "makefile",
        "gitignore",
        "prettierrc",
        "eslintrc",
        "babelrc",
        "toml",
        "php",
        "rb",
        "lua",
        "swift",
        "kt",
        "kts",
        "dart",
        "scala",
        "pl",
        "r",
        "cs",
        "m",
        "mm",
        "hs",
        "clj",
        "ex",
        "exs",
        "erl",
        "fs",
    ];

    let name_lower = name.to_lowercase();

    // 检查完整文件名 (无后缀的文件)
    if ["dockerfile", "makefile", "procfile", "caddyfile"].contains(&name_lower.as_str()) {
        return true;
    }

    // 检查后缀
    if let Some(ext) = std::path::Path::new(&name_lower)
        .extension()
        .and_then(|e| e.to_str())
    {
        return text_extensions.contains(&ext);
    }

    false
}

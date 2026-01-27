use crate::debug;
use crate::ssh::{ClientCommand, ServerMessage, SshConnectParams, SshMode};
use anyhow::anyhow;
use axum::body::Bytes;
use axum::extract::ws::{Message, WebSocket};
use std::io::Read;

use futures_util::{SinkExt, StreamExt};
use russh::client::Msg;
use russh::{client, Channel, ChannelMsg, Disconnect};

use std::time::Duration;
use tokio::time::timeout;
use tower_sessions::Session;
use tracing::{error, info, warn};

type SshSession = crate::ssh::session::Session;

/// SSH 会话守卫,确保连接总是被关闭
struct SshSessionGuard {
    handle: Option<client::Handle<crate::ssh::session::Client>>,
}

impl SshSessionGuard {
    fn new(handle: client::Handle<crate::ssh::session::Client>) -> Self {
        Self {
            handle: Some(handle),
        }
    }

    fn get(&self) -> &client::Handle<crate::ssh::session::Client> {
        self.handle.as_ref().expect("SSH session already closed")
    }
}

impl Drop for SshSessionGuard {
    fn drop(&mut self) {
        if let Some(handle) = self.handle.take() {
            debug!("正在关闭 SSH 连接...");
            tokio::spawn(async move {
                if let Err(e) = handle.disconnect(Disconnect::ByApplication, "", "").await {
                    error!("关闭 SSH 连接失败: {}", e);
                } else {
                    debug!("SSH 连接已关闭");
                }
            });
        }
    }
}

//noinspection ALL
/// WebSocket 连接处理
///
/// <ul>
///   <li>接收客户端消息</li>
///   <li>处理文本和二进制消息</li>
///   <li>支持用户认证信息</li>
/// </ul>
///
/// @author zhangyue
/// @date 2026-01-16
pub async fn handle_socket(mut socket: WebSocket, session: Session, state: crate::AppState) {
    // 获取当前用户 ID
    let user_id = match session.get::<i64>("user_id").await {
        Ok(Some(id)) => id,
        _ => {
            let _ = send_error(&mut socket, "请先登录".to_string()).await;
            return;
        }
    };

    // 1. 接收连接参数
    let mut params = match socket.recv().await {
        Some(Ok(Message::Text(json))) => match serde_json::from_str::<SshConnectParams>(&json) {
            Ok(p) => p,
            Err(e) => {
                let _ = send_error(&mut socket, format!("参数格式错误: {}", e)).await;
                return;
            }
        },
        _ => {
            error!("未收到连接参数");
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
                let _ = send_error(&mut socket, "服务器不存在或无权访问".to_string()).await;
                return;
            }
            Err(e) => {
                let _ = send_error(&mut socket, format!("加载服务器信息失败: {}", e)).await;
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
            let _ = send_error(&mut socket, "缺少连接所需的服务器信息".to_string()).await;
            return;
        }
    };

    debug!("连接 {}@{}:{}", username, host, port);
    let config = client::Config {
        inactivity_timeout: Some(Duration::from_secs(120)),
        keepalive_interval: Some(Duration::from_secs(30)),
        ..<_>::default()
    };

    let ssh_session = match SshSession::connect_by_password(
        username,
        password,
        format!("{}:{}", host, port),
        config,
    )
    .await
    {
        Ok(s) => s,
        Err(e) => {
            let _ = send_error(&mut socket, format!("连接失败: {}", e)).await;
            return;
        }
    };

    // 使用 Guard 确保连接总是被关闭
    let session_guard = SshSessionGuard::new(ssh_session.session);
    let session_handle = session_guard.get();

    let mut channel = match session_handle.channel_open_session().await {
        Ok(c) => c,
        Err(e) => {
            let _ = send_error(&mut socket, format!("打开通道失败: {}", e)).await;
            return; // Guard 会自动清理
        }
    };

    match params.mode {
        SshMode::Exec => {
            handle_exec_mode(socket, channel, &params).await;
            return;
        }
        _ => {}
    }
    // 5. 请求 PTY 和 Shell
    match channel
        .request_pty(true, &params.term, params.cols, params.rows, 0, 0, &[])
        .await
    {
        Ok(_) => {}
        Err(e) => {
            let _ = send_error(&mut socket, format!("请求pty失败: {}", e)).await;
            return;
        }
    }

    // 设置环境变量 (支持中文的关键)
    if let Some(env) = &params.env {
        for (key, value) in env {
            let _ = channel.set_env(true, key, value).await;
        }
    }
    
    // 禁用 shell 超时以避免会话被自动断开
    // 在请求 shell 之前通过 SSH 协议设置环境变量，避免审计日志痕迹
    if let Err(e) = channel.set_env(true, "TMOUT", "0").await {
        debug!("通过 SSH 协议设置 TMOUT 失败(不影响使用): {}", e);
    }

    match channel.request_shell(true).await {
        Ok(_) => {}
        Err(e) => {
            let _ = send_error(&mut socket, format!("请求shell失败: {}", e)).await;
            return;
        }
    }
    
    // 设置 TMOUT=0 并标记为 readonly，防止被任何脚本覆盖
    // 使用 set +o history 临时禁用 history，设置完成后恢复
    // readonly 属性确保后续脚本无法修改 TMOUT 的值
    let setup_cmd = b"set +o history 2>/dev/null; readonly TMOUT=0 2>/dev/null || TMOUT=0 2>/dev/null; set -o history 2>/dev/null\n";
    if let Err(e) = channel.data(&setup_cmd[..]).await {
        debug!("设置 readonly TMOUT 失败(不影响使用): {}", e);
    }
    
    debug!("SSH 连接成功");

    // 6. 通知客户端
    let _ = socket
        .send(Message::Text(
            serde_json::to_string(&ServerMessage::Connected)
                .unwrap()
                .into(),
        ))
        .await;

    // 7. 双向数据转发
    let (mut ws_tx, mut ws_rx) = socket.split();
    
    loop {
        tokio::select! {
            // 从 WebSocket 接收
            ws_msg = ws_rx.next() => {
                match ws_msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(cmd) = serde_json::from_str::<ClientCommand>(&text) {
                            match cmd {
                                ClientCommand::Resize { cols, rows } => {
                                    let _ = channel.window_change(cols, rows, 0, 0).await;
                                }
                                ClientCommand::Input { data } => {
                                    if channel.data(data.as_bytes()).await.is_err() {
                                        break;
                                    }
                                }
                            }
                        } else {
                            if channel.data(text.as_bytes()).await.is_err() {
                                break;
                            }
                        }
                    }
                    Some(Ok(Message::Binary(data))) => {
                        if channel.data(data.as_ref()).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(reason))) => {
                        if reason.is_some() {
                            let  frame = reason.unwrap();
                            debug!("客户端关闭: {}[{}]", frame.code, frame.reason.to_string());
                        } else {
                            debug!("客户端关闭: 未知原因");
                        }

                        break;
                    }
                    Some(Err(_)) | None => break,
                    _ => {}
                }
            }
            // 从 SSH 接收（带超时避免阻塞）
            ssh_msg = timeout(Duration::from_millis(50), channel.wait()) => {
                match ssh_msg {
                    Ok(Some(ChannelMsg::Data { ref data })) => {
                        match ws_tx.send(Message::Binary(Bytes::copy_from_slice(data))).await {
                            Ok(_) => {}
                            Err(error) => {
                                error!("无法向客户端发送消息: {}", error);
                                break;
                            }
                        }
                    }
                    Ok(Some(ChannelMsg::ExtendedData { ref data, .. })) => {
                        match ws_tx.send(Message::Binary(Bytes::copy_from_slice(data))).await {
                            Ok(_) => {}
                            Err(error) => {
                                error!("无法向客户端发送消息: {}", error);
                                break;
                            }
                        }
                    }
                    Ok(Some(ChannelMsg::Eof)) | Ok(Some(ChannelMsg::ExitStatus { .. })) | Ok(None) => {
                        let _ = ws_tx.send(Message::Text(
                            serde_json::to_string(&ServerMessage::Closed).unwrap().into()
                        )).await;
                        break;
                    }
                    Err(_) => {
                        // 超时，继续循环处理 WebSocket
                    }
                    _ => {}
                }
            }
        }
    }

    info!("SSH 会话结束");
}

#[inline(always)]
fn build_exec_command(params: &SshConnectParams) -> String {
    // 1. 选择 shell
    let shell = params.shell.as_deref().unwrap_or("bash");

    // 2. 构建命令内容
    let mut script_parts = Vec::new();

    // 设置工作目录
    if let Some(workdir) = &params.workdir {
        script_parts.push(format!("cd {}", workdir));
    }

    // 设置环境变量
    if let Some(env) = &params.env {
        for (key, value) in env {
            script_parts.push(format!("export {}={}", key, value));
        }
    }

    // 添加实际命令
    if let Some(command) = &params.command {
        script_parts.push(command.clone());
    }

    // 3. 组合成完整命令
    let script = script_parts.join(" && ");
    format!("{} -c '{}'", shell, script)
}

#[inline(always)]
async fn handle_exec_mode(
    mut socket: WebSocket,
    mut channel: Channel<Msg>,
    params: &SshConnectParams,
) {
    // 1. 获取要执行的命令
    let _ = match &params.command {
        Some(cmd) => cmd,
        None => {
            let _ = send_error(&mut socket, "缺少命令参数".to_string()).await;
            return;
        }
    };
    let cmd = build_exec_command(params);
    debug!("执行命令: {} (超时: {}秒)", cmd, params.timeout_secs);

    // 2. 执行命令
    if let Err(e) = channel.exec(true, cmd.as_bytes()).await {
        let _ = send_error(&mut socket, format!("执行命令失败: {}", e)).await;
        return;
    }

    // 3. 读取输出（带超时）
    let mut output = String::new();
    let mut code = None;
    let timeout_duration = Duration::from_secs(params.timeout_secs);
    let start_time = std::time::Instant::now();

    loop {
        // 检查是否超时
        if start_time.elapsed() >= timeout_duration {
            warn!("命令执行超时 ({}秒)", params.timeout_secs);
            let timeout_msg = format!("\n[命令执行超时: {}秒]\n", params.timeout_secs);
            let _ = socket.send(Message::Text(timeout_msg.into())).await;
            code = Some(124); // 超时退出码
            break;
        }

        // 使用较短的超时来检查消息，以便能及时检测总超时
        match timeout(Duration::from_millis(100), channel.wait()).await {
            Ok(Some(ChannelMsg::Data { ref data })) => {
                // 标准输出
                let text = String::from_utf8_lossy(data);
                output.push_str(&text);

                // 实时发送给客户端
                let _ = socket.send(Message::Text(text.to_string().into())).await;
            }
            Ok(Some(ChannelMsg::ExtendedData { ref data, ext })) => {
                // 标准错误输出
                if ext == 1 {
                    let text = String::from_utf8_lossy(data);
                    output.push_str(&text);
                    let _ = socket.send(Message::Text(text.to_string().into())).await;
                }
            }
            Ok(Some(ChannelMsg::ExitStatus { exit_status })) => {
                // 命令退出状态
                code = Some(exit_status);
                debug!("命令退出,状态码: {}", exit_status);
            }
            Ok(Some(ChannelMsg::Eof)) => {
                // 命令执行完成
                break;
            }
            Ok(None) => break,
            Err(_) => {
                // 100ms 超时，继续下一次循环检查总超时
                continue;
            }
            _ => {}
        }
    }

    // 4. 发送完成消息
    let result = serde_json::json!({
        "type": "exec_complete",
        "exit_code": code.unwrap_or(0),
        "output": output,
        "timeout": start_time.elapsed() >= timeout_duration
    });
    let _ = socket.send(Message::Text(result.to_string().into())).await;
    let _ = socket.close().await;
}

#[inline(always)]
pub(crate) async fn send_error(socket: &mut WebSocket, message: String) -> anyhow::Result<()> {
    error!("WebSocket 错误: {}", message);
    socket
        .send(Message::Text(
            serde_json::to_string(&ServerMessage::Error { message })?.into(),
        ))
        .await
        .map_err(|e| anyhow!(e))
}

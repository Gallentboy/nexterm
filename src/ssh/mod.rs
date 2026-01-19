use std::collections::HashMap;
use serde::{Deserialize, Serialize};

pub mod handler;
pub mod session;

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum SshMode {
    #[default]
    Shell, // 交互式 shell
    Exec, // 单命令执行
}

#[derive(Deserialize)]
pub(crate) struct SshConnectParams {
    pub(crate) server_id: Option<i64>, // 通过 ID 连接
    pub(crate) host: Option<String>,
    pub(crate) port: Option<u16>,
    pub(crate) username: Option<String>,
    pub(crate) password: Option<String>,
    // 新增字段
    #[serde(default)]
    pub mode: SshMode, // "shell" 或 "exec"
    #[serde(default = "default_term")]
    pub term: String,
    #[serde(default = "default_cols")]
    pub cols: u32,
    #[serde(default = "default_rows")]
    pub rows: u32,

    // Exec 模式参数
    #[serde(default)]
    pub command: Option<String>, // 要执行的命令

    #[serde(default)]
    pub workdir: Option<String>, // 工作目录

    #[serde(default)]
    pub env: Option<HashMap<String, String>>, // 环境变量

    #[serde(default)]
    pub shell: Option<String>, // 使用的 shell (bash/sh/zsh)
    
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64, // 执行超时时间（秒），默认 60 秒
}

fn default_term() -> String {
    "xterm-256color".to_owned()
}
fn default_cols() -> u32 {
    80
}
fn default_rows() -> u32 {
    24
}
fn default_timeout() -> u64 {
    60 // 默认 60 秒超时
}

#[derive(Serialize)]
#[serde(tag = "type")]
enum ServerMessage {
    Connected,
    Data { data: String },
    Error { message: String },
    Closed,
}
#[derive(Deserialize)]
#[serde(tag = "type")]
enum ClientCommand {
    Input { data: String },
    Resize { cols: u32, rows: u32 },
}

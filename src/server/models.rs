use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use validator::Validate;

/// 认证类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AuthType {
    Password,
    Key,
}

impl ToString for AuthType {
    fn to_string(&self) -> String {
        match self {
            AuthType::Password => "password".to_string(),
            AuthType::Key => "key".to_string(),
        }
    }
}

impl From<String> for AuthType {
    fn from(s: String) -> Self {
        match s.as_str() {
            "key" => AuthType::Key,
            _ => AuthType::Password,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct PaginationParams {
    #[validate(range(min = 1))]
    pub page: Option<u32>,
    #[validate(range(min = 1, max = 100))]
    pub page_size: Option<u32>,
    pub group_id: Option<i64>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RemoteServer {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub host: String,
    pub port: i64,
    pub username: String,
    pub auth_type: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub description: Option<String>,
    pub tags: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_connected_at: Option<String>,
    pub is_active: i64,
    pub created_by_username: Option<String>,
    pub updated_by_username: Option<String>,
    pub group_id: Option<i64>,
    pub group_name: Option<String>,
}

/// 服务器响应(不包含敏感信息)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerResponse {
    pub id: i64,
    pub name: String,
    pub host: String,
    pub port: i64,
    pub username: String,
    pub auth_type: String,
    pub description: Option<String>,
    pub group_id: Option<i64>,
    pub group_name: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_connected_at: Option<String>,
    pub created_by_username: Option<String>,
    pub updated_by_username: Option<String>,
    pub password: Option<String>,
    pub private_key: Option<String>,
}

impl From<RemoteServer> for ServerResponse {
    fn from(server: RemoteServer) -> Self {
        let tags = server.tags
            .and_then(|t| serde_json::from_str::<Vec<String>>(&t).ok())
            .unwrap_or_default();
        
        Self {
            id: server.id,
            name: server.name,
            host: server.host,
            port: server.port,
            username: server.username,
            auth_type: server.auth_type,
            description: server.description,
            group_id: server.group_id,
            group_name: server.group_name,
            tags,
            created_at: server.created_at,
            updated_at: server.updated_at,
            last_connected_at: server.last_connected_at,
            created_by_username: server.created_by_username,
            updated_by_username: server.updated_by_username,
            password: server.password,
            private_key: server.private_key,
        }
    }
}

/// 创建服务器请求
#[derive(Debug, Deserialize, Validate)]
pub struct CreateServerRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[validate(length(min = 1))]
    pub host: String,
    #[validate(range(min = 1, max = 65535))]
    pub port: Option<i64>,
    #[validate(length(min = 1))]
    pub username: String,
    pub auth_type: Option<AuthType>,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub group_id: Option<i64>,
}

/// 更新服务器请求
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateServerRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub host: Option<String>,
    #[validate(range(min = 1, max = 65535))]
    pub port: Option<i64>,
    pub username: Option<String>,
    pub auth_type: Option<AuthType>,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub group_id: Option<i64>,
}

/// 批量删除服务器请求
#[derive(Debug, Deserialize, Validate)]
pub struct BatchDeleteRequest {
    #[validate(length(min = 1))]
    pub ids: Vec<i64>,
}

/// 服务器分组模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ServerGroup {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub server_count: i64,
}

/// 创建分组请求
#[derive(Debug, Deserialize, Validate)]
pub struct CreateGroupRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub description: Option<String>,
}

/// 更新分组请求
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateGroupRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub description: Option<String>,
}

/// 操作类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OperationType {
    Create,
    Update,
    Delete,
    Connect,
    Disconnect,
}

impl ToString for OperationType {
    fn to_string(&self) -> String {
        match self {
            OperationType::Create => "create".to_string(),
            OperationType::Update => "update".to_string(),
            OperationType::Delete => "delete".to_string(),
            OperationType::Connect => "connect".to_string(),
            OperationType::Disconnect => "disconnect".to_string(),
        }
    }
}

/// 服务器操作日志
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ServerOperationLog {
    pub id: i64,
    pub user_id: i64,
    pub username: String,
    pub server_id: Option<i64>,
    pub server_name: Option<String>,
    pub operation_type: String,
    pub operation_detail: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: String,
}

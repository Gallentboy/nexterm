use serde::{Deserialize, Serialize};

/// 路径自动补全请求
#[derive(Debug, Deserialize)]
pub struct PathAutocompleteRequest {
    pub path: String,
}

/// 路径建议
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathSuggestion {
    pub path: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

/// 路径自动补全响应
#[derive(Debug, Serialize)]
pub struct PathAutocompleteResponse {
    pub suggestions: Vec<PathSuggestion>,
}

/// 执行计划
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionPlan {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub steps: String, // JSON 字符串
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

/// 创建执行计划请求
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlanRequest {
    pub name: String,
    pub description: Option<String>,
    pub steps: serde_json::Value,
    pub version: Option<String>,
}

/// 更新执行计划请求
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePlanRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub steps: Option<serde_json::Value>,
    pub version: Option<String>,
}

/// 部署任务
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentTask {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub plan_id: i64,
    pub plan_name: String,
    pub server_groups: String, // JSON 字符串
    pub strategy: String,
    pub status: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

/// 创建部署任务请求
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskRequest {
    pub name: String,
    pub description: Option<String>,
    pub plan_id: i64,
    pub plan_name: String,
    pub server_groups: serde_json::Value,
    pub strategy: String,
}

/// 更新部署任务请求
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub plan_id: Option<i64>,
    pub plan_name: Option<String>,
    pub server_groups: Option<serde_json::Value>,
    pub strategy: Option<String>,
    pub status: Option<String>,
}

/// 执行历史记录
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionHistory {
    pub id: i64,
    pub task_id: i64,
    pub task_name: String,
    pub plan_id: i64,
    pub plan_name: String,
    pub status: String,
    pub total_steps: i64,
    pub progress: i64,
    pub start_time: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<i64>,
    pub server_groups: String,  // JSON 字符串
    pub created_at: String,
}

/// 执行日志
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionLog {
    pub id: i64,
    pub history_id: i64,
    pub timestamp: String,
    pub level: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_name: Option<String>,
}

/// 创建执行历史请求
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHistoryRequest {
    pub task_id: i64,
    pub task_name: String,
    pub plan_id: i64,
    pub plan_name: String,
    pub status: String,
    pub total_steps: i64,
    pub progress: i64,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration: Option<i64>,
    pub server_groups: serde_json::Value,
    pub logs: Vec<CreateLogRequest>,
}

/// 创建日志请求
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLogRequest {
    pub timestamp: String,
    pub level: String,
    pub message: String,
    pub server_id: Option<i64>,
    pub server_name: Option<String>,
    pub step_id: Option<String>,
    pub step_name: Option<String>,
}

/// 执行历史详情(包含日志)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionHistoryDetail {
    #[serde(flatten)]
    pub history: ExecutionHistory,
    pub logs: Vec<ExecutionLog>,
}

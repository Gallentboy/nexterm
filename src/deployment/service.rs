use sqlx::SqlitePool;
use crate::deployment::model::*;
use chrono::Utc;

#[derive(Clone)]
pub struct DeploymentService {
    pool: SqlitePool,
}

impl DeploymentService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    // ==================== 执行计划 ====================

    pub async fn get_all_plans(&self) -> Result<Vec<ExecutionPlan>, sqlx::Error> {
        sqlx::query_as::<_, ExecutionPlan>(
            "SELECT * FROM execution_plans ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_plan(&self, id: i64) -> Result<Option<ExecutionPlan>, sqlx::Error> {
        sqlx::query_as::<_, ExecutionPlan>(
            "SELECT * FROM execution_plans WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn create_plan(&self, req: CreatePlanRequest) -> Result<ExecutionPlan, sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        let steps_json = serde_json::to_string(&req.steps).unwrap_or_default();

        let result = sqlx::query(
            "INSERT INTO execution_plans (name, description, steps, version, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&steps_json)
        .bind(&req.version)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        let id = result.last_insert_rowid();

        Ok(ExecutionPlan {
            id,
            name: req.name,
            description: req.description,
            steps: steps_json,
            version: req.version,
            created_at: now,
            updated_at: None,
        })
    }

    pub async fn update_plan(&self, id: i64, req: UpdatePlanRequest) -> Result<u64, sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        let steps_json = req.steps.as_ref().map(|s| serde_json::to_string(s).unwrap_or_default());

        let result = sqlx::query(
            "UPDATE execution_plans SET 
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                steps = COALESCE(?, steps),
                version = COALESCE(?, version),
                updated_at = ?
            WHERE id = ?"
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&steps_json)
        .bind(&req.version)
        .bind(&now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    pub async fn delete_plan(&self, id: i64) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM execution_plans WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected())
    }

    // ==================== 部署任务 ====================

    pub async fn get_all_tasks(&self) -> Result<Vec<DeploymentTask>, sqlx::Error> {
        sqlx::query_as::<_, DeploymentTask>(
            "SELECT * FROM deployment_tasks ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_task(&self, id: i64) -> Result<Option<DeploymentTask>, sqlx::Error> {
        sqlx::query_as::<_, DeploymentTask>(
            "SELECT * FROM deployment_tasks WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn create_task(&self, req: CreateTaskRequest) -> Result<DeploymentTask, sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        let server_groups_json = serde_json::to_string(&req.server_groups).unwrap_or_default();

        let result = sqlx::query(
            "INSERT INTO deployment_tasks (name, description, plan_id, plan_name, server_groups, strategy, status, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.plan_id)
        .bind(&req.plan_name)
        .bind(&server_groups_json)
        .bind(&req.strategy)
        .bind("PENDING")
        .bind(&now)
        .execute(&self.pool)
        .await?;

        let id = result.last_insert_rowid();

        Ok(DeploymentTask {
            id,
            name: req.name,
            description: req.description,
            plan_id: req.plan_id,
            plan_name: req.plan_name,
            server_groups: server_groups_json,
            strategy: req.strategy,
            status: "PENDING".to_string(),
            created_at: now,
            started_at: None,
            completed_at: None,
        })
    }

    pub async fn update_task(&self, id: i64, req: UpdateTaskRequest) -> Result<u64, sqlx::Error> {
        let server_groups_json = req.server_groups.as_ref().map(|s| serde_json::to_string(s).unwrap_or_default());

        let result = sqlx::query(
            "UPDATE deployment_tasks SET 
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                plan_id = COALESCE(?, plan_id),
                plan_name = COALESCE(?, plan_name),
                server_groups = COALESCE(?, server_groups),
                strategy = COALESCE(?, strategy),
                status = COALESCE(?, status)
            WHERE id = ?"
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.plan_id)
        .bind(&req.plan_name)
        .bind(&server_groups_json)
        .bind(&req.strategy)
        .bind(&req.status)
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    pub async fn delete_task(&self, id: i64) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM deployment_tasks WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected())
    }

    // ==================== 执行历史 ====================

    /// 创建执行历史记录(包含日志)
    pub async fn create_history(&self, req: CreateHistoryRequest) -> Result<ExecutionHistoryDetail, sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        let server_groups_json = serde_json::to_string(&req.server_groups).unwrap_or_default();

        // 开始事务
        let mut tx = self.pool.begin().await?;

        // 插入历史记录
        let result = sqlx::query(
            "INSERT INTO execution_history (task_id, task_name, plan_id, plan_name, status, total_steps, progress, start_time, end_time, duration, server_groups, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&req.task_id)
        .bind(&req.task_name)
        .bind(&req.plan_id)
        .bind(&req.plan_name)
        .bind(&req.status)
        .bind(&req.total_steps)
        .bind(&req.progress)
        .bind(&req.start_time)
        .bind(&req.end_time)
        .bind(&req.duration)
        .bind(&server_groups_json)
        .bind(&now)
        .execute(&mut *tx)
        .await?;

        let history_id = result.last_insert_rowid();

        // 批量插入日志
        for log in &req.logs {
            sqlx::query(
                "INSERT INTO execution_logs (history_id, timestamp, level, message, server_id, server_name, step_id, step_name) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(history_id)
            .bind(&log.timestamp)
            .bind(&log.level)
            .bind(&log.message)
            .bind(&log.server_id)
            .bind(&log.server_name)
            .bind(&log.step_id)
            .bind(&log.step_name)
            .execute(&mut *tx)
            .await?;
        }

        // 提交事务
        tx.commit().await?;

        // 查询并返回完整的历史记录
        self.get_history(history_id).await
    }

    /// 获取所有执行历史(不包含日志)
    pub async fn get_all_history(&self) -> Result<Vec<ExecutionHistory>, sqlx::Error> {
        sqlx::query_as::<_, ExecutionHistory>(
            "SELECT * FROM execution_history ORDER BY start_time DESC LIMIT 100"
        )
        .fetch_all(&self.pool)
        .await
    }

    /// 获取单个执行历史(包含日志)
    pub async fn get_history(&self, id: i64) -> Result<ExecutionHistoryDetail, sqlx::Error> {
        let history = sqlx::query_as::<_, ExecutionHistory>(
            "SELECT * FROM execution_history WHERE id = ?"
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;

        let logs = sqlx::query_as::<_, ExecutionLog>(
            "SELECT * FROM execution_logs WHERE history_id = ? ORDER BY timestamp ASC"
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await?;

        Ok(ExecutionHistoryDetail { history, logs })
    }

    /// 删除执行历史
    pub async fn delete_history(&self, id: i64) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM execution_history WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected())
    }

    /// 清空所有执行历史
    pub async fn clear_all_history(&self) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM execution_history")
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected())
    }
}

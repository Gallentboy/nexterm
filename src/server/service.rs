use crate::server::models::*;
use anyhow::{anyhow, Result};
use sqlx::SqlitePool;

/// 服务器管理服务
#[derive(Clone)]
pub struct ServerService {
    pool: SqlitePool,
}

impl ServerService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// 记录操作日志
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    async fn log_operation(
        &self,
        user_id: i64,
        username: &str,
        server_id: Option<i64>,
        server_name: Option<&str>,
        operation_type: OperationType,
        operation_detail: Option<String>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO server_operation_logs 
            (user_id, username, server_id, server_name, operation_type, operation_detail)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(user_id)
        .bind(username)
        .bind(server_id)
        .bind(server_name)
        .bind(operation_type.to_string())
        .bind(operation_detail)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 创建服务器
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn create_server(
        &self,
        user_id: i64,
        username: &str,
        req: CreateServerRequest,
    ) -> Result<RemoteServer> {
        let auth_type = req.auth_type.unwrap_or(AuthType::Password).to_string();
        let port = req.port.unwrap_or(22);
        let tags = req
            .tags
            .map(|t| serde_json::to_string(&t).unwrap_or_default());

        let result = sqlx::query(
            r#"
            INSERT INTO remote_servers 
            (user_id, name, host, port, username, auth_type, password, private_key, description, tags, created_by_username)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(user_id)
        .bind(&req.name)
        .bind(&req.host)
        .bind(port)
        .bind(&req.username)
        .bind(&auth_type)
        .bind(&req.password)
        .bind(&req.private_key)
        .bind(&req.description)
        .bind(&tags)
        .bind(username)
        .execute(&self.pool)
        .await?;

        let server_id = result.last_insert_rowid();

        if let Some(group_id) = req.group_id {
            self.add_server_to_group(server_id, group_id).await?;
        }

        // 记录操作日志
        self.log_operation(
            user_id,
            username,
            Some(server_id),
            Some(&req.name),
            OperationType::Create,
            Some(format!(
                "创建服务器: {}@{}:{}",
                req.username, req.host, port
            )),
        )
        .await?;

        self.get_server_by_id(user_id, server_id)
            .await?
            .ok_or_else(|| anyhow!("创建服务器失败"))
    }

    /// 获取用户的所有服务器(支持分页)
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn list_servers(
        &self,
        user_id: i64,
        pagination: PaginationParams,
    ) -> Result<PaginatedResponse<ServerResponse>> {
        let page = pagination.page.unwrap_or(1);
        let page_size = pagination.page_size.unwrap_or(20);
        let group_id = pagination.group_id;
        let search = pagination.search;
        let offset = (page - 1) * page_size;

        let mut query_str = String::from(
            r#"
            FROM remote_servers s
            LEFT JOIN server_group_members sgm ON s.id = sgm.server_id
            LEFT JOIN server_groups g ON sgm.group_id = g.id
            WHERE s.user_id = ? AND s.is_active = 1
            "#
        );

        if let Some(gid) = group_id {
            if gid == 0 {
                query_str.push_str(" AND sgm.group_id IS NULL");
            } else {
                query_str.push_str(&format!(" AND sgm.group_id = {}", gid));
            }
        }

        if let Some(s) = search {
            if !s.is_empty() {
                query_str.push_str(&format!(" AND (s.name LIKE '%{}%' OR s.host LIKE '%{}%')", s, s));
            }
        }

        // 获取总条数
        let total: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) {}", query_str))
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;

        // 获取分页数据
        let select_query = format!(
            "SELECT s.*, g.id as group_id, g.name as group_name {} ORDER BY s.created_at DESC LIMIT ? OFFSET ?",
            query_str
        );

        let servers = sqlx::query_as::<_, RemoteServer>(&select_query)
            .bind(user_id)
            .bind(page_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await?;

        Ok(PaginatedResponse {
            items: servers.into_iter().map(ServerResponse::from).collect(),
            total,
            page,
            page_size,
        })
    }

    /// 根据 ID 获取服务器
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn get_server_by_id(
        &self,
        user_id: i64,
        server_id: i64,
    ) -> Result<Option<RemoteServer>> {
        let server = sqlx::query_as::<_, RemoteServer>(
            r#"
            SELECT s.*, g.id as group_id, g.name as group_name 
            FROM remote_servers s
            LEFT JOIN server_group_members sgm ON s.id = sgm.server_id
            LEFT JOIN server_groups g ON sgm.group_id = g.id
            WHERE s.id = ? AND s.user_id = ? AND s.is_active = 1
            "#,
        )
        .bind(server_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(server)
    }

    /// 更新服务器
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn update_server(
        &self,
        user_id: i64,
        username: &str,
        server_id: i64,
        req: UpdateServerRequest,
    ) -> Result<RemoteServer> {
        // 先检查服务器是否存在
        let existing = self
            .get_server_by_id(user_id, server_id)
            .await?
            .ok_or_else(|| anyhow!("服务器不存在"))?;

        let name = req.name.clone().unwrap_or(existing.name.clone());
        let host = req.host.unwrap_or(existing.host);
        let port = req.port.unwrap_or(existing.port);
        let srv_username = req.username.unwrap_or(existing.username);
        let auth_type = req
            .auth_type
            .map(|t| t.to_string())
            .unwrap_or(existing.auth_type);
        let password = req.password.or(existing.password);
        let private_key = req.private_key.or(existing.private_key);
        let description = req.description.or(existing.description);
        let tags = req
            .tags
            .map(|t| serde_json::to_string(&t).ok())
            .flatten()
            .or(existing.tags);

        sqlx::query(
            r#"
            UPDATE remote_servers 
            SET name = ?, host = ?, port = ?, username = ?, auth_type = ?,
                password = ?, private_key = ?, description = ?, tags = ?,
                updated_at = CURRENT_TIMESTAMP, updated_by_username = ?
            WHERE id = ? AND user_id = ?
            "#,
        )
        .bind(&name)
        .bind(&host)
        .bind(port)
        .bind(&srv_username)
        .bind(&auth_type)
        .bind(&password)
        .bind(&private_key)
        .bind(&description)
        .bind(&tags)
        .bind(username)
        .bind(server_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        sqlx::query("DELETE FROM server_group_members WHERE server_id = ?")
            .bind(server_id)
            .execute(&self.pool)
            .await?;
        if let Some(group_id) = req.group_id {
            self.add_server_to_group(server_id, group_id).await?;
        }

        // 记录操作日志
        self.log_operation(
            user_id,
            username,
            Some(server_id),
            Some(&name),
            OperationType::Update,
            Some(format!("更新服务器: {}", name)),
        )
        .await?;

        self.get_server_by_id(user_id, server_id)
            .await?
            .ok_or_else(|| anyhow!("更新服务器失败"))
    }

    /// 删除服务器(软删除)
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn delete_server(
        &self,
        user_id: i64,
        username: &str,
        server_id: i64,
    ) -> Result<String> {
        // 获取服务器名称用于日志
        let server = self
            .get_server_by_id(user_id, server_id)
            .await?
            .ok_or_else(|| anyhow!("服务器不存在"))?;
        let server_name = server.name.clone();

        sqlx::query(
            "UPDATE remote_servers SET is_active = 0, updated_at = CURRENT_TIMESTAMP, updated_by_username = ? WHERE id = ? AND user_id = ?"
        )
        .bind(username)
        .bind(server_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        // 记录操作日志
        self.log_operation(
            user_id,
            username,
            Some(server_id),
            Some(&server_name),
            OperationType::Delete,
            Some(format!("删除服务器: {}", server_name)),
        )
        .await?;

        Ok(server_name)
    }

    /// 批量删除服务器(软删除)
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn batch_delete_servers(
        &self,
        user_id: i64,
        username: &str,
        ids: Vec<i64>,
    ) -> Result<()> {
        if ids.is_empty() {
            return Ok(());
        }

        // 构造占位符 (?, ?, ?)
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

        // 软删除
        let query_str = format!(
            "UPDATE remote_servers SET is_active = 0, updated_at = CURRENT_TIMESTAMP, updated_by_username = ? WHERE id IN ({}) AND user_id = ?",
            placeholders
        );

        let mut query = sqlx::query(&query_str).bind(username);

        for id in &ids {
            query = query.bind(id);
        }

        query.bind(user_id).execute(&self.pool).await?;

        // 记录操作日志
        self.log_operation(
            user_id,
            username,
            None,
            None,
            OperationType::Delete,
            Some(format!("批量删除 {} 台服务器, ID 列表: {:?}", ids.len(), ids)),
        )
        .await?;

        Ok(())
    }

    /// 更新最后连接时间
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn update_last_connected(&self, server_id: i64) -> Result<()> {
        sqlx::query("UPDATE remote_servers SET last_connected_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(server_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// 创建服务器分组
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn create_group(&self, user_id: i64, req: CreateGroupRequest) -> Result<ServerGroup> {
        let result = sqlx::query("INSERT INTO server_groups (user_id, name, description) VALUES (?, ?, ?)")
            .bind(user_id)
            .bind(&req.name)
            .bind(&req.description)
            .execute(&self.pool)
            .await;

        let result = match result {
            Ok(res) => res,
            Err(e) => {
                if let Some(sqlite_error) = e.as_database_error() {
                    if sqlite_error.code() == Some("1555".into()) || e.to_string().contains("UNIQUE constraint failed") {
                        return Err(anyhow!("分组名称 '{}' 已存在", req.name));
                    }
                }
                return Err(e.into());
            }
        };

        let group = sqlx::query_as::<_, ServerGroup>(
            r#"
            SELECT g.*, COUNT(sgm.server_id) as server_count 
            FROM server_groups g
            LEFT JOIN server_group_members sgm ON g.id = sgm.group_id
            WHERE g.id = ?
            GROUP BY g.id
            "#
        )
            .bind(result.last_insert_rowid())
            .fetch_one(&self.pool)
            .await?;

        Ok(group)
    }

    /// 获取用户的所有分组(支持分页)
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn list_groups(
        &self,
        user_id: i64,
        pagination: PaginationParams,
    ) -> Result<PaginatedResponse<ServerGroup>> {
        let page = pagination.page.unwrap_or(1);
        let page_size = pagination.page_size.unwrap_or(20);
        let offset = (page - 1) * page_size;

        // 获取总数
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM server_groups WHERE user_id = ?")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;

        // 获取分页数据
        let groups = sqlx::query_as::<_, ServerGroup>(
            r#"
            SELECT g.*, COUNT(sgm.server_id) as server_count 
            FROM server_groups g
            LEFT JOIN server_group_members sgm ON g.id = sgm.group_id
            WHERE g.user_id = ? 
            GROUP BY g.id
            ORDER BY g.created_at DESC
            LIMIT ? OFFSET ?
            "#
        )
        .bind(user_id)
        .bind(page_size)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok(PaginatedResponse {
            items: groups,
            total,
            page,
            page_size,
        })
    }

    /// 更新服务器分组
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn update_group(
        &self,
        user_id: i64,
        group_id: i64,
        req: UpdateGroupRequest,
    ) -> Result<ServerGroup> {
        let mut query = String::from("UPDATE server_groups SET ");
        let mut updates = Vec::new();

        if let Some(name) = &req.name {
            updates.push(format!("name = '{}'", name));
        }

        if let Some(description) = &req.description {
            updates.push(format!("description = '{}'", description));
        }

        if updates.is_empty() {
            return self.get_group_by_id(user_id, group_id).await;
        }

        query.push_str(&updates.join(", "));
        query.push_str(" WHERE id = ? AND user_id = ?");

        sqlx::query(&query)
            .bind(group_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        self.get_group_by_id(user_id, group_id).await
    }

    /// 删除服务器分组
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn delete_group(&self, user_id: i64, group_id: i64) -> Result<()> {
        // 首先检查分组是否存在且属于该用户
        let group = self.get_group_by_id(user_id, group_id).await?;

        // 删除分组关联关系
        sqlx::query("DELETE FROM server_group_members WHERE group_id = ?")
            .bind(group.id)
            .execute(&self.pool)
            .await?;

        // 删除分组本身
        sqlx::query("DELETE FROM server_groups WHERE id = ? AND user_id = ?")
            .bind(group.id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// 批量删除服务器分组
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn batch_delete_groups(
        &self,
        user_id: i64,
        ids: Vec<i64>,
    ) -> Result<()> {
        if ids.is_empty() {
            return Ok(());
        }

        // 构造占位符 (?, ?, ?)
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

        // 1. 删除所有关联关系
        let delete_members_query = format!(
            "DELETE FROM server_group_members WHERE group_id IN ({})",
            placeholders
        );
        let mut query1 = sqlx::query(&delete_members_query);
        for id in &ids {
            query1 = query1.bind(id);
        }
        query1.execute(&self.pool).await?;

        // 2. 删除分组本身 (受 user_id 限制以保证安全)
        let delete_groups_query = format!(
            "DELETE FROM server_groups WHERE id IN ({}) AND user_id = ?",
            placeholders
        );
        let mut query2 = sqlx::query(&delete_groups_query);
        for id in &ids {
            query2 = query2.bind(id);
        }
        query2.bind(user_id).execute(&self.pool).await?;

        Ok(())
    }

    /// 根据 ID 获取分组
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn get_group_by_id(&self, user_id: i64, group_id: i64) -> Result<ServerGroup> {
        let group = sqlx::query_as::<_, ServerGroup>(
            r#"
            SELECT g.*, COUNT(sgm.server_id) as server_count 
            FROM server_groups g
            LEFT JOIN server_group_members sgm ON g.id = sgm.group_id
            WHERE g.id = ? AND g.user_id = ?
            GROUP BY g.id
            "#
        )
        .bind(group_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        match group {
            Some(g) => Ok(g),
            None => Err(anyhow!("分组不存在")),
        }
    }

    /// 将服务器添加到分组
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn add_server_to_group(&self, server_id: i64, group_id: i64) -> Result<()> {
        sqlx::query(
            "INSERT OR IGNORE INTO server_group_members (server_id, group_id) VALUES (?, ?)",
        )
        .bind(server_id)
        .bind(group_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 从分组中移除服务器
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn remove_server_from_group(&self, server_id: i64, group_id: i64) -> Result<()> {
        sqlx::query("DELETE FROM server_group_members WHERE server_id = ? AND group_id = ?")
            .bind(server_id)
            .bind(group_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}

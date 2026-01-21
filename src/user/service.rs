use crate::user::models::{User, RegisterRequest, LoginRequest};
use anyhow::{anyhow, Result};
use bcrypt::{hash, verify, DEFAULT_COST};
use sqlx::SqlitePool;

/// 用户服务
#[derive(Clone)]
pub struct UserService {
    pool: SqlitePool,
}

impl UserService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// 注册新用户
    ///
    /// <ul>
    ///   <li>验证用户名是否已存在</li>
    ///   <li>对密码进行 bcrypt 哈希</li>
    ///   <li>创建新用户记录</li>
    /// </ul>
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn register(&self, req: RegisterRequest) -> Result<User> {
        // 检查用户名是否已存在
        let existing = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE username = ?"
        )
        .bind(&req.username)
        .fetch_optional(&self.pool)
        .await?;

        if existing.is_some() {
            return Err(anyhow!("用户名已存在"));
        }

        // 哈希密码
        let password_hash = hash(&req.password, DEFAULT_COST)?;

        // 插入新用户
        let result = sqlx::query(
            r#"
            INSERT INTO users (username, password_hash, email, display_name)
            VALUES (?, ?, ?, ?)
            "#
        )
        .bind(&req.username)
        .bind(&password_hash)
        .bind(&req.email)
        .bind(&req.display_name)
        .execute(&self.pool)
        .await?;

        // 获取新创建的用户
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE id = ?"
        )
        .bind(result.last_insert_rowid())
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    /// 用户登录验证
    ///
    /// <ul>
    ///   <li>查找用户</li>
    ///   <li>验证密码</li>
    ///   <li>更新最后登录时间</li>
    /// </ul>
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn login(&self, req: LoginRequest) -> Result<User> {
        // 查找用户
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE username = ? AND is_active = 1"
        )
        .bind(&req.username)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| anyhow!("用户名或密码错误"))?;

        // 验证密码
        if !verify(&req.password, &user.password_hash)? {
            return Err(anyhow!("用户名或密码错误"));
        }

        // 更新最后登录时间
        sqlx::query(
            "UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?"
        )
        .bind(user.id)
        .execute(&self.pool)
        .await?;

        Ok(user)
    }

    /// 根据 ID 获取用户
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn get_by_id(&self, user_id: i64) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE id = ? AND is_active = 1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    /// 根据用户名获取用户
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn get_by_username(&self, username: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE username = ? AND is_active = 1"
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    /// 修改密码
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn change_password(&self, user_id: i64, old_password: &str, new_password: &str) -> Result<()> {
        // 获取用户
        let user = self.get_by_id(user_id).await?
            .ok_or_else(|| anyhow!("用户不存在"))?;

        // 验证旧密码
        if !verify(old_password, &user.password_hash)? {
            return Err(anyhow!("原密码错误"));
        }

        // 哈希新密码
        let new_hash = hash(new_password, DEFAULT_COST)?;

        // 更新密码
        sqlx::query(
            "UPDATE users SET password_hash = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
        )
        .bind(&new_hash)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 停用用户
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn deactivate(&self, user_id: i64) -> Result<()> {
        sqlx::query(
            "UPDATE users SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?"
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

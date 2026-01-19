# Session 工作原理说明

## 🔍 Session ID 为 None 的原因

在 `tower-sessions` 中,session ID 的创建时机很重要:

### ❌ 错误做法
```rust
// 仅插入数据,不保存
session.insert("user_id", user.id).await.ok();
let session_id = session.id(); // 返回 None!
```

### ✅ 正确做法
```rust
// 1. 插入数据
session.insert("user_id", user.id).await.ok();
session.insert("username", username).await.ok();

// 2. 保存 session (关键步骤!)
session.save().await?;

// 3. 现在可以获取 session ID
let session_id = session.id(); // 返回 Some(SessionId)
```

## 🔄 Session 生命周期

```
1. 请求到达
   ↓
2. SessionManagerLayer 提取 Cookie
   ↓
3. 如果 Cookie 存在 → 加载已有 session
   如果 Cookie 不存在 → 创建新 session (但 ID 为 None)
   ↓
4. 处理器中操作 session
   - insert() - 添加数据
   - get() - 读取数据
   - delete() - 删除 session
   ↓
5. 调用 save() 或响应结束时自动保存
   - 此时才会创建 session ID
   - 设置 Set-Cookie 响应头
   ↓
6. 客户端收到 Cookie
   ↓
7. 后续请求携带 Cookie
```

## 📝 Session 操作最佳实践

### 1. 登录时设置 Session

```rust
pub async fn login(session: Session, ...) -> impl IntoResponse {
    // 设置 session 数据
    session.insert("user_id", user.id).await.ok();
    session.insert("username", user.username).await.ok();
    
    // 保存 session,确保 session ID 被创建
    session.save().await?;
    
    // 获取 session ID
    let session_id = session.id()
        .map(|id| id.to_string())
        .unwrap_or_else(|| "unknown".to_string());
    
    // 返回给客户端
    Json(json!({
        "session_id": session_id
    }))
}
```

### 2. 读取 Session

```rust
pub async fn get_user(session: Session) -> impl IntoResponse {
    // 直接读取,不需要 save()
    let user_id: Option<i64> = session.get("user_id").await.ok().flatten();
    
    match user_id {
        Some(id) => { /* 已登录 */ }
        None => { /* 未登录 */ }
    }
}
```

### 3. 登出时删除 Session

```rust
pub async fn logout(session: Session) -> impl IntoResponse {
    // 删除整个 session
    session.delete().await.ok();
    
    // 或者只删除特定键
    // session.remove::<i64>("user_id").await.ok();
}
```

## 🎯 Session 配置

### 基本配置

```rust
let session_store = MemoryStore::default();
let session_layer = SessionManagerLayer::new(session_store)
    .with_secure(false)  // 开发环境: false, 生产环境: true
    .with_http_only(true)  // 防止 XSS
    .with_same_site(SameSite::Lax);  // CSRF 保护
```

### 过期时间配置

```rust
use tower_sessions::Expiry;
use std::time::Duration;

let session_layer = SessionManagerLayer::new(session_store)
    .with_expiry(Expiry::OnInactivity(Duration::from_secs(3600))); // 1小时不活动后过期
```

## 🔐 Session 安全

### 1. HTTPS Only (生产环境)
```rust
.with_secure(true)  // 仅通过 HTTPS 传输
```

### 2. HttpOnly
```rust
.with_http_only(true)  // 防止 JavaScript 访问 Cookie
```

### 3. SameSite
```rust
use tower_sessions::cookie::SameSite;

.with_same_site(SameSite::Strict)  // 最严格
.with_same_site(SameSite::Lax)     // 推荐
.with_same_site(SameSite::None)    // 跨站允许
```

## 🐛 常见问题

### Q1: Session ID 总是 None?
**A:** 在设置 session 数据后调用 `session.save().await`

### Q2: Session 数据丢失?
**A:** 检查:
- Session 存储是否正确配置
- Cookie 是否被客户端正确发送
- Session 是否过期

### Q3: 跨域请求 Session 无效?
**A:** 配置 CORS 允许携带凭证:
```rust
use tower_http::cors::CorsLayer;

CorsLayer::new()
    .allow_credentials(true)
    .allow_origin(/* ... */)
```

客户端也需要设置:
```javascript
fetch(url, {
    credentials: 'include'  // 携带 Cookie
})
```

## 📊 Session 存储对比

| 存储类型 | 优点 | 缺点 | 适用场景 |
|---------|------|------|----------|
| MemoryStore | 快速,简单 | 重启丢失,不支持多实例 | 开发环境 |
| RedisStore | 持久化,支持多实例 | 需要 Redis | 生产环境 |
| SqliteStore | 持久化,无额外依赖 | 性能较低 | 小型应用 |

## 💡 调试技巧

### 1. 打印 Session 信息
```rust
info!("Session ID: {:?}", session.id());
info!("Session data: {:?}", session.get::<i64>("user_id").await);
```

### 2. 检查 Cookie
浏览器开发者工具 → Application/Storage → Cookies

### 3. 查看 Session 存储
```rust
// MemoryStore 会在内存中
// SqliteStore 可以查询数据库
SELECT * FROM sessions;
```

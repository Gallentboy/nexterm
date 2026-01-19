# 认证中间件文档

## 🔐 概述

本项目实现了基于 Session 的全局认证中间件,用于保护需要登录才能访问的路由。

## 📋 中间件类型

### 1. `auth_middleware` - 强制认证中间件

**功能:**
- 检查用户是否已登录(session 中是否有 `user_id`)
- 如果未登录,返回 401 错误
- 如果已登录,将用户信息注入到 request extensions 中

**使用场景:**
- 需要强制登录的路由
- 例如:获取用户信息、修改密码、WebSocket 连接等

**示例:**
```rust
let protected_routes = Router::new()
    .route("/api/auth/me", get(get_current_user))
    .route("/api/auth/change-password", post(change_password))
    .layer(middleware::from_fn(auth_middleware));
```

### 2. `optional_auth_middleware` - 可选认证中间件

**功能:**
- 如果用户已登录,将用户信息注入到 request extensions
- 如果用户未登录,也允许继续访问

**使用场景:**
- 某些功能对登录用户和未登录用户都开放,但行为不同
- 例如:首页、商品列表等

**示例:**
```rust
let optional_auth_routes = Router::new()
    .route("/api/products", get(list_products))
    .layer(middleware::from_fn(optional_auth_middleware));
```

## 🎯 路由分组

### 公开路由(无需认证)
```rust
let public_routes = Router::new()
    .route("/", get(index_handler))
    .route("/api/status", get(status_handler))
    .route("/api/auth/register", post(register))
    .route("/api/auth/login", post(login));
```

### 受保护路由(需要认证)
```rust
let protected_routes = Router::new()
    .route("/api/auth/logout", post(logout))
    .route("/api/auth/me", get(get_current_user))
    .route("/api/auth/change-password", post(change_password))
    .route("/ws", get(ws_handler))
    .layer(middleware::from_fn(auth_middleware));
```

## 💡 在处理器中使用 CurrentUser

### 方法 1: 使用 Extension 提取器

```rust
use axum::extract::Extension;
use crate::user::middleware::CurrentUser;

pub async fn my_handler(
    Extension(current_user): Extension<CurrentUser>,
) -> impl IntoResponse {
    let user_id = current_user.user_id;
    // 处理逻辑...
}
```

### 方法 2: 从 Request Extensions 手动获取

```rust
use axum::extract::Request;
use crate::user::middleware::CurrentUser;

pub async fn my_handler(request: Request) -> impl IntoResponse {
    let current_user = request.extensions().get::<CurrentUser>().unwrap();
    let user_id = current_user.user_id;
    // 处理逻辑...
}
```

## 🔄 工作流程

```
1. 用户请求 → 2. Session 中间件 → 3. 认证中间件 → 4. 处理器
                     ↓                    ↓
                 提取 session        检查 user_id
                                         ↓
                                  注入 CurrentUser
```

### 详细步骤:

1. **Session 中间件** (`SessionManagerLayer`)
   - 从 Cookie 中提取 session ID
   - 加载 session 数据

2. **认证中间件** (`auth_middleware`)
   - 从 session 获取 `user_id`
   - 如果存在,创建 `CurrentUser` 并注入到 request extensions
   - 如果不存在,返回 401 错误

3. **处理器**
   - 使用 `Extension<CurrentUser>` 提取用户信息
   - 执行业务逻辑

## 📊 错误响应

### 未登录 (401)
```json
{
  "status": "error",
  "message": "未登录,请先登录"
}
```

## 🧪 测试示例

### 1. 访问受保护路由(未登录)
```bash
curl -X GET http://localhost:3000/api/auth/me
# 返回: {"status":"error","message":"未登录,请先登录"}
```

### 2. 登录后访问受保护路由
```bash
# 先登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"testuser","password":"password123"}'

# 访问受保护路由
curl -X GET http://localhost:3000/api/auth/me \
  -b cookies.txt
# 返回: 用户信息
```

## 🔧 自定义中间件

如果需要添加更多认证逻辑,可以扩展中间件:

```rust
pub async fn custom_auth_middleware(
    session: Session,
    mut request: Request,
    next: Next,
) -> Result<Response, Response> {
    let user_id: Option<i64> = session.get("user_id").await.ok().flatten();

    match user_id {
        Some(id) => {
            // 可以添加额外的检查,例如:
            // - 检查用户角色
            // - 检查用户权限
            // - 检查 IP 白名单
            // - 检查请求频率限制
            
            request.extensions_mut().insert(CurrentUser { user_id: id });
            Ok(next.run(request).await)
        }
        None => {
            Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "status": "error",
                    "message": "未登录"
                })),
            ).into_response())
        }
    }
}
```

## 🎨 最佳实践

1. **明确区分公开和受保护路由**
   - 使用不同的 Router 分组
   - 清晰的代码结构

2. **使用 Extension 提取器**
   - 简洁的处理器签名
   - 类型安全

3. **统一错误响应格式**
   - 便于前端处理
   - 良好的用户体验

4. **日志记录**
   - 记录认证失败的请求
   - 便于安全审计

## 🔒 安全建议

1. **生产环境配置**
   ```rust
   let session_layer = SessionManagerLayer::new(session_store)
       .with_secure(true)  // 仅 HTTPS
       .with_http_only(true)  // 防止 XSS
       .with_same_site(SameSite::Strict);  // 防止 CSRF
   ```

2. **Session 过期时间**
   ```rust
   let session_layer = SessionManagerLayer::new(session_store)
       .with_expiry(Expiry::OnInactivity(Duration::from_secs(3600)));
   ```

3. **HTTPS 强制**
   - 生产环境必须使用 HTTPS
   - 防止 session 劫持

4. **CSRF 保护**
   - 对于状态改变的操作(POST/PUT/DELETE)
   - 添加 CSRF token 验证

# WebSocket 与 Session 集成指南

## 🔗 Session 传递机制

### 问题
WebSocket 升级后,如何在 WebSocket 连接中访问 session 数据?

### 解决方案

#### 1️⃣ 在 `ws_handler` 中提取 session 数据

```rust
async fn ws_handler(ws: WebSocketUpgrade, session: Session) -> impl IntoResponse {
    // 从 session 获取用户信息
    let user_id: Option<i64> = session.get("user_id").await.ok().flatten();
    let username: Option<String> = session.get("username").await.ok().flatten();
    
    // 升级连接,使用 move 闭包传递数据
    ws.on_upgrade(move |socket| handle_socket(socket, user_id, username))
}
```

**关键点:**
- 使用 `move` 闭包将 `user_id` 和 `username` 移动到异步任务中
- 在升级前提取所有需要的 session 数据
- Session 本身不能直接传递到 WebSocket 连接中

#### 2️⃣ 修改 `handle_socket` 函数签名

```rust
pub async fn handle_socket(
    mut socket: WebSocket,
    user_id: Option<i64>,
    username: Option<String>,
) {
    // 现在可以使用用户信息
    match (&user_id, &username) {
        (Some(id), Some(name)) => {
            info!("用户 {} (ID: {}) 连接", name, id);
        }
        _ => {
            info!("匿名用户连接");
        }
    }
    
    // ... 处理消息
}
```

## 🎯 完整流程

```
1. 客户端发起 WebSocket 连接
   ↓
2. ws_handler 接收请求
   - 提取 Session
   - 从 Session 读取用户信息
   ↓
3. WebSocket 升级
   - 使用 move 闭包
   - 传递用户信息到 handle_socket
   ↓
4. handle_socket 处理连接
   - 接收用户信息参数
   - 处理消息时可以使用用户信息
```

## 📝 使用示例

### 场景 1: 已登录用户连接

```bash
# 1. 先登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"test","password":"123456"}'

# 2. 使用 websocat 连接 (携带 cookie)
websocat ws://localhost:3000/ws \
  --header "Cookie: $(cat cookies.txt | grep -v '^#' | awk '{print $6"="$7}')"
```

**服务器日志:**
```
WebSocket 连接请求 - session ID: Some(...), 用户: Some("test") (ID: Some(1))
WebSocket 连接建立 - 用户: test (ID: 1)
```

**客户端收到:**
```
欢迎, test! WebSocket 连接已建立。
```

### 场景 2: 未登录用户连接

```bash
websocat ws://localhost:3000/ws
```

**服务器日志:**
```
WebSocket 连接请求 - session ID: None, 用户: None (ID: None)
WebSocket 连接建立 - 匿名用户
```

**客户端收到:**
```
欢迎! WebSocket 连接已建立。
```

## 🔐 认证保护

如果你想要求 WebSocket 连接必须登录,可以在 `ws_handler` 中检查:

```rust
async fn ws_handler(ws: WebSocketUpgrade, session: Session) -> impl IntoResponse {
    // 检查用户是否登录
    let user_id: Option<i64> = session.get("user_id").await.ok().flatten();
    let username: Option<String> = session.get("username").await.ok().flatten();
    
    // 如果未登录,拒绝连接
    if user_id.is_none() {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "status": "error",
                "message": "未登录,无法建立 WebSocket 连接"
            }))
        ).into_response();
    }
    
    // 已登录,允许升级
    ws.on_upgrade(move |socket| handle_socket(socket, user_id, username))
        .into_response()
}
```

## 💡 高级用法

### 1. 传递更多上下文

```rust
// 定义用户上下文结构
#[derive(Clone)]
struct UserContext {
    user_id: i64,
    username: String,
    roles: Vec<String>,
}

async fn ws_handler(ws: WebSocketUpgrade, session: Session) -> impl IntoResponse {
    let user_ctx = session.get::<i64>("user_id").await.ok().flatten()
        .and_then(|id| {
            let username = session.get::<String>("username").await.ok().flatten()?;
            let roles = session.get::<Vec<String>>("roles").await.ok().flatten()
                .unwrap_or_default();
            Some(UserContext { user_id: id, username, roles })
        });
    
    ws.on_upgrade(move |socket| handle_socket_with_context(socket, user_ctx))
}
```

### 2. 使用 Extension 传递共享状态

```rust
use axum::extract::State;

async fn ws_handler(
    ws: WebSocketUpgrade,
    session: Session,
    State(user_service): State<UserService>,
) -> impl IntoResponse {
    let user_id: Option<i64> = session.get("user_id").await.ok().flatten();
    
    ws.on_upgrade(move |socket| {
        handle_socket_with_service(socket, user_id, user_service)
    })
}
```

## 🧪 测试工具

### 使用 websocat

```bash
# 安装
brew install websocat  # macOS
# 或
cargo install websocat

# 连接
websocat ws://localhost:3000/ws

# 发送消息
Hello, WebSocket!

# 收到回显
[test] Echo: Hello, WebSocket!
```

### 使用 JavaScript

```javascript
// 浏览器中测试
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
    console.log('连接已建立');
    ws.send('Hello from browser!');
};

ws.onmessage = (event) => {
    console.log('收到:', event.data);
};

ws.onerror = (error) => {
    console.error('错误:', error);
};

ws.onclose = () => {
    console.log('连接已关闭');
};
```

## ⚠️ 注意事项

1. **Session 不能直接传递**
   - Session 不是 `Send + 'static`
   - 必须在升级前提取所有需要的数据

2. **使用 move 闭包**
   - 确保数据所有权转移到异步任务
   - 避免生命周期问题

3. **数据克隆**
   - 如果需要传递复杂数据,确保实现了 `Clone`
   - 或者使用 `Arc` 共享数据

4. **错误处理**
   - WebSocket 连接可能随时断开
   - 使用 `is_err()` 检查发送结果

## 📊 性能优化

1. **批量消息处理**
   ```rust
   // 使用缓冲区批量处理
   let mut buffer = Vec::new();
   while let Some(msg) = socket.recv().await {
       buffer.push(msg);
       if buffer.len() >= 10 {
           // 批量处理
           process_batch(&buffer).await;
           buffer.clear();
       }
   }
   ```

2. **心跳检测**
   ```rust
   use tokio::time::{interval, Duration};
   
   let mut heartbeat = interval(Duration::from_secs(30));
   loop {
       tokio::select! {
           _ = heartbeat.tick() => {
               if socket.send(Message::Ping(vec![])).await.is_err() {
                   break;
               }
           }
           msg = socket.recv() => {
               // 处理消息
           }
       }
   }
   ```

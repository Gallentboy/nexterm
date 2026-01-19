# 用户认证 API 文档

## 📚 API 端点

### 1. 用户注册
**POST** `/api/auth/register`

注册新用户账号。

**请求体:**
```json
{
  "username": "testuser",
  "password": "password123",
  "email": "test@example.com",
  "display_name": "测试用户"
}
```

**验证规则:**
- `username`: 3-50 个字符
- `password`: 最少 6 个字符
- `email`: 可选,必须是有效的邮箱格式
- `display_name`: 可选

**成功响应 (201):**
```json
{
  "status": "success",
  "message": "注册成功",
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "display_name": "测试用户",
    "created_at": "2026-01-16 13:00:00",
    "last_login_at": null
  }
}
```

**错误响应 (400):**
```json
{
  "status": "error",
  "message": "用户名已存在"
}
```

---

### 2. 用户登录
**POST** `/api/auth/login`

用户登录,成功后会设置 session。

**请求体:**
```json
{
  "username": "testuser",
  "password": "password123"
}
```

**成功响应 (200):**
```json
{
  "status": "success",
  "message": "登录成功",
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "display_name": "测试用户",
    "created_at": "2026-01-16 13:00:00",
    "last_login_at": "2026-01-16 13:05:00"
  },
  "session_id": "..."
}
```

**错误响应 (401):**
```json
{
  "status": "error",
  "message": "用户名或密码错误"
}
```

---

### 3. 用户登出
**POST** `/api/auth/logout`

用户登出,清除 session。

**成功响应 (200):**
```json
{
  "status": "success",
  "message": "登出成功"
}
```

---

### 4. 获取当前用户信息
**GET** `/api/auth/me`

获取当前登录用户的信息(需要先登录)。

**成功响应 (200):**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "display_name": "测试用户",
    "created_at": "2026-01-16 13:00:00",
    "last_login_at": "2026-01-16 13:05:00"
  }
}
```

**错误响应 (401):**
```json
{
  "status": "error",
  "message": "未登录"
}
```

---

### 5. 修改密码
**POST** `/api/auth/change-password`

修改当前用户的密码(需要先登录)。

**请求体:**
```json
{
  "old_password": "password123",
  "new_password": "newpassword456"
}
```

**验证规则:**
- `new_password`: 最少 6 个字符

**成功响应 (200):**
```json
{
  "status": "success",
  "message": "密码修改成功"
}
```

**错误响应 (400):**
```json
{
  "status": "error",
  "message": "原密码错误"
}
```

---

## 🔐 Session 机制

所有认证接口都使用 **Cookie-based Session**:

1. 登录成功后,服务器会自动设置 session cookie
2. 后续请求会自动携带 cookie,无需手动处理
3. Session 存储在内存中(重启后会丢失)
4. WebSocket 连接也可以访问同一个 session

## 🧪 测试示例

### 使用 curl 测试

```bash
# 1. 注册用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123",
    "email": "test@example.com",
    "display_name": "测试用户"
  }'

# 2. 登录(保存 cookie)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'

# 3. 获取当前用户信息(使用 cookie)
curl -X GET http://localhost:3000/api/auth/me \
  -b cookies.txt

# 4. 修改密码
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "old_password": "password123",
    "new_password": "newpassword456"
  }'

# 5. 登出
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

## 📁 数据库表结构

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    is_active INTEGER DEFAULT 1
);
```

## 🔒 安全特性

- ✅ 密码使用 bcrypt 哈希存储
- ✅ 输入参数验证
- ✅ Session 管理
- ✅ 用户名唯一性检查
- ✅ 账户激活状态控制

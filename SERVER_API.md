# 服务器管理 API 文档

## 📚 API 端点

所有服务器管理接口都需要用户登录认证。

### 1. 创建服务器
**POST** `/api/servers`

创建一个新的远程服务器配置。

**请求头:**
```
Cookie: session_id=...
```

**请求体:**
```json
{
  "name": "生产服务器",
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "auth_type": "password",
  "password": "your_password",
  "description": "生产环境主服务器",
  "tags": ["production", "web"]
}
```

**字段说明:**
- `name` (必填): 服务器名称,1-100字符
- `host` (必填): 服务器地址(IP或域名)
- `port` (可选): SSH端口,默认22,范围1-65535
- `username` (必填): SSH用户名
- `auth_type` (可选): 认证类型,`password` 或 `key`,默认 `password`
- `password` (可选): 密码(auth_type为password时)
- `private_key` (可选): 私钥内容(auth_type为key时)
- `description` (可选): 服务器描述
- `tags` (可选): 标签数组

**成功响应 (201):**
```json
{
  "status": "success",
  "message": "服务器创建成功",
  "data": {
    "id": 1,
    "name": "生产服务器",
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "auth_type": "password",
    "description": "生产环境主服务器",
    "tags": ["production", "web"],
    "created_at": "2026-01-16 15:00:00",
    "last_connected_at": null
  }
}
```

---

### 2. 获取服务器列表
**GET** `/api/servers`

获取当前用户的所有服务器。

**成功响应 (200):**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "生产服务器",
      "host": "192.168.1.100",
      "port": 22,
      "username": "root",
      "auth_type": "password",
      "description": "生产环境主服务器",
      "tags": ["production", "web"],
      "created_at": "2026-01-16 15:00:00",
      "last_connected_at": "2026-01-16 15:30:00"
    }
  ]
}
```

---

### 3. 获取单个服务器
**GET** `/api/servers/:id`

获取指定服务器的详细信息。

**成功响应 (200):**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "生产服务器",
    ...
  }
}
```

**错误响应 (404):**
```json
{
  "status": "error",
  "message": "服务器不存在"
}
```

---

### 4. 更新服务器
**PUT** `/api/servers/:id`

更新服务器配置。所有字段都是可选的,只更新提供的字段。

**请求体:**
```json
{
  "name": "生产服务器-更新",
  "description": "更新后的描述",
  "tags": ["production", "web", "updated"]
}
```

**成功响应 (200):**
```json
{
  "status": "success",
  "message": "服务器更新成功",
  "data": {
    "id": 1,
    "name": "生产服务器-更新",
    ...
  }
}
```

---

### 5. 删除服务器
**DELETE** `/api/servers/:id`

删除指定服务器(软删除)。

**成功响应 (200):**
```json
{
  "status": "success",
  "message": "服务器删除成功"
}
```

---

### 6. 创建服务器分组
**POST** `/api/server-groups`

创建服务器分组。

**请求体:**
```json
{
  "name": "生产环境",
  "description": "所有生产环境服务器"
}
```

**成功响应 (201):**
```json
{
  "status": "success",
  "message": "分组创建成功",
  "data": {
    "id": 1,
    "user_id": 1,
    "name": "生产环境",
    "description": "所有生产环境服务器",
    "created_at": "2026-01-16 15:00:00"
  }
}
```

---

### 7. 获取分组列表
**GET** `/api/server-groups`

获取当前用户的所有分组。

**成功响应 (200):**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "name": "生产环境",
      "description": "所有生产环境服务器",
      "created_at": "2026-01-16 15:00:00"
    }
  ]
}
```

---

## 🧪 测试示例

### 使用 curl 测试

```bash
# 1. 登录获取 session
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "username": "test",
    "password": "password123"
  }'

# 2. 创建服务器
curl -X POST http://localhost:3000/api/servers \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "测试服务器",
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "auth_type": "password",
    "password": "server_password",
    "description": "测试环境服务器",
    "tags": ["test", "development"]
  }'

# 3. 获取服务器列表
curl -X GET http://localhost:3000/api/servers \
  -b cookies.txt

# 4. 获取单个服务器
curl -X GET http://localhost:3000/api/servers/1 \
  -b cookies.txt

# 5. 更新服务器
curl -X PUT http://localhost:3000/api/servers/1 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "测试服务器-已更新",
    "description": "更新后的描述"
  }'

# 6. 删除服务器
curl -X DELETE http://localhost:3000/api/servers/1 \
  -b cookies.txt

# 7. 创建分组
curl -X POST http://localhost:3000/api/server-groups \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "生产环境",
    "description": "生产服务器分组"
  }'

# 8. 获取分组列表
curl -X GET http://localhost:3000/api/server-groups \
  -b cookies.txt
```

## 📊 数据库表结构

### remote_servers 表
```sql
CREATE TABLE remote_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'password',
    password TEXT,
    private_key TEXT,
    description TEXT,
    tags TEXT,  -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_connected_at DATETIME,
    is_active INTEGER DEFAULT 1
);
```

### server_groups 表
```sql
CREATE TABLE server_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔒 安全特性

1. **认证保护**: 所有接口都需要登录
2. **用户隔离**: 用户只能访问自己的服务器
3. **密码加密**: 敏感信息不在响应中返回
4. **软删除**: 删除操作不会真正删除数据
5. **参数验证**: 所有输入都经过验证

## 💡 使用建议

1. **密码管理**: 建议使用密钥认证而非密码
2. **标签使用**: 使用标签对服务器分类管理
3. **定期更新**: 及时更新服务器配置信息
4. **分组管理**: 使用分组组织大量服务器

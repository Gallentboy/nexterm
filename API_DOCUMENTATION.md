# SSH/SFTP 管理系统 - 完整 API 文档

## 📚 目录

- [基础信息](#基础信息)
- [认证接口](#认证接口)
- [用户管理](#用户管理)
- [服务器管理](#服务器管理)
- [SSH 连接](#ssh-连接)
- [SFTP 文件传输](#sftp-文件传输)
- [错误码](#错误码)

---

## 基础信息

### 服务地址

```
HTTP API:  http://localhost:3000/api
WebSocket: ws://localhost:3000
```

### 认证方式

使用 **Session Cookie** 认证:
- Cookie 名称: `id`
- 登录后自动设置
- 所有受保护接口需要携带此 Cookie

### 通用响应格式

#### 成功响应

```json
{
    "id": 1,
    "username": "test",
    "email": "test@example.com"
}
```

#### 错误响应

```json
{
    "error": "错误描述信息"
}
```

---

## 认证接口

### 1. 用户注册

**接口**: `POST /api/auth/register`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
    "username": "test",
    "email": "test@example.com",
    "password": "password123",
    "display_name": "测试用户"
}
```

**字段说明**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | ✅ | 用户名,3-50字符 |
| email | string | ✅ | 邮箱地址 |
| password | string | ✅ | 密码,最少6字符 |
| display_name | string | ✅ | 显示名称 |

**成功响应**: `201 Created`
```json
{
    "id": 1,
    "username": "test",
    "email": "test@example.com",
    "display_name": "测试用户",
    "created_at": "2026-01-16T10:00:00Z"
}
```

**错误响应**:
- `400 Bad Request`: 参数验证失败
- `409 Conflict`: 用户名或邮箱已存在

---

### 2. 用户登录

**接口**: `POST /api/auth/login`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
    "username": "test",
    "password": "password123"
}
```

**成功响应**: `200 OK`
```json
{
    "id": 1,
    "username": "test",
    "email": "test@example.com",
    "display_name": "测试用户"
}
```

**响应头**:
```
Set-Cookie: id=<session-id>; HttpOnly; SameSite=Strict; Path=/
```

**错误响应**:
- `401 Unauthorized`: 用户名或密码错误

---

### 3. 用户登出

**接口**: `POST /api/auth/logout`

**请求头**:
```
Cookie: id=<session-id>
```

**成功响应**: `200 OK`
```json
{
    "message": "登出成功"
}
```

---

### 4. 获取当前用户

**接口**: `GET /api/auth/me`

**请求头**:
```
Cookie: id=<session-id>
```

**成功响应**: `200 OK`
```json
{
    "id": 1,
    "username": "test",
    "email": "test@example.com",
    "display_name": "测试用户",
    "created_at": "2026-01-16T10:00:00Z"
}
```

**错误响应**:
- `401 Unauthorized`: 未登录

---

### 5. 修改密码

**接口**: `POST /api/auth/change-password`

**请求头**:
```
Cookie: id=<session-id>
Content-Type: application/json
```

**请求体**:
```json
{
    "old_password": "old123",
    "new_password": "new456"
}
```

**成功响应**: `200 OK`
```json
{
    "message": "密码修改成功"
}
```

**错误响应**:
- `400 Bad Request`: 旧密码错误
- `401 Unauthorized`: 未登录

---

## 用户管理

### 6. 获取用户列表

**接口**: `GET /api/users`

**请求头**:
```
Cookie: id=<session-id>
```

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | integer | ❌ | 页码,默认1 |
| page_size | integer | ❌ | 每页数量,默认20 |

**成功响应**: `200 OK`
```json
{
    "users": [
        {
            "id": 1,
            "username": "test",
            "email": "test@example.com",
            "display_name": "测试用户",
            "created_at": "2026-01-16T10:00:00Z"
        }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
}
```

---

## 服务器管理

### 7. 创建服务器

**接口**: `POST /api/servers`

**请求头**:
```
Cookie: id=<session-id>
Content-Type: application/json
```

**请求体**:
```json
{
    "name": "生产服务器1",
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "password": "server_password",
    "description": "生产环境主服务器",
    "group_id": 1
}
```

**字段说明**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✅ | 服务器名称 |
| host | string | ✅ | 主机地址(IP或域名) |
| port | integer | ✅ | SSH端口,默认22 |
| username | string | ✅ | SSH用户名 |
| password | string | ❌ | SSH密码(可选) |
| private_key | string | ❌ | SSH私钥(可选) |
| description | string | ❌ | 描述信息 |
| group_id | integer | ❌ | 所属分组ID |

**成功响应**: `201 Created`
```json
{
    "id": 1,
    "name": "生产服务器1",
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "description": "生产环境主服务器",
    "group_id": 1,
    "created_by_username": "test",
    "created_at": "2026-01-16T10:00:00Z"
}
```

**错误响应**:
- `400 Bad Request`: 参数验证失败
- `401 Unauthorized`: 未登录

---

### 8. 获取服务器列表

**接口**: `GET /api/servers`

**请求头**:
```
Cookie: id=<session-id>
```

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | integer | ❌ | 页码,默认 1 |
| page_size | integer | ❌ | 每页数量,默认 20 |
| group_id | integer | ❌ | 按分组筛选 (0 表示未分组) |
| search | string | ❌ | 搜索关键词(名称/主机) |

**成功响应**: `200 OK`
```json
{
    "status": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "name": "生产服务器1",
                "host": "192.168.1.100",
                "port": 22,
                "username": "root",
                "description": "生产环境主服务器",
                "group_id": 1,
                "group_name": "生产环境",
                "created_by_username": "test",
                "created_at": "2026-01-16T10:00:00Z"
            }
        ],
        "total": 1,
        "page": 1,
        "page_size": 20
    }
}
```

---

### 9. 获取服务器详情

**接口**: `GET /api/servers/{id}`

**请求头**:
```
Cookie: id=<session-id>
```

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | integer | 服务器ID |

**成功响应**: `200 OK`
```json
{
    "id": 1,
    "name": "生产服务器1",
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "description": "生产环境主服务器",
    "group_id": 1,
    "created_by_username": "test",
    "updated_by_username": "test",
    "created_at": "2026-01-16T10:00:00Z",
    "updated_at": "2026-01-16T11:00:00Z"
}
```

**错误响应**:
- `404 Not Found`: 服务器不存在

---

### 10. 更新服务器

**接口**: `PUT /api/servers/{id}`

**请求头**:
```
Cookie: id=<session-id>
Content-Type: application/json
```

**请求体**:
```json
{
    "name": "生产服务器1(更新)",
    "host": "192.168.1.101",
    "port": 22,
    "username": "admin",
    "password": "new_password",
    "description": "更新后的描述",
    "group_id": 2
}
```

**成功响应**: `200 OK`
```json
{
    "id": 1,
    "name": "生产服务器1(更新)",
    "host": "192.168.1.101",
    "port": 22,
    "username": "admin",
    "description": "更新后的描述",
    "group_id": 2,
    "updated_by_username": "test",
    "updated_at": "2026-01-16T12:00:00Z"
}
```

---

### 11. 删除服务器

**接口**: `DELETE /api/servers/{id}`

**请求头**:
```
Cookie: id=<session-id>
```

**成功响应**: `200 OK`
```json
{
    "message": "服务器删除成功"
}
```

**错误响应**:
- `404 Not Found`: 服务器不存在

---

### 12. 创建服务器分组

**接口**: `POST /api/server-groups`

**请求头**:
```
Cookie: id=<session-id>
Content-Type: application/json
```

**请求体**:
```json
{
    "name": "生产环境",
    "description": "生产环境服务器组"
}
```

**成功响应**: `201 Created`
```json
{
    "id": 1,
    "name": "生产环境",
    "description": "生产环境服务器组",
    "created_at": "2026-01-16T10:00:00Z"
}
```

---

### 13. 获取分组列表

**接口**: `GET /api/server-groups`

**请求头**:
```
Cookie: id=<session-id>
```

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | integer | ❌ | 页码,默认 1 |
| page_size | integer | ❌ | 每页数量,默认 20 |

**成功响应**: `200 OK`
```json
{
    "status": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "name": "生产环境",
                "description": "生产环境服务器组",
                "server_count": 5,
                "created_at": "2026-01-16T10:00:00Z"
            }
        ],
        "total": 1,
        "page": 1,
        "page_size": 20
    }
}
```

---

## SSH 连接

### 14. SSH WebSocket 连接

**接口**: `GET /ssh` (WebSocket)

**协议**: WebSocket

**请求头**:
```
Cookie: id=<session-id>
Upgrade: websocket
Connection: Upgrade
```

#### 连接流程

##### 1. 建立 WebSocket 连接

```javascript
const ws = new WebSocket('ws://localhost:3000/ssh');
```

##### 2. 发送连接参数(第一条消息)

**Shell 模式**:
```json
{
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "password": "server_password",
    "mode": "shell",
    "term": "xterm-256color",
    "cols": 80,
    "rows": 24
}
```

**Exec 模式**:
```json
{
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "password": "server_password",
    "mode": "exec",
    "command": "ls -la",
    "workdir": "/app",
    "env": {
        "APP_ENV": "production"
    },
    "shell": "bash"
}
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| host | string | ✅ | 服务器地址 |
| port | integer | ✅ | SSH端口 |
| username | string | ✅ | 用户名 |
| password | string | ✅ | 密码 |
| mode | string | ❌ | 模式: "shell"(默认) 或 "exec" |
| **Shell 模式参数** |
| term | string | ❌ | 终端类型,默认"xterm" |
| cols | integer | ❌ | 列数,默认80 |
| rows | integer | ❌ | 行数,默认24 |
| **Exec 模式参数** |
| command | string | ✅ | 要执行的命令 |
| workdir | string | ❌ | 工作目录 |
| env | object | ❌ | 环境变量 |
| shell | string | ❌ | Shell类型,默认"bash" |

##### 3. 接收服务器消息

**Shell 模式** - 实时输出:
```
连接成功后,直接接收终端输出(文本消息)
```

**Exec 模式** - 结构化消息:
```json
{
    "type": "exec_complete",
    "exit_code": 0,
    "output": "命令输出内容"
}
```

##### 4. 发送输入(Shell 模式)

```javascript
// 发送命令
ws.send('ls -la\n');

// 发送 Ctrl+C
ws.send('\x03');
```

##### 5. 调整终端大小(Shell 模式)

```json
{
    "type": "resize",
    "cols": 120,
    "rows": 40
}
```

#### 完整示例

**Shell 模式**:
```javascript
const ws = new WebSocket('ws://localhost:3000/ssh');

ws.onopen = () => {
    // 发送连接参数
    ws.send(JSON.stringify({
        host: '192.168.1.100',
        port: 22,
        username: 'root',
        password: 'xxx',
        mode: 'shell',
        term: 'xterm-256color',
        cols: 80,
        rows: 24
    }));
};

ws.onmessage = (event) => {
    // 显示终端输出
    console.log(event.data);
};

// 发送命令
ws.send('ls -la\n');
ws.send('pwd\n');
```

**Exec 模式**:
```javascript
const ws = new WebSocket('ws://localhost:3000/ssh');

ws.onopen = () => {
    ws.send(JSON.stringify({
        host: '192.168.1.100',
        port: 22,
        username: 'root',
        password: 'xxx',
        mode: 'exec',
        command: 'systemctl status nginx',
        workdir: '/var/log',
        env: {
            'LOG_LEVEL': 'debug'
        }
    }));
};

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'exec_complete') {
        console.log('退出码:', msg.exit_code);
        console.log('输出:', msg.output);
        ws.close();
    }
};
```

---

## SFTP 文件传输

### 15. SFTP WebSocket 连接

**接口**: `GET /sftp` (WebSocket)

**协议**: WebSocket

**请求头**:
```
Cookie: id=<session-id>
Upgrade: websocket
Connection: Upgrade
```

#### 连接流程

##### 1. 建立连接并发送认证信息

```json
{
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "password": "server_password"
}
```

##### 2. 接收连接成功消息

```json
{
    "type": "connected"
}
```

##### 3. 发送 SFTP 命令

#### 命令列表

##### 列出目录

**请求**:
```json
{
    "type": "list_dir",
    "path": "/home/user"
}
```

**响应**:
```json
{
    "type": "dir_list",
    "entries": [
        {
            "name": "file.txt",
            "is_dir": false,
            "size": 1024,
            "modified": 1705392000,
            "permissions": 33188
        },
        {
            "name": "folder",
            "is_dir": true,
            "size": 4096,
            "modified": 1705392000,
            "permissions": 16877
        }
    ]
}
```

##### 下载文件(分块)

**请求**:
```json
{
    "type": "download_file",
    "path": "/home/user/file.txt"
}
```

**响应流程**:

1. 下载开始:
```json
{
    "type": "download_start",
    "total_size": 10485760
}
```

2. 数据块(循环):
```json
{
    "type": "download_chunk",
    "chunk_id": 0,
    "size": 1048576
}
```
紧接着发送二进制数据(Binary Message)

3. 下载完成:
```json
{
    "type": "download_end"
}
```

##### 上传文件(分块)

**流程**:

1. 开始上传:
```json
{
    "type": "upload_file_start",
    "path": "/home/user/upload.txt",
    "total_size": 10485760
}
```

2. 服务器确认:
```json
{
    "type": "success",
    "message": "准备接收文件"
}
```

3. 发送数据块(循环):
```json
{
    "type": "upload_file_chunk",
    "chunk_id": 0,
    "data": [/* byte array */]
}
```

4. 接收进度:
```json
{
    "type": "upload_progress",
    "received": 1048576,
    "total": 10485760
}
```

5. 完成上传:
```json
{
    "type": "upload_file_end"
}
```

6. 服务器确认:
```json
{
    "type": "success",
    "message": "文件上传成功"
}
```

##### 删除文件

**请求**:
```json
{
    "type": "delete_file",
    "path": "/home/user/file.txt"
}
```

**响应**:
```json
{
    "type": "success",
    "message": "文件删除成功"
}
```

##### 删除目录

**请求**:
```json
{
    "type": "delete_dir",
    "path": "/home/user/folder"
}
```

**响应**:
```json
{
    "type": "success",
    "message": "目录删除成功"
}
```

##### 创建目录

**请求**:
```json
{
    "type": "create_dir",
    "path": "/home/user/new_folder"
}
```

**响应**:
```json
{
    "type": "success",
    "message": "目录创建成功"
}
```

##### 重命名

**请求**:
```json
{
    "type": "rename",
    "old_path": "/home/user/old.txt",
    "new_path": "/home/user/new.txt"
}
```

**响应**:
```json
{
    "type": "success",
    "message": "重命名成功"
}
```

##### 获取文件属性

**请求**:
```json
{
    "type": "get_attr",
    "path": "/home/user/file.txt"
}
```

**响应**:
```json
{
    "type": "file_attr",
    "attr": {
        "size": 1024,
        "is_dir": false,
        "modified": 1705392000,
        "permissions": 33188
    }
}
```

#### 错误处理

**错误响应**:
```json
{
    "type": "error",
    "message": "错误描述信息"
}
```

#### 完整示例

```javascript
const ws = new WebSocket('ws://localhost:3000/sftp');

ws.onopen = () => {
    // 连接
    ws.send(JSON.stringify({
        host: '192.168.1.100',
        port: 22,
        username: 'root',
        password: 'xxx'
    }));
};

ws.onmessage = async (event) => {
    if (event.data instanceof Blob) {
        // 二进制数据(文件块)
        const buffer = await event.data.arrayBuffer();
        console.log('接收文件块:', buffer.byteLength);
    } else {
        // JSON 消息
        const msg = JSON.parse(event.data);
        
        switch (msg.type) {
            case 'connected':
                console.log('SFTP 连接成功');
                // 列出目录
                ws.send(JSON.stringify({
                    type: 'list_dir',
                    path: '/home'
                }));
                break;
                
            case 'dir_list':
                console.log('目录内容:', msg.entries);
                break;
                
            case 'error':
                console.error('错误:', msg.message);
                break;
        }
    }
};
```

---

## 错误码

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证(未登录) |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 500 | 服务器内部错误 |

### 业务错误码

| 错误信息 | 说明 |
|---------|------|
| "用户名或密码错误" | 登录失败 |
| "用户名已存在" | 注册时用户名重复 |
| "邮箱已存在" | 注册时邮箱重复 |
| "旧密码错误" | 修改密码时旧密码不正确 |
| "服务器不存在" | 服务器ID无效 |
| "连接失败" | SSH/SFTP连接失败 |
| "文件不存在" | SFTP操作的文件不存在 |

---

## 附录

### A. 数据类型说明

#### 时间格式
所有时间字段使用 ISO 8601 格式:
```
2026-01-16T10:00:00Z
```

#### 权限值
Unix 文件权限(八进制):
- 33188 = 0100644 (普通文件, rw-r--r--)
- 16877 = 0040755 (目录, rwxr-xr-x)

### B. 最佳实践

1. **Session 管理**: 登录后保存 Cookie,所有请求自动携带
2. **错误处理**: 始终检查响应状态码和错误信息
3. **WebSocket 重连**: 实现断线重连机制
4. **文件传输**: 使用分块传输处理大文件
5. **安全性**: 生产环境使用 HTTPS/WSS

### C. 示例代码

完整的前端集成示例请参考:
- `frontend/dist/assets/app.js`
- `SFTP_CHUNKED_TRANSFER.md`

---

**文档版本**: v1.0.0  
**最后更新**: 2026-01-16  
**维护者**: SSH/SFTP 管理系统开发团队

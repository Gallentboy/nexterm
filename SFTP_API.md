# SFTP API 文档

## 📚 概述

SFTP 功能通过 WebSocket 提供,支持文件上传、下载、列表、删除等操作。

## 🔌 连接端点

**WebSocket URL**: `ws://localhost:3000/sftp`

**认证**: 需要登录(通过 Cookie 携带 session)

## 📝 消息格式

### 客户端 → 服务器

所有消息都是 JSON 格式的文本消息。

#### 1. 连接参数(首次消息)

```json
{
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "password": "your_password"
}
```

或使用密钥:

```json
{
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n..."
}
```

#### 2. 列出目录

```json
{
  "type": "list_dir",
  "path": "/home/user"
}
```

#### 3. 下载文件

```json
{
  "type": "download_file",
  "path": "/home/user/file.txt"
}
```

#### 4. 上传文件

```json
{
  "type": "upload_file",
  "path": "/home/user/newfile.txt",
  "content": [72, 101, 108, 108, 111]  // 文件内容(字节数组)
}
```

#### 5. 删除文件

```json
{
  "type": "delete_file",
  "path": "/home/user/file.txt"
}
```

#### 6. 删除目录

```json
{
  "type": "delete_dir",
  "path": "/home/user/olddir"
}
```

#### 7. 创建目录

```json
{
  "type": "create_dir",
  "path": "/home/user/newdir"
}
```

#### 8. 重命名

```json
{
  "type": "rename",
  "old_path": "/home/user/old.txt",
  "new_path": "/home/user/new.txt"
}
```

#### 9. 获取文件属性

```json
{
  "type": "get_attr",
  "path": "/home/user/file.txt"
}
```

### 服务器 → 客户端

#### 1. 连接成功

```json
{
  "type": "connected"
}
```

#### 2. 目录列表

```json
{
  "type": "dir_list",
  "entries": [
    {
      "name": "file.txt",
      "is_dir": false,
      "size": 1024,
      "modified": 1705392000,
      "permissions": 420
    },
    {
      "name": "subdir",
      "is_dir": true,
      "size": 4096,
      "modified": 1705392000,
      "permissions": 493
    }
  ]
}
```

#### 3. 文件内容(二进制消息)

下载文件时,服务器会发送二进制消息,内容为文件的字节数据。

#### 4. 文件属性

```json
{
  "type": "file_attr",
  "attr": {
    "size": 1024,
    "is_dir": false,
    "modified": 1705392000,
    "permissions": 420
  }
}
```

#### 5. 操作成功

```json
{
  "type": "success",
  "message": "文件上传成功"
}
```

#### 6. 错误

```json
{
  "type": "error",
  "message": "文件不存在"
}
```

#### 7. 连接关闭

```json
{
  "type": "closed"
}
```

## 🧪 使用示例

### JavaScript 客户端

```javascript
// 1. 建立 WebSocket 连接
const ws = new WebSocket('ws://localhost:3000/sftp');

ws.onopen = () => {
    console.log('WebSocket 已连接');
    
    // 2. 发送连接参数
    ws.send(JSON.stringify({
        host: '192.168.1.100',
        port: 22,
        username: 'root',
        password: 'password123'
    }));
};

ws.onmessage = (event) => {
    if (event.data instanceof Blob) {
        // 二进制数据(文件内容)
        event.data.arrayBuffer().then(buffer => {
            console.log('收到文件,大小:', buffer.byteLength);
            // 处理文件内容
        });
    } else {
        // JSON 消息
        const msg = JSON.parse(event.data);
        console.log('收到消息:', msg);
        
        switch (msg.type) {
            case 'connected':
                console.log('SFTP 连接成功');
                // 列出根目录
                ws.send(JSON.stringify({
                    type: 'list_dir',
                    path: '/'
                }));
                break;
                
            case 'dir_list':
                console.log('目录内容:', msg.entries);
                break;
                
            case 'success':
                console.log('操作成功:', msg.message);
                break;
                
            case 'error':
                console.error('错误:', msg.message);
                break;
        }
    }
};

ws.onerror = (error) => {
    console.error('WebSocket 错误:', error);
};

ws.onclose = () => {
    console.log('WebSocket 已关闭');
};

// 3. 上传文件
function uploadFile(path, content) {
    // content 是 Uint8Array
    ws.send(JSON.stringify({
        type: 'upload_file',
        path: path,
        content: Array.from(content)
    }));
}

// 4. 下载文件
function downloadFile(path) {
    ws.send(JSON.stringify({
        type: 'download_file',
        path: path
    }));
}

// 5. 列出目录
function listDir(path) {
    ws.send(JSON.stringify({
        type: 'list_dir',
        path: path
    }));
}

// 6. 创建目录
function createDir(path) {
    ws.send(JSON.stringify({
        type: 'create_dir',
        path: path
    }));
}

// 7. 删除文件
function deleteFile(path) {
    ws.send(JSON.stringify({
        type: 'delete_file',
        path: path
    }));
}
```

### 使用 websocat 测试

```bash
# 1. 先登录获取 session
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"test","password":"123456"}'

# 2. 使用 websocat 连接(需要手动处理 cookie)
# 注意: websocat 不直接支持 cookie,需要使用其他工具
```

## 📊 权限说明

### 文件权限(Unix)

权限值是一个数字,例如:
- `420` (0644) - 文件: rw-r--r--
- `493` (0755) - 目录: rwxr-xr-x

转换公式:
```
权限 = 用户权限×64 + 组权限×8 + 其他权限
其中: r=4, w=2, x=1
```

## ⚠️ 注意事项

1. **认证要求**: 必须先登录才能使用 SFTP
2. **路径格式**: 使用 Unix 风格路径,例如 `/home/user/file.txt`
3. **文件大小**: 上传大文件时注意内存使用
4. **并发操作**: 一个 WebSocket 连接同时只能处理一个操作
5. **错误处理**: 始终检查服务器返回的错误消息

## 🔒 安全建议

1. **使用 HTTPS/WSS**: 生产环境必须使用加密连接
2. **密钥认证**: 优先使用 SSH 密钥而非密码
3. **路径验证**: 客户端应验证路径,防止目录遍历攻击
4. **文件大小限制**: 设置合理的文件大小限制
5. **超时设置**: 设置合理的操作超时时间

## 🚀 完整示例

### 文件管理器示例

```javascript
class SFTPClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.ws = null;
        this.connected = false;
    }

    connect(host, port, username, password) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                // 发送连接参数
                this.ws.send(JSON.stringify({
                    host, port, username, password
                }));
            };

            this.ws.onmessage = (event) => {
                if (event.data instanceof Blob) {
                    this.handleFileData(event.data);
                } else {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'connected') {
                        this.connected = true;
                        resolve();
                    } else {
                        this.handleMessage(msg);
                    }
                }
            };

            this.ws.onerror = (error) => {
                reject(error);
            };
        });
    }

    listDir(path) {
        return new Promise((resolve, reject) => {
            const handler = (msg) => {
                if (msg.type === 'dir_list') {
                    resolve(msg.entries);
                } else if (msg.type === 'error') {
                    reject(new Error(msg.message));
                }
            };
            this.sendCommand({ type: 'list_dir', path }, handler);
        });
    }

    downloadFile(path) {
        return new Promise((resolve, reject) => {
            const handler = (data) => {
                if (data instanceof ArrayBuffer) {
                    resolve(data);
                }
            };
            this.sendCommand({ type: 'download_file', path }, handler);
        });
    }

    uploadFile(path, content) {
        return new Promise((resolve, reject) => {
            const handler = (msg) => {
                if (msg.type === 'success') {
                    resolve();
                } else if (msg.type === 'error') {
                    reject(new Error(msg.message));
                }
            };
            this.sendCommand({
                type: 'upload_file',
                path,
                content: Array.from(new Uint8Array(content))
            }, handler);
        });
    }

    sendCommand(cmd, handler) {
        this.ws.send(JSON.stringify(cmd));
        // 注册消息处理器
        // (实际实现需要更复杂的消息路由)
    }

    handleMessage(msg) {
        // 处理服务器消息
        console.log('收到消息:', msg);
    }

    handleFileData(blob) {
        // 处理文件数据
        console.log('收到文件数据');
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// 使用示例
const client = new SFTPClient('ws://localhost:3000/sftp');

async function main() {
    try {
        // 连接
        await client.connect('192.168.1.100', 22, 'root', 'password');
        console.log('SFTP 连接成功');

        // 列出目录
        const files = await client.listDir('/home/user');
        console.log('文件列表:', files);

        // 上传文件
        const content = new TextEncoder().encode('Hello, SFTP!');
        await client.uploadFile('/home/user/test.txt', content);
        console.log('文件上传成功');

        // 下载文件
        const data = await client.downloadFile('/home/user/test.txt');
        console.log('文件下载成功,大小:', data.byteLength);

    } catch (error) {
        console.error('错误:', error);
    } finally {
        client.close();
    }
}
```

## 📈 性能优化建议

1. **批量操作**: 对于多个文件,考虑打包后传输
2. **断点续传**: 大文件支持分块传输
3. **压缩**: 传输前压缩文件内容
4. **缓存**: 缓存目录列表结果
5. **并发控制**: 限制同时进行的操作数量

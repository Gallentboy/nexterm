# SFTP 分块传输使用指南

## 📚 概述

为了支持大文件传输,SFTP 模块实现了分块传输机制:
- **下载**: 服务器自动分块发送,每块 1MB
- **上传**: 客户端分块发送,每块大小可自定义
- **进度报告**: 实时报告传输进度

## 🔧 分块大小

服务器端分块大小: `1MB (1024 * 1024 字节)`

客户端可以根据网络情况调整上传块大小,建议:
- 快速网络: 1MB - 5MB
- 普通网络: 512KB - 1MB  
- 慢速网络: 256KB - 512KB

## 📥 下载文件(分块)

### 流程

1. 客户端发送下载请求
2. 服务器返回文件总大小
3. 服务器分块发送数据
4. 每块先发送元信息,再发送二进制数据
5. 所有块发送完成后,发送完成消息

### JavaScript 示例

```javascript
class SFTPDownloader {
    constructor(ws) {
        this.ws = ws;
        this.chunks = [];
        this.totalSize = 0;
        this.receivedSize = 0;
    }

    async downloadFile(path) {
        return new Promise((resolve, reject) => {
            this.chunks = [];
            this.totalSize = 0;
            this.receivedSize = 0;

            const messageHandler = (event) => {
                if (event.data instanceof Blob) {
                    // 二进制数据(文件块)
                    event.data.arrayBuffer().then(buffer => {
                        this.chunks.push(new Uint8Array(buffer));
                        this.receivedSize += buffer.byteLength;
                        
                        // 更新进度
                        const progress = (this.receivedSize / this.totalSize * 100).toFixed(2);
                        console.log(`下载进度: ${progress}%`);
                    });
                } else {
                    // JSON 消息
                    const msg = JSON.parse(event.data);
                    
                    switch (msg.type) {
                        case 'download_start':
                            this.totalSize = msg.total_size;
                            console.log(`开始下载,文件大小: ${this.totalSize} 字节`);
                            break;
                            
                        case 'download_chunk':
                            console.log(`接收块 #${msg.chunk_id}, 大小: ${msg.size}`);
                            break;
                            
                        case 'download_end':
                            console.log('下载完成');
                            // 合并所有块
                            const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                            const result = new Uint8Array(totalLength);
                            let offset = 0;
                            for (const chunk of this.chunks) {
                                result.set(chunk, offset);
                                offset += chunk.length;
                            }
                            this.ws.removeEventListener('message', messageHandler);
                            resolve(result);
                            break;
                            
                        case 'error':
                            this.ws.removeEventListener('message', messageHandler);
                            reject(new Error(msg.message));
                            break;
                    }
                }
            };

            this.ws.addEventListener('message', messageHandler);

            // 发送下载请求
            this.ws.send(JSON.stringify({
                type: 'download_file',
                path: path
            }));
        });
    }
}

// 使用示例
const downloader = new SFTPDownloader(ws);
const fileData = await downloader.downloadFile('/home/user/largefile.zip');

// 保存文件
const blob = new Blob([fileData]);
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'largefile.zip';
a.click();
URL.revokeObjectURL(url);
```

## 📤 上传文件(分块)

### 流程

1. 客户端发送上传开始消息(包含文件总大小)
2. 服务器创建文件并返回确认
3. 客户端分块发送数据
4. 服务器每接收一块返回进度
5. 所有块发送完成后,客户端发送完成消息
6. 服务器同步文件并返回成功

### JavaScript 示例

```javascript
class SFTPUploader {
    constructor(ws, chunkSize = 1024 * 1024) { // 默认 1MB
        this.ws = ws;
        this.chunkSize = chunkSize;
    }

    async uploadFile(path, file) {
        return new Promise((resolve, reject) => {
            const totalSize = file.size;
            let uploadedSize = 0;
            let chunkId = 0;

            const messageHandler = (event) => {
                const msg = JSON.parse(event.data);
                
                switch (msg.type) {
                    case 'success':
                        if (msg.message === '准备接收文件') {
                            // 开始发送块
                            sendNextChunk();
                        } else if (msg.message === '文件上传成功') {
                            console.log('上传完成');
                            this.ws.removeEventListener('message', messageHandler);
                            resolve();
                        }
                        break;
                        
                    case 'upload_progress':
                        const progress = (msg.received / msg.total * 100).toFixed(2);
                        console.log(`上传进度: ${progress}% (${msg.received}/${msg.total})`);
                        // 继续发送下一块
                        sendNextChunk();
                        break;
                        
                    case 'error':
                        this.ws.removeEventListener('message', messageHandler);
                        reject(new Error(msg.message));
                        break;
                }
            };

            const sendNextChunk = () => {
                if (uploadedSize >= totalSize) {
                    // 所有块已发送,发送完成消息
                    this.ws.send(JSON.stringify({
                        type: 'upload_file_end'
                    }));
                    return;
                }

                const start = uploadedSize;
                const end = Math.min(start + this.chunkSize, totalSize);
                const chunk = file.slice(start, end);

                const reader = new FileReader();
                reader.onload = (e) => {
                    const data = new Uint8Array(e.target.result);
                    
                    // 发送块
                    this.ws.send(JSON.stringify({
                        type: 'upload_file_chunk',
                        chunk_id: chunkId,
                        data: Array.from(data)
                    }));

                    uploadedSize = end;
                    chunkId++;
                };
                reader.readAsArrayBuffer(chunk);
            };

            this.ws.addEventListener('message', messageHandler);

            // 发送上传开始消息
            this.ws.send(JSON.stringify({
                type: 'upload_file_start',
                path: path,
                total_size: totalSize
            }));
        });
    }
}

// 使用示例
const uploader = new SFTPUploader(ws, 512 * 1024); // 512KB 块大小
const file = document.getElementById('fileInput').files[0];
await uploader.uploadFile('/home/user/upload.zip', file);
```

## 🎯 完整示例:文件管理器

```javascript
class SFTPFileManager {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.ws = null;
        this.downloader = null;
        this.uploader = null;
    }

    async connect(host, port, username, password) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                // 发送连接参数
                this.ws.send(JSON.stringify({
                    host, port, username, password
                }));
            };

            this.ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.type === 'connected') {
                    this.downloader = new SFTPDownloader(this.ws);
                    this.uploader = new SFTPUploader(this.ws);
                    resolve();
                }
            };

            this.ws.onerror = reject;
        });
    }

    async downloadFile(remotePath, localFilename) {
        const data = await this.downloader.downloadFile(remotePath);
        
        // 保存到本地
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = localFilename;
        a.click();
        URL.revokeObjectURL(url);
    }

    async uploadFile(file, remotePath) {
        await this.uploader.uploadFile(remotePath, file);
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// 使用示例
const manager = new SFTPFileManager('ws://localhost:3000/sftp');

async function main() {
    try {
        // 连接
        await manager.connect('192.168.1.100', 22, 'root', 'password');
        console.log('SFTP 连接成功');

        // 下载文件
        await manager.downloadFile('/home/user/data.zip', 'data.zip');
        console.log('文件下载成功');

        // 上传文件
        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];
        await manager.uploadFile(file, '/home/user/upload/' + file.name);
        console.log('文件上传成功');

    } catch (error) {
        console.error('错误:', error);
    } finally {
        manager.close();
    }
}
```

## 💡 优化建议

### 1. 断点续传

```javascript
class ResumableUploader extends SFTPUploader {
    async uploadFile(path, file, startChunk = 0) {
        // 从指定块开始上传
        // 实现略...
    }
}
```

### 2. 并发上传

对于多个小文件,可以并发上传:

```javascript
async function uploadMultipleFiles(files) {
    const promises = files.map(file => 
        uploader.uploadFile(`/upload/${file.name}`, file)
    );
    await Promise.all(promises);
}
```

### 3. 压缩传输

```javascript
// 上传前压缩
import pako from 'pako';

const compressed = pako.gzip(fileData);
await uploader.uploadFile('/path/file.gz', new Blob([compressed]));
```

### 4. 进度显示

```html
<progress id="uploadProgress" max="100" value="0"></progress>
<span id="uploadStatus">0%</span>

<script>
// 在 upload_progress 消息处理中
const progress = (msg.received / msg.total * 100);
document.getElementById('uploadProgress').value = progress;
document.getElementById('uploadStatus').textContent = progress.toFixed(2) + '%';
</script>
```

## ⚠️ 注意事项

1. **内存管理**: 大文件下载时,注意浏览器内存限制
2. **超时处理**: 设置合理的超时时间
3. **错误重试**: 网络不稳定时实现重试机制
4. **块大小**: 根据网络情况动态调整
5. **并发限制**: 避免同时传输过多文件

## 🔍 调试技巧

```javascript
// 启用详细日志
const DEBUG = true;

if (DEBUG) {
    ws.addEventListener('message', (event) => {
        if (event.data instanceof Blob) {
            console.log('[BLOB]', event.data.size, 'bytes');
        } else {
            console.log('[JSON]', event.data);
        }
    });
}
```

## 📊 性能监控

```javascript
class PerformanceMonitor {
    constructor() {
        this.startTime = null;
        this.bytesTransferred = 0;
    }

    start() {
        this.startTime = Date.now();
        this.bytesTransferred = 0;
    }

    update(bytes) {
        this.bytesTransferred += bytes;
        const elapsed = (Date.now() - this.startTime) / 1000;
        const speed = this.bytesTransferred / elapsed / 1024 / 1024; // MB/s
        console.log(`传输速度: ${speed.toFixed(2)} MB/s`);
    }
}
```

分块传输机制确保了大文件的可靠传输,并提供了实时的进度反馈!🚀

# SFTP 流式下载实现说明

## 概述
使用 **StreamSaver.js** 实现了真正的流式下载功能,浏览器会在接收到第一个数据块时立即开始下载,而不是等待所有数据传输完成。

## 技术方案

### 1. StreamSaver.js
- **库**: streamsaver@2.0.6
- **原理**: 使用 Service Worker 和 Streams API 实现真正的流式写入
- **优势**: 
  - ✅ 边接收边下载,不占用内存
  - ✅ 支持超大文件下载
  - ✅ 浏览器立即显示下载进度
  - ✅ 不需要等待完整数据

### 2. 实现流程

#### 下载开始 (download_start)
```typescript
const fileStream = streamSaver.createWriteStream(fileName, {
    size: totalSize, // 提供文件大小
});
const streamWriter = fileStream.getWriter();
```
- 立即创建可写流
- 浏览器显示下载对话框
- 用户可以选择保存位置

#### 接收数据块 (binary message)
```typescript
await streamWriter.write(chunk);
```
- 每接收一个块立即写入流
- 数据直接写入磁盘
- 不占用浏览器内存

#### 下载完成 (download_end)
```typescript
await streamWriter.close();
```
- 关闭流
- 完成文件写入

## 后端配置

### CHUNK_SIZE
- **当前设置**: 2MB (2 * 1024 * 1024)
- **说明**: 虽然设置为 2MB,但 russh-sftp 会自动将其拆分成符合 SSH 协议的小包(≤256KB)
- **优势**: 减少应用层循环次数,提高效率

## 兼容性

### StreamSaver 要求
- 需要 HTTPS 或 localhost
- 需要 Service Worker 支持
- 现代浏览器(Chrome 52+, Firefox 52+, Safari 11.1+)

### 降级方案
- 代码仍保留 chunks 数组
- 用于 `getFileBlob()` 功能(PDF 预览等)
- 如果 StreamSaver 失败,可以回退到传统下载

## 用户体验改进

### 之前
1. 等待所有数据接收完成
2. 在内存中组装完整文件
3. 最后触发下载
4. ❌ 大文件可能导致内存溢出
5. ❌ 用户需要等待很久才看到下载开始

### 现在
1. ✅ 接收第一个块时立即显示下载对话框
2. ✅ 边接收边写入磁盘
3. ✅ 不占用浏览器内存
4. ✅ 支持任意大小文件
5. ✅ 实时显示下载进度

## 测试建议

1. **小文件测试** (< 10MB)
   - 验证基本功能
   
2. **大文件测试** (> 100MB)
   - 验证内存占用
   - 验证流式写入
   
3. **超大文件测试** (> 1GB)
   - 验证稳定性
   - 验证进度显示

4. **网络中断测试**
   - 验证错误处理
   - 验证资源清理

## 注意事项

1. **Service Worker**
   - StreamSaver 会自动加载 Service Worker
   - 确保 `mitm.html` 可访问(库自带)

2. **HTTPS**
   - 生产环境必须使用 HTTPS
   - 本地开发 localhost 可以使用

3. **浏览器兼容性**
   - 旧版浏览器可能不支持
   - 建议提示用户升级浏览器

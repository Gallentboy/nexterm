# 静态资源嵌入说明

## 📦 功能说明

本项目已配置为将前端静态资源嵌入到 Rust 二进制文件中,实现**单文件分发**。

## 🏗️ 目录结构

```
sc/
├── frontend/
│   └── dist/              # 前端构建输出(嵌入到二进制)
│       ├── index.html
│       └── assets/
│           ├── app.js
│           └── style.css
├── src/
│   └── main.rs           # 包含静态资源嵌入代码
├── Cargo.toml            # 包含 rust-embed 依赖
└── build.sh              # 构建脚本
```

## 🚀 使用方式

### 开发模式

```bash
# 直接运行(使用示例前端)
cargo run

# 访问
open http://localhost:3000
```

### 生产构建

```bash
# 一键构建
./build.sh

# 或手动构建
cargo build --release

# 运行
./target/release/sc
```

## 🎨 自定义前端

### 方案 A: 使用现有前端框架

#### 1. 创建前端项目

```bash
# 使用 Vite + Vue
cd frontend
npm create vite@latest . -- --template vue

# 或使用 React
npm create vite@latest . -- --template react
```

#### 2. 配置 vite.config.js

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ssh': {
        target: 'ws://localhost:3000',
        ws: true
      },
      '/sftp': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
})
```

#### 3. 开发和构建

```bash
# 开发模式(前端独立运行)
cd frontend
npm run dev
# 访问 http://localhost:5173

# 构建前端
npm run build
# 输出到 frontend/dist/

# 构建完整应用
cd ..
./build.sh
```

### 方案 B: 使用纯 HTML/CSS/JS

直接编辑 `frontend/dist/` 下的文件即可。

## 🔧 工作原理

### 1. 编译时嵌入

```rust
#[derive(RustEmbed)]
#[folder = "frontend/dist"]
struct Assets;
```

- 编译时将 `frontend/dist/` 目录下的所有文件嵌入到二进制中
- 文件内容存储在二进制的 `.rodata` 段
- 支持 gzip 压缩(通过 `compression` feature)

### 2. 运行时服务

```rust
async fn static_handler(uri: Uri) -> Response<Body> {
    // 从嵌入的资源中读取文件
    match Assets::get(path) {
        Some(content) => {
            // 返回文件内容
        }
        None => {
            // SPA 支持: 返回 index.html
        }
    }
}
```

### 3. 路由优先级

```
1. /api/*        → API 路由
2. /ssh          → SSH WebSocket
3. /sftp         → SFTP WebSocket
4. /*            → 静态文件 (fallback)
```

## 📊 优势

| 特性 | 说明 |
|------|------|
| ✅ 单文件分发 | 只需要一个二进制文件 |
| ✅ 无需 Nginx | 后端直接托管前端 |
| ✅ 简化部署 | 复制即用,无需额外配置 |
| ✅ 版本一致 | 前后端版本绑定 |
| ✅ 性能好 | 资源直接从内存读取 |
| ✅ 支持压缩 | 自动 gzip 压缩 |

## ⚠️ 注意事项

### 1. 前端更新

每次修改前端后需要重新编译 Rust:

```bash
# 修改前端
vim frontend/dist/index.html

# 重新编译
cargo build --release
```

### 2. 开发流程

**推荐**: 开发时前后端分离

```bash
# 终端 1: 运行后端
cargo run

# 终端 2: 运行前端开发服务器
cd frontend
npm run dev
```

**生产**: 构建时合并

```bash
cd frontend && npm run build && cd ..
cargo build --release
```

### 3. 文件大小

嵌入静态资源会增加二进制文件大小:
- 纯后端: ~8MB
- 包含前端: ~10-15MB (取决于前端大小)

## 🎯 最佳实践

### 1. 开发环境

```bash
# 使用前端开发服务器(热重载)
cd frontend && npm run dev

# 后端单独运行
cargo run
```

### 2. 生产环境

```bash
# 一键构建
./build.sh

# 部署单个文件
scp target/release/sc user@server:/usr/local/bin/
```

### 3. CI/CD

```yaml
# .github/workflows/build.yml
- name: Build Frontend
  run: cd frontend && npm install && npm run build

- name: Build Backend
  run: cargo build --release

- name: Upload Artifact
  uses: actions/upload-artifact@v3
  with:
    name: sc-binary
    path: target/release/sc
```

## 📝 示例前端

当前 `frontend/dist/` 包含一个简单的示例前端,提供:
- ✅ 用户登录/注册
- ✅ 服务器管理
- ✅ SSH/SFTP 连接入口
- ✅ 响应式设计

你可以基于此进行扩展,或替换为你自己的前端项目。

## 🔗 相关资源

- [rust-embed](https://github.com/pyrossh/rust-embed)
- [Vite](https://vitejs.dev/)
- [Axum](https://github.com/tokio-rs/axum)

---

现在你的应用是一个真正的**单文件全栈应用**!🎉

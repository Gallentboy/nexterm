# 构建和部署指南

## 🚀 快速开始

### 前置要求

- Rust 1.75+ (推荐使用最新稳定版)
- Cargo (随 Rust 安装)

### 安装 Rust

```bash
# Linux/macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Windows
# 下载并运行 https://rustup.rs/
```

## 📦 编译

### 开发模式(快速编译)

```bash
# 克隆项目
git clone <repository-url>
cd sc

# 编译
cargo build

# 运行
cargo run
```

### 发布模式(优化编译)

```bash
# 编译优化版本
cargo build --release

# 运行
./target/release/sc
```

## 🔧 配置

### 环境变量

创建 `.env` 文件:

```bash
# 数据库文件路径
DATABASE_FILE=data/app.db

# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=3000

# 日志级别
RUST_LOG=info
```

### 数据库初始化

首次运行时,程序会自动:
1. 创建数据库文件
2. 运行所有迁移
3. 初始化表结构

## 🐳 Docker 部署

### 创建 Dockerfile

```dockerfile
FROM rust:1.75 as builder

WORKDIR /app
COPY . .

# 编译发布版本
RUN cargo build --release

# 运行时镜像
FROM debian:bookworm-slim

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制二进制文件
COPY --from=builder /app/target/release/sc /app/sc

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 3000

# 运行
CMD ["/app/sc"]
```

### 构建和运行

```bash
# 构建镜像
docker build -t sc:latest .

# 运行容器
docker run -d \
  --name sc \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e DATABASE_FILE=/app/data/app.db \
  sc:latest
```

### Docker Compose

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  sc:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_FILE=/app/data/app.db
      - RUST_LOG=info
    restart: unless-stopped
```

运行:

```bash
docker-compose up -d
```

## 📊 性能优化

### 编译优化

已在 `Cargo.toml` 中配置:

```toml
[profile.release]
opt-level = 3        # 最高优化
lto = true           # 链接时优化
codegen-units = 1    # 单代码单元
strip = true         # 移除符号
```

### 进一步压缩

```bash
# 使用 strip (如果 Cargo.toml 中未配置)
strip target/release/sc

# 使用 UPX 压缩
upx --best --lzma target/release/sc
```

## 🔒 生产环境部署

### 1. 使用 Systemd (Linux)

创建 `/etc/systemd/system/sc.service`:

```ini
[Unit]
Description=SSH/SFTP Management Service
After=network.target

[Service]
Type=simple
User=sc
Group=sc
WorkingDirectory=/opt/sc
Environment="DATABASE_FILE=/opt/sc/data/app.db"
Environment="RUST_LOG=info"
ExecStart=/opt/sc/sc
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务:

```bash
# 创建用户
sudo useradd -r -s /bin/false sc

# 创建目录
sudo mkdir -p /opt/sc/data
sudo chown -R sc:sc /opt/sc

# 复制二进制
sudo cp target/release/sc /opt/sc/

# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable sc
sudo systemctl start sc

# 查看状态
sudo systemctl status sc
```

### 2. 使用 Nginx 反向代理

```nginx
upstream sc_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    # HTTP API
    location /api {
        proxy_pass http://sc_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket (SSH/SFTP)
    location ~ ^/(ssh|sftp)$ {
        proxy_pass http://sc_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

### 3. HTTPS 配置

```bash
# 使用 Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

## 🧪 测试

### 运行测试

```bash
# 所有测试
cargo test

# 特定测试
cargo test user_service

# 显示输出
cargo test -- --nocapture
```

### 性能测试

```bash
# 安装 wrk
# macOS
brew install wrk

# Linux
sudo apt-get install wrk

# 运行测试
wrk -t4 -c100 -d30s http://localhost:3000/api/status
```

## 📝 日志

### 配置日志级别

```bash
# 环境变量
export RUST_LOG=debug

# 或在 .env 文件中
RUST_LOG=debug,sqlx=warn
```

### 日志级别

- `error` - 只显示错误
- `warn` - 警告和错误
- `info` - 信息、警告和错误
- `debug` - 调试信息
- `trace` - 所有信息

### 查看日志

```bash
# Systemd
sudo journalctl -u sc -f

# Docker
docker logs -f sc

# 直接运行
RUST_LOG=info ./target/release/sc
```

## 🔍 监控

### 健康检查

```bash
# 检查服务状态
curl http://localhost:3000/api/status
```

### 性能监控

使用 `htop`, `prometheus`, `grafana` 等工具监控:
- CPU 使用率
- 内存占用
- 网络流量
- 数据库连接数

## 🛠️ 故障排查

### 常见问题

#### 1. 编译失败

```bash
# 清理并重新编译
cargo clean
cargo build --release
```

#### 2. 数据库错误

```bash
# 删除数据库重新初始化
rm data/app.db
cargo run
```

#### 3. 端口被占用

```bash
# 查找占用端口的进程
lsof -i :3000

# 或修改端口
export SERVER_PORT=3001
```

## 📦 打包发布

### Linux

```bash
# 编译
cargo build --release

# 打包
tar -czf sc-linux-x86_64.tar.gz \
  -C target/release sc \
  -C ../../ migrations \
  -C . README.md

# 创建 deb 包 (需要 cargo-deb)
cargo install cargo-deb
cargo deb
```

### macOS

```bash
# 编译
cargo build --release

# 打包
tar -czf sc-macos-x86_64.tar.gz \
  -C target/release sc \
  -C ../../ migrations \
  -C . README.md
```

### Windows

```bash
# 编译
cargo build --release

# 打包
7z a sc-windows-x86_64.zip `
  target/release/sc.exe `
  migrations/ `
  README.md
```

## 🎯 最佳实践

1. **开发环境**: 使用 `cargo run`
2. **测试环境**: 使用 `cargo build --release`
3. **生产环境**: 
   - 使用优化编译
   - 配置 systemd 服务
   - 使用 Nginx 反向代理
   - 启用 HTTPS
   - 配置日志轮转
   - 设置监控告警

## 📚 相关文档

- [RUSTLS_CONFIG.md](RUSTLS_CONFIG.md) - Rustls 配置说明
- [DATABASE_CONFIG.md](DATABASE_CONFIG.md) - 数据库配置
- [USER_API.md](USER_API.md) - 用户 API 文档
- [SERVER_API.md](SERVER_API.md) - 服务器管理 API
- [SFTP_API.md](SFTP_API.md) - SFTP API 文档

## 🆘 获取帮助

遇到问题?
1. 查看文档
2. 检查日志
3. 提交 Issue
4. 联系维护者

祝你部署顺利!🚀

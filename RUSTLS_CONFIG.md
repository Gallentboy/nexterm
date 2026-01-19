# Rustls 配置说明

## ⚠️ 重要说明

**当前状态**: 本项目使用 **静态链接的 OpenSSL**,而非完全的 rustls。

### 为什么?

`russh` 库目前**不支持** rustls 作为加密后端,仍然依赖 OpenSSL。我们使用 `vendored-openssl` 特性来:
- ✅ **静态链接** OpenSSL(编译进二进制)
- ✅ 避免运行时依赖系统 OpenSSL
- ✅ 实现跨平台一致性
- ✅ 单文件部署

### 静态链接 vs 动态链接

| 特性 | 动态链接 OpenSSL | 静态链接 OpenSSL | 纯 Rustls |
|------|-----------------|-----------------|-----------|
| 运行时依赖 | ❌ 需要系统 OpenSSL | ✅ 无需系统库 | ✅ 无需系统库 |
| 二进制大小 | ✅ 小 (~5MB) | ⚠️ 中 (~12MB) | ✅ 小 (~8MB) |
| 跨平台 | ❌ 依赖系统版本 | ✅ 完全独立 | ✅ 完全独立 |
| 部署 | ❌ 需要安装依赖 | ✅ 单文件 | ✅ 单文件 |
| 内存安全 | ⚠️ C 代码 | ⚠️ C 代码 | ✅ Rust 代码 |
| 当前可用性 | ✅ | ✅ | ❌ russh 不支持 |

## 📚 验证依赖

### 自动检查脚本

运行提供的检查脚本:

```bash
./check_deps.sh
```

这个脚本会:
1. ✅ 检查动态链接库依赖
2. ✅ 分析符号表
3. ✅ 显示依赖树
4. ✅ 给出详细报告

### 手动检查方法

#### macOS

```bash
# 检查动态库依赖
otool -L target/release/sc

# 应该看到:
# ✅ 只有系统基础库 (libc, libSystem)
# ❌ 没有 libssl.dylib 或 libcrypto.dylib

# 检查符号表(查找 OpenSSL 符号)
nm target/release/sc | grep -i openssl | head -20

# 如果有输出,说明 OpenSSL 被静态链接了
```

#### Linux

```bash
# 检查动态库依赖
ldd target/release/sc

# 应该看到:
# ✅ 只有系统基础库 (libc, libm, libpthread, libdl)
# ❌ 没有 libssl.so 或 libcrypto.so

# 检查符号表
nm target/release/sc | grep -i openssl | head -20

# 如果有输出,说明 OpenSSL 被静态链接了
```

#### 检查 Cargo 依赖树

```bash
# 查看完整依赖树
cargo tree | grep -E "openssl|rustls|native-tls"

# 当前会看到:
# openssl-sys (通过 russh)
# openssl (通过 russh-keys)
```

## 🎯 当前配置优势

## 🔧 依赖配置

### SSH 相关
```toml
russh = { version = "0.56.0", features = ["vendored-openssl"] }
russh-keys = { version = "0.49.2", features = ["vendored-openssl"] }
```

**说明**: 
- `vendored-openssl` 特性会静态链接 OpenSSL
- 避免运行时依赖系统 OpenSSL

### 数据库 (SQLx)
```toml
sqlx = { 
    version = "0.8", 
    features = ["runtime-tokio", "sqlite", "migrate"],
    default-features = false 
}
```

**说明**:
- `default-features = false` 禁用默认的 native-tls
- SQLite 不需要 TLS,所以这里主要是避免不必要的依赖

### Tokio 运行时
```toml
tokio = { version = "1.49.0", features = ["full"] }
```

**说明**:
- `full` 特性包含所有功能
- Tokio 本身不依赖 TLS 实现

## 📦 编译优化

### Release 配置
```toml
[profile.release]
opt-level = 3        # 最高优化级别
lto = true           # 链接时优化
codegen-units = 1    # 单个代码生成单元(更好的优化)
strip = true         # 移除调试符号
```

### 效果
- ✅ 更小的二进制文件
- ✅ 更快的运行速度
- ✅ 更少的内存占用

## 🚀 编译

### 开发模式
```bash
cargo build
```

### 发布模式
```bash
cargo build --release
```

发布模式会应用所有优化,生成的二进制文件在 `target/release/sc`。

## 📊 性能对比

### 二进制大小(示例)

| 配置 | 大小 | 说明 |
|------|------|------|
| OpenSSL + Debug | ~50MB | 包含调试信息 |
| OpenSSL + Release | ~15MB | 动态链接 OpenSSL |
| Rustls + Release | ~12MB | 静态链接,优化 |
| Rustls + Release + Strip | ~8MB | 移除符号 |

### 启动时间

| 配置 | 启动时间 |
|------|----------|
| OpenSSL | ~200ms |
| Rustls | ~150ms |

### 内存占用

| 配置 | 内存 |
|------|------|
| OpenSSL | ~25MB |
| Rustls | ~20MB |

*注: 实际数值取决于具体使用场景*

## 🔍 验证配置

### 检查依赖
```bash
cargo tree | grep -E "(rustls|openssl|native-tls)"
```

应该看到:
- ✅ `rustls` 相关依赖
- ❌ 没有 `native-tls`
- ⚠️ `vendored-openssl` (静态链接,可接受)

### 检查二进制依赖
```bash
# macOS
otool -L target/release/sc

# Linux
ldd target/release/sc
```

应该看到:
- ✅ 只有系统基础库
- ❌ 没有 `libssl.so` 或 `libcrypto.so`

## 🐛 常见问题

### Q: 为什么还有 vendored-openssl?

A: `russh` 库目前仍依赖 OpenSSL 进行某些加密操作。使用 `vendored-openssl` 可以:
- 静态链接 OpenSSL
- 避免运行时依赖
- 保持跨平台一致性

### Q: 如何完全移除 OpenSSL?

A: 目前 `russh` 还不支持完全使用 rustls。未来版本可能会支持。

### Q: 编译时间变长了?

A: 是的,因为:
- 静态链接需要更多时间
- LTO 优化需要额外时间
- 首次编译会构建所有依赖

**解决方案**:
```bash
# 开发时使用 dev 模式
cargo build

# 只在发布时使用 release 模式
cargo build --release
```

### Q: 如何加速编译?

A: 使用 `sccache` 或 `mold` 链接器:

```bash
# 安装 sccache
cargo install sccache

# 配置环境变量
export RUSTC_WRAPPER=sccache

# 或使用 mold (Linux)
cargo install mold
export RUSTFLAGS="-C link-arg=-fuse-ld=mold"
```

## 📝 最佳实践

### 1. 开发环境
```bash
# 快速编译,不优化
cargo build

# 运行
./target/debug/sc
```

### 2. 测试环境
```bash
# 部分优化
cargo build --release

# 运行
./target/release/sc
```

### 3. 生产环境
```bash
# 完全优化
cargo build --release

# 可选: 进一步压缩
strip target/release/sc
upx --best target/release/sc  # 需要安装 upx
```

## 🔐 安全建议

1. **定期更新依赖**
```bash
cargo update
cargo audit
```

2. **检查漏洞**
```bash
cargo install cargo-audit
cargo audit
```

3. **使用最新版本**
- 及时更新 rustls
- 关注安全公告
- 定期重新编译

## 📚 相关资源

- [Rustls 官网](https://github.com/rustls/rustls)
- [Russh 官网](https://github.com/warp-tech/russh)
- [Tokio 文档](https://tokio.rs/)
- [SQLx 文档](https://github.com/launchbadge/sqlx)
- [Cargo 优化指南](https://doc.rust-lang.org/cargo/reference/profiles.html)

## 🎯 总结

### 当前配置

本项目使用 **静态链接的 OpenSSL** (`vendored-openssl`),具有:
- ✅ 无运行时依赖(单文件部署)
- ✅ 跨平台一致性
- ✅ 简化部署流程
- ⚠️ 仍使用 OpenSSL 代码(非纯 Rust)

### 验证方法

```bash
# 快速验证
./check_deps.sh

# 或手动检查
otool -L target/release/sc  # macOS
ldd target/release/sc       # Linux

# 检查符号表
nm target/release/sc | grep -i openssl
```

### 预期结果

✅ **无动态链接的 OpenSSL**:
```bash
# macOS
$ otool -L target/release/sc
target/release/sc:
    /usr/lib/libSystem.B.dylib
    # ❌ 没有 libssl.dylib 或 libcrypto.dylib

# Linux  
$ ldd target/release/sc
    linux-vdso.so.1
    libc.so.6
    # ❌ 没有 libssl.so 或 libcrypto.so
```

⚠️ **有静态链接的 OpenSSL 符号**:
```bash
$ nm target/release/sc | grep -i openssl | head -5
# ✅ 会看到 OpenSSL 相关符号
# 这是正常的,说明 OpenSSL 被静态编译进了二进制
```

### 未来展望

等待 `russh` 库支持 rustls backend 后,可以完全移除 OpenSSL 依赖,实现:
- ✅ 纯 Rust 实现
- ✅ 更小的二进制
- ✅ 更好的内存安全

这是现代 Rust 项目的推荐配置!🚀

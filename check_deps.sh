#!/bin/bash
# 验证二进制文件依赖的脚本

set -e

echo "🔍 检查二进制依赖..."
echo ""

BINARY="target/release/sc"

if [ ! -f "$BINARY" ]; then
    echo "❌ 未找到二进制文件: $BINARY"
    echo "请先运行: cargo build --release"
    exit 1
fi

echo "✅ 找到二进制文件: $BINARY"
echo ""

# 检查文件大小
SIZE=$(ls -lh "$BINARY" | awk '{print $5}')
echo "📦 文件大小: $SIZE"
echo ""

# 根据操作系统检查依赖
OS=$(uname -s)

if [ "$OS" = "Darwin" ]; then
    echo "🍎 macOS 系统 - 使用 otool 检查依赖"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    otool -L "$BINARY"
    echo ""
    
    # 检查是否包含 OpenSSL
    if otool -L "$BINARY" | grep -i "ssl\|crypto" > /dev/null; then
        echo "⚠️  发现 OpenSSL 动态链接库依赖!"
        echo "这意味着使用的是动态链接的 OpenSSL,而非 rustls"
        otool -L "$BINARY" | grep -i "ssl\|crypto"
    else
        echo "✅ 未发现 OpenSSL 动态库依赖"
        echo "注意: 这不代表完全没有 OpenSSL,可能是静态链接"
    fi
    
elif [ "$OS" = "Linux" ]; then
    echo "🐧 Linux 系统 - 使用 ldd 检查依赖"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    ldd "$BINARY"
    echo ""
    
    # 检查是否包含 OpenSSL
    if ldd "$BINARY" | grep -i "ssl\|crypto" > /dev/null; then
        echo "⚠️  发现 OpenSSL 动态链接库依赖!"
        echo "这意味着使用的是动态链接的 OpenSSL,而非 rustls"
        ldd "$BINARY" | grep -i "ssl\|crypto"
    else
        echo "✅ 未发现 OpenSSL 动态库依赖"
        echo "注意: 这不代表完全没有 OpenSSL,可能是静态链接"
    fi
    
else
    echo "❓ 未知操作系统: $OS"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 检查符号表中的 OpenSSL 符号"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v nm &> /dev/null; then
    # 检查是否有 OpenSSL 相关符号
    if nm "$BINARY" 2>/dev/null | grep -i "openssl\|ssl_\|crypto_" | head -20; then
        echo ""
        echo "⚠️  发现 OpenSSL 相关符号 (静态链接)"
        echo "这意味着 OpenSSL 被静态编译进了二进制文件"
    else
        echo "✅ 未发现明显的 OpenSSL 符号"
    fi
else
    echo "⚠️  nm 命令不可用,跳过符号检查"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 依赖树分析"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "检查 Cargo 依赖树中的 TLS 相关库..."
echo ""

if cargo tree 2>/dev/null | grep -E "rustls|openssl|native-tls" | sort -u; then
    echo ""
else
    echo "未找到明显的 TLS 库依赖"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 总结"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "当前配置说明:"
echo "1. russh 库目前依赖 OpenSSL 进行加密操作"
echo "2. 使用 'vendored-openssl' 特性会静态链接 OpenSSL"
echo "3. 静态链接意味着:"
echo "   ✅ 无需系统安装 OpenSSL"
echo "   ✅ 跨平台兼容性好"
echo "   ✅ 单文件部署"
echo "   ⚠️  但仍然使用 OpenSSL 代码,而非 rustls"
echo ""
echo "要完全使用 rustls,需要等待 russh 库支持 rustls backend"
echo ""

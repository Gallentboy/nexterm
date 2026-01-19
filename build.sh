#!/bin/bash
# 构建脚本 - 将前端和后端打包成单个二进制文件

set -e

echo "🎨 检查前端文件..."
if [ ! -d "fronted/dist" ]; then
    echo "⚠️  fronted/dist 目录不存在"
    echo "📝 当前使用示例前端文件"
    echo "💡 提示: 如果你有完整的前端项目,请先构建:"
    echo "   cd fronted && pnpm install && pnpm build && cd .."
fi

echo ""
echo "🦀 构建 Rust 后端..."
cargo build --release

echo ""
echo "✅ 构建完成!"
echo "📦 二进制文件: target/release/nexterm"
echo ""
echo "🚀 运行方式:"
echo "   ./target/release/nexterm"
echo ""
echo "🌐 访问地址:"
echo "   前端页面: http://localhost:3000"
echo "   API 状态: http://localhost:3000/api/status"
echo "   SSH WebSocket: ws://localhost:3000/ssh"
echo "   SFTP WebSocket: ws://localhost:3000/sftp"

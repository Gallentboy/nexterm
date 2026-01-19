/**
 * WebSocket URL 工具函数
 * 
 * @author zhangyue
 * @date 2026-01-17
 */

/**
 * 根据 REST API 的 baseURL 生成 WebSocket URL
 * 
 * @param path WebSocket 路径，如 '/ssh' 或 '/sftp'
 * @returns 完整的 WebSocket URL
 */
export function getWebSocketUrl(path: string): string {
    // 从环境变量获取 API URL
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    // 如果是相对路径，使用当前页面的协议和主机
    if (apiUrl.startsWith('/')) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}${path}`;
    }

    // 如果是完整 URL，解析并构建 WebSocket URL
    const url = new URL(apiUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}${path}`;
}

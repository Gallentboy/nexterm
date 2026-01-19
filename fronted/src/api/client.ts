import axios, { type AxiosInstance } from 'axios';

import { debug } from '../utils/debug';

/**
 * 创建 axios 实例的工厂函数
 * @param baseURL 基础 URL,默认从环境变量读取
 * @returns 配置好的 axios 实例
 */
export function createApiClient(baseURL?: string): AxiosInstance {
    const client = axios.create({
        baseURL: baseURL || import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
        withCredentials: true, // 重要: 允许发送 Cookie
        headers: {
            'Content-Type': 'application/json',
        },
        // 使用 fetch 适配器
        adapter: 'fetch',
    });

    // 请求拦截器 - 调试
    client.interceptors.request.use(
        (config) => {
            debug.log('[API] 发送请求:', config.method?.toUpperCase(), config.url);
            return config;
        },
        (error) => {
            debug.error('[API] 请求错误:', error);
            return Promise.reject(error);
        }
    );

    // 响应拦截器 - 处理错误
    client.interceptors.response.use(
        (response) => {
            debug.log('[API] 收到响应:', response.config.url, response.status, response.data);
            return response;
        },
        (error) => {
            debug.error('[API] 响应错误:', error.config?.url, error.response?.status, error.response?.data);
            if (error.response?.status === 401) {
                // 未授权,只在非登录/注册页面时跳转
                const currentPath = window.location.pathname;
                if (currentPath !== '/login' && currentPath !== '/register') {
                    debug.log('[API] 401 未授权,跳转到登录页');
                    window.location.href = '/login';
                }
            }
            return Promise.reject(error);
        }
    );

    return client;
}

// 默认导出的 API 客户端实例
const apiClient = createApiClient();

export default apiClient;

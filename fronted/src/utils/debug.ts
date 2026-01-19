// 调试模式开关 - 通过环境变量控制
const DEBUG = import.meta.env.VITE_API_DEBUG === 'true' || import.meta.env.DEV;

// 调试日志辅助函数
export const debug = {
    log: (...args: any[]) => DEBUG && console.log(...args),
    error: (...args: any[]) => DEBUG && console.error(...args),
};

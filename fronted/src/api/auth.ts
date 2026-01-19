import apiClient from './client';

export interface User {
    id: number;
    username: string;
    email?: string | null;
    display_name?: string | null;
    created_at?: string;
    last_login_at?: string;
}

// 后端通用返回格式包装
interface ApiResponse<T> {
    status: string;
    data: T;
    message?: string;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    display_name: string;
}

export interface ChangePasswordRequest {
    old_password: string;
    new_password: string;
}

/**
 * 用户登录
 */
export const login = async (data: LoginRequest): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>('/auth/login', data);
    return response.data.data;
};

/**
 * 用户注册
 */
export const register = async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>('/auth/register', data);
    return response.data.data;
};

/**
 * 用户登出
 */
export const logout = async (): Promise<void> => {
    await apiClient.post('/auth/logout');
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data.data;
};

/**
 * 修改密码
 */
export const changePassword = async (data: ChangePasswordRequest): Promise<void> => {
    await apiClient.post('/auth/change-password', data);
};

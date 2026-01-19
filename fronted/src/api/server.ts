import apiClient from './client';

export interface Server {
    id: number;
    name: string;
    host: string;
    port: number;
    username: string;
    description?: string | null;
    group_id?: number | null;
    group_name?: string | null;
    created_by_username?: string;
    updated_by_username?: string;
    created_at?: string;
    updated_at?: string;
    password?: string | null;
    private_key?: string | null;
}

export interface ServerGroup {
    id: number;
    name: string;
    description?: string | null;
    server_count?: number;
    created_at?: string;
}

export interface CreateServerRequest {
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    private_key?: string;
    description?: string;
    group_id?: number;
}

export interface UpdateServerRequest {
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    private_key?: string;
    description?: string;
    group_id?: number;
}

export interface CreateServerGroupRequest {
    name: string;
    description?: string;
}

export interface UpdateServerGroupRequest {
    name?: string;
    description?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
}

// 后端通用返回格式包装
interface ApiResponse<T> {
    status: string;
    data: T;
    message?: string;
}

/**
 * 获取服务器列表
 */
export const getServers = async (params?: {
    page?: number;
    page_size?: number;
    group_id?: number;
    search?: string;
}): Promise<PaginatedResponse<Server>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Server>>>('/servers', { params });
    return response.data.data;
};

/**
 * 获取服务器详情
 */
export const getServer = async (id: number): Promise<Server> => {
    const response = await apiClient.get<ApiResponse<Server>>(`/servers/${id}`);
    return response.data.data;
};

/**
 * 创建服务器
 */
export const createServer = async (data: CreateServerRequest): Promise<Server> => {
    const response = await apiClient.post<ApiResponse<Server>>('/servers', data);
    return response.data.data;
};

/**
 * 更新服务器
 */
export const updateServer = async (id: number, data: UpdateServerRequest): Promise<Server> => {
    const response = await apiClient.put<ApiResponse<Server>>(`/servers/${id}`, data);
    return response.data.data;
};

/**
 * 删除服务器
 */
export const deleteServer = async (id: number): Promise<void> => {
    await apiClient.delete(`/servers/${id}`);
};

/**
 * 批量删除服务器
 */
export const batchDeleteServers = async (ids: number[]): Promise<void> => {
    await apiClient.post('/servers/batch-delete', { ids });
};

/**
 * 获取服务器分组列表
 */
export const getServerGroups = async (params?: {
    page?: number;
    page_size?: number;
}): Promise<PaginatedResponse<ServerGroup>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<ServerGroup>>>('/server-groups', { params });
    return response.data.data;
};

/**
 * 创建服务器分组
 */
export const createServerGroup = async (data: CreateServerGroupRequest): Promise<ServerGroup> => {
    const response = await apiClient.post<ApiResponse<ServerGroup>>('/server-groups', data);
    return response.data.data;
};

/**
 * 更新服务器分组
 */
export const updateServerGroup = async (id: number, data: UpdateServerGroupRequest): Promise<ServerGroup> => {
    const response = await apiClient.put<ApiResponse<ServerGroup>>(`/server-groups/${id}`, data);
    return response.data.data;
};

/**
 * 删除服务器分组
 */
export const deleteServerGroup = async (id: number): Promise<void> => {
    await apiClient.delete(`/server-groups/${id}`);
};

/**
 * 批量删除服务器分组
 */
export const batchDeleteServerGroups = async (ids: number[]): Promise<void> => {
    await apiClient.post('/server-groups/batch-delete', { ids });
};

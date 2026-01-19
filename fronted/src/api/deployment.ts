import apiClient from './client';

export interface PathSuggestion {
    path: string;
    type: 'file' | 'directory';
    size?: number;
}

export interface PathAutocompleteResponse {
    suggestions: PathSuggestion[];
}

// 执行计划类型
export interface ExecutionPlan {
    id: number;
    name: string;
    description?: string;
    steps: string; // JSON 字符串
    version?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface CreatePlanRequest {
    name: string;
    description?: string;
    steps: any; // 步骤数组,会被序列化为JSON
    version?: string;
}

export interface UpdatePlanRequest {
    name?: string;
    description?: string;
    steps?: any;
    version?: string;
}

// 部署任务类型
export interface DeploymentTask {
    id: number;
    name: string;
    description?: string;
    planId: number;
    planName: string;
    serverGroups: string; // JSON 字符串
    strategy: string;
    status: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
}

export interface CreateTaskRequest {
    name: string;
    description?: string;
    planId: number;
    planName: string;
    serverGroups: any; // 服务器组数组,会被序列化为JSON
    strategy: string;
}

export interface UpdateTaskRequest {
    name?: string;
    description?: string;
    planId?: number;
    planName?: string;
    serverGroups?: any;
    strategy?: string;
    status?: string;
}

/**
 * 获取路径自动补全建议
 */
export const getPathAutocomplete = async (path: string): Promise<PathSuggestion[]> => {
    const response = await apiClient.get<PathAutocompleteResponse>('/deployment/path-autocomplete', {
        params: { path }
    });
    return response.data.suggestions;
};

// ==================== 执行计划 API ====================

/**
 * 获取所有执行计划
 */
export const getPlans = async (): Promise<ExecutionPlan[]> => {
    const response = await apiClient.get('/deployment/plans');
    return response.data.data;
};

/**
 * 获取单个执行计划
 */
export const getPlan = async (id: number): Promise<ExecutionPlan> => {
    const response = await apiClient.get(`/deployment/plans/${id}`);
    return response.data.data;
};

/**
 * 创建执行计划
 */
export const createPlan = async (data: CreatePlanRequest): Promise<ExecutionPlan> => {
    const response = await apiClient.post('/deployment/plans', data);
    return response.data.data;
};

/**
 * 更新执行计划
 */
export const updatePlan = async (id: number, data: UpdatePlanRequest): Promise<void> => {
    await apiClient.put(`/deployment/plans/${id}`, data);
};

/**
 * 删除执行计划
 */
export const deletePlan = async (id: number): Promise<void> => {
    await apiClient.delete(`/deployment/plans/${id}`);
};

// ==================== 部署任务 API ====================

/**
 * 获取所有部署任务
 */
export const getTasks = async (): Promise<DeploymentTask[]> => {
    const response = await apiClient.get('/deployment/tasks');
    return response.data.data;
};

/**
 * 获取单个部署任务
 */
export const getTask = async (id: number): Promise<DeploymentTask> => {
    const response = await apiClient.get(`/deployment/tasks/${id}`);
    return response.data.data;
};

/**
 * 创建部署任务
 */
export const createTask = async (data: CreateTaskRequest): Promise<DeploymentTask> => {
    const response = await apiClient.post('/deployment/tasks', data);
    return response.data.data;
};

/**
 * 更新部署任务
 */
export const updateTask = async (id: number, data: UpdateTaskRequest): Promise<void> => {
    await apiClient.put(`/deployment/tasks/${id}`, data);
};

/**
 * 删除部署任务
 */
export const deleteTask = async (id: number): Promise<void> => {
    await apiClient.delete(`/deployment/tasks/${id}`);
};

// ==================== 执行历史 API ====================

export interface ExecutionHistory {
    id: number;
    taskId: number;
    taskName: string;
    planId: number;
    planName: string;
    status: string;
    totalSteps: number;
    progress: number;
    startTime: string;
    endTime?: string;
    duration?: number;
    serverGroups: string;
    createdAt: string;
}

export interface ExecutionLog {
    id: number;
    historyId: number;
    timestamp: string;
    level: string;
    message: string;
    serverId?: number;
    serverName?: string;
    stepId?: string;
    stepName?: string;
}

export interface ExecutionHistoryDetail {
    id: number;
    taskId: number;
    taskName: string;
    planId: number;
    planName: string;
    status: string;
    totalSteps: number;
    progress: number;
    startTime: string;
    endTime?: string;
    duration?: number;
    serverGroups: string;
    createdAt: string;
    logs: ExecutionLog[];
}

export interface CreateHistoryRequest {
    taskId: number;
    taskName: string;
    planId: number;
    planName: string;
    status: string;
    totalSteps: number;
    progress: number;
    startTime: string;
    endTime?: string;
    duration?: number;
    serverGroups: any;
    logs: Array<{
        timestamp: string;
        level: string;
        message: string;
        serverId?: number;
        serverName?: string;
        stepId?: string;
        stepName?: string;
    }>;
}

/**
 * 创建执行历史
 */
export const createHistory = async (data: CreateHistoryRequest): Promise<ExecutionHistoryDetail> => {
    const response = await apiClient.post('/deployment/history', data);
    return response.data.data;
};

/**
 * 获取所有执行历史
 */
export const getAllHistory = async (): Promise<ExecutionHistory[]> => {
    const response = await apiClient.get('/deployment/history');
    return response.data.data;
};

/**
 * 获取单个执行历史(包含日志)
 */
export const getHistory = async (id: number): Promise<ExecutionHistoryDetail> => {
    const response = await apiClient.get(`/deployment/history/${id}`);
    return response.data.data;
};

/**
 * 删除执行历史
 */
export const deleteHistory = async (id: number): Promise<void> => {
    await apiClient.delete(`/deployment/history/${id}`);
};

/**
 * 清空所有执行历史
 */
export const clearAllHistory = async (): Promise<void> => {
    await apiClient.delete('/deployment/history');
};

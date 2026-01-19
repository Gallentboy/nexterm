/**
 * 部署相关类型定义
 * @author zhangyue
 * @date 2026-01-17
 */

// 步骤类型
export type StepType = 'FILE_UPLOAD' | 'COMMAND_EXECUTION';

// 执行策略
export type ExecutionStrategy = 'SEQUENTIAL' | 'PARALLEL';

// 任务状态
export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';

// 步骤状态
export type StepStatus = 'WAITING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

// 基础步骤接口
export interface BaseStep {
    id: string;
    order: number;
    type: StepType;
    name: string;
    retryCount?: number;
    timeoutSeconds?: number;
    continueOnError?: boolean;
}

// 文件上传步骤
export interface FileUploadStep extends BaseStep {
    type: 'FILE_UPLOAD';
    sourcePath: string;      // 后端服务器上的源路径(文件或目录)
    targetPath: string;      // 目标服务器路径
    overwrite?: boolean;     // 是否覆盖已存在文件
    permissions?: string;    // 文件权限,如 '755'
}

// 命令执行步骤
export interface CommandExecutionStep extends BaseStep {
    type: 'COMMAND_EXECUTION';
    commands: string[];
    workingDirectory?: string;
    environment?: Record<string, string>;
    runAs?: string;
    expectExitCode?: number;
}

// 步骤联合类型
export type Step = FileUploadStep | CommandExecutionStep;

// 执行计划
export interface ExecutionPlan {
    id: number;
    name: string;
    description?: string;
    steps: Step[];
    version?: string;
    createdAt?: string;
    updatedAt?: string;
}

// 服务器组引用
export interface ServerGroupRef {
    id: number;
    name: string;
    serverCount: number;
}

// 部署任务
export interface DeploymentTask {
    id: number;
    name: string;
    description?: string;
    planId: number;
    planName: string;
    serverGroups: ServerGroupRef[];
    strategy: ExecutionStrategy;
    status: TaskStatus;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
}

// 执行记录
export interface ExecutionRecord {
    id: string;
    taskId: string;
    taskName: string;
    planName: string;
    serverCount: number;
    successCount: number;
    failedCount: number;
    status: TaskStatus;
    startTime: string;
    endTime?: string;
    duration?: number;
    logs?: ExecutionLog[];
}

// 执行日志
export interface ExecutionLog {
    timestamp: string;
    serverId: number;
    serverName: string;
    stepId: string;
    stepName: string;
    status: StepStatus;
    message: string;
    output?: string;
}

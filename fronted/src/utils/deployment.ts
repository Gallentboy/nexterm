import type { ExecutionPlan as ApiExecutionPlan, DeploymentTask as ApiDeploymentTask } from '@/api/deployment';
import type { ExecutionPlan, DeploymentTask, ExecutionStrategy, TaskStatus } from '@/types/deployment';

/**
 * 将 API 返回的执行计划转换为前端类型
 */
export function parseExecutionPlan(apiPlan: ApiExecutionPlan): ExecutionPlan {
    return {
        ...apiPlan,
        steps: JSON.parse(apiPlan.steps),
        createdAt: apiPlan.createdAt,
        updatedAt: apiPlan.updatedAt,
    };
}

/**
 * 将前端执行计划转换为 API 请求格式
 */
export function serializeExecutionPlan(plan: ExecutionPlan) {
    return {
        name: plan.name,
        description: plan.description,
        steps: plan.steps, // API 会自动序列化
        version: plan.version,
    };
}

/**
 * 将 API 返回的部署任务转换为前端类型
 */
export function parseDeploymentTask(apiTask: ApiDeploymentTask): DeploymentTask {
    return {
        ...apiTask,
        serverGroups: JSON.parse(apiTask.serverGroups),
        strategy: apiTask.strategy as ExecutionStrategy,
        status: apiTask.status as TaskStatus,
    };
}

/**
 * 将前端部署任务转换为 API 请求格式
 */
export function serializeDeploymentTask(task: Partial<DeploymentTask>) {
    if (!task.name || !task.planId || !task.planName || !task.serverGroups || !task.strategy) {
        throw new Error('缺少必填字段');
    }

    return {
        name: task.name,
        description: task.description,
        planId: task.planId,
        planName: task.planName,
        serverGroups: task.serverGroups, // API 会自动序列化
        strategy: task.strategy,
    };
}

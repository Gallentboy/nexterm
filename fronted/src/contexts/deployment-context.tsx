import { debug } from '@/utils/debug';
import { createContext, useContext, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import type {
    DeploymentTask,
    ExecutionPlan,
    TaskStatus
} from '@/types/deployment';
import { DeploymentExecutor } from '@/utils/deployment-executor';
import * as deploymentApi from '@/api/deployment';

interface DeploymentContextType {
    // 执行中的任务
    runningTasks: Map<number, TaskExecution>;

    // 执行任务
    executeTask: (task: DeploymentTask, plan: ExecutionPlan) => Promise<void>;

    // 取消任务
    cancelTask: (taskId: number) => void;

    // 获取任务执行状态
    getTaskExecution: (taskId: number) => TaskExecution | undefined;

    // 检查任务是否正在运行
    isTaskRunning: (taskId: number) => boolean;

    // 获取执行历史
    getExecutionHistory: () => Promise<TaskExecution[]>;

    // 清除执行历史
    clearExecutionHistory: () => Promise<void>;
}

export interface TaskExecution {
    id?: number;
    taskId: number;
    taskName: string;
    planId?: number;
    planName?: string;
    status: TaskStatus;
    currentServer?: string;
    currentStep?: number;
    totalSteps: number;
    logs: ExecutionLog[];
    startTime: string;
    endTime?: string;
    progress: number; // 0-100
    serverGroups?: any;
}

export interface ExecutionLog {
    timestamp: string;
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    serverId?: number;
    serverName?: string;
    stepId?: string;
    stepName?: string;
}

const DeploymentContext = createContext<DeploymentContextType | undefined>(undefined);

export function DeploymentProvider({ children }: { children: ReactNode }) {
    const [runningTasks, setRunningTasks] = useState<Map<number, TaskExecution>>(new Map());
    // 使用 ref 跟踪已取消的任务
    const cancelledTasksRef = useRef<Set<number>>(new Set());
    // 使用ref跟踪当前任务的logs,避免闭包问题
    const currentTaskLogsRef = useRef<Map<number, ExecutionLog[]>>(new Map());

    // 保存执行历史到数据库
    const saveToHistory = async (execution: TaskExecution, task: DeploymentTask, plan: ExecutionPlan) => {
        try {
            debug.log('[DeploymentContext] 开始保存执行历史:', {
                taskId: task.id,
                taskName: task.name,
                logsCount: execution.logs.length
            });

            const startTime = new Date(execution.startTime);
            const endTime = execution.endTime ? new Date(execution.endTime) : new Date();
            const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

            const result = await deploymentApi.createHistory({
                taskId: task.id,
                taskName: task.name,
                planId: plan.id,
                planName: plan.name,
                status: execution.status,
                totalSteps: execution.totalSteps,
                progress: execution.progress,
                startTime: execution.startTime,
                endTime: execution.endTime,
                duration,
                serverGroups: task.serverGroups,
                logs: execution.logs.map(log => ({
                    timestamp: log.timestamp,
                    level: log.level,
                    message: log.message,
                    serverId: log.serverId,
                    serverName: log.serverName,
                    stepId: log.stepId,
                    stepName: log.stepName,
                })),
            });

            debug.log('[DeploymentContext] 执行历史保存成功:', result);
        } catch (error) {
            debug.error('[DeploymentContext] 保存执行历史失败:', error);
        }
    };

    const addLog = (taskId: number, log: ExecutionLog) => {
        // 同步更新ref
        const currentLogs = currentTaskLogsRef.current.get(taskId) || [];
        currentLogs.push(log);
        currentTaskLogsRef.current.set(taskId, currentLogs);

        // 更新state
        setRunningTasks((prev) => {
            const updated = new Map(prev);
            const execution = updated.get(taskId);
            if (execution) {
                updated.set(taskId, {
                    ...execution,
                    logs: [...execution.logs, log]
                });
            }
            return updated;
        });
    };

    const updateTaskExecution = (taskId: number, updates: Partial<TaskExecution>) => {
        setRunningTasks((prev) => {
            const updated = new Map(prev);
            const execution = updated.get(taskId);
            if (execution) {
                updated.set(taskId, { ...execution, ...updates });
            }
            return updated;
        });
    };

    const executeTask = async (task: DeploymentTask, plan: ExecutionPlan) => {
        const execution: TaskExecution = {
            taskId: task.id,
            taskName: task.name,
            status: 'RUNNING',
            totalSteps: plan.steps.length * task.serverGroups.reduce((sum, g) => sum + g.serverCount, 0),
            logs: [],
            startTime: new Date().toISOString(),
            progress: 0,
        };

        setRunningTasks((prev) => new Map(prev).set(task.id, execution));
        // 初始化logs ref
        currentTaskLogsRef.current.set(task.id, []);
        // 确保任务不在取消列表中
        cancelledTasksRef.current.delete(task.id);

        addLog(task.id, {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `开始执行部署任务: ${task.name}`,
        });

        try {
            addLog(task.id, {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: `执行策略: ${task.strategy}`,
            });

            addLog(task.id, {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: `目标服务器组: ${task.serverGroups.map(g => g.name).join(', ')}`,
            });

            // 使用真实的执行引擎
            const executor = new DeploymentExecutor(
                task,
                plan,
                (log) => addLog(task.id, log),
                (progress) => updateTaskExecution(task.id, { progress }),
                () => cancelledTasksRef.current.has(task.id) // 检查是否在取消列表中
            );

            await executor.execute();

            const endTime = new Date().toISOString();
            updateTaskExecution(task.id, {
                status: 'COMPLETED',
                endTime,
                progress: 100,
            });

            addLog(task.id, {
                timestamp: endTime,
                level: 'success',
                message: '部署任务执行完成',
            });

            // 保存到历史记录 - 使用ref中的最新logs
            const finalLogs = currentTaskLogsRef.current.get(task.id) || [];
            const finalExecution: TaskExecution = {
                taskId: task.id,
                taskName: task.name,
                planId: plan.id,
                planName: plan.name,
                status: 'COMPLETED',
                totalSteps: execution.totalSteps,
                progress: 100,
                startTime: execution.startTime,
                endTime,
                logs: finalLogs,
                serverGroups: task.serverGroups,
            };

            debug.log('[DeploymentContext] 准备保存执行历史, logs数量:', finalLogs.length);
            await saveToHistory(finalExecution, task, plan);

            // 清理ref
            currentTaskLogsRef.current.delete(task.id);
        } catch (error) {
            const endTime = new Date().toISOString();
            updateTaskExecution(task.id, {
                status: 'FAILED',
                endTime,
            });

            addLog(task.id, {
                timestamp: endTime,
                level: 'error',
                message: `部署任务执行失败: ${error}`,
            });

            // 保存到历史记录 - 使用ref中的最新logs
            const finalLogs = currentTaskLogsRef.current.get(task.id) || [];
            const finalExecution: TaskExecution = {
                taskId: task.id,
                taskName: task.name,
                planId: plan.id,
                planName: plan.name,
                status: 'FAILED',
                totalSteps: execution.totalSteps,
                progress: execution.progress,
                startTime: execution.startTime,
                endTime,
                logs: finalLogs,
                serverGroups: task.serverGroups,
            };

            debug.log('[DeploymentContext] 准备保存执行历史(失败), logs数量:', finalLogs.length);
            await saveToHistory(finalExecution, task, plan);

            // 清理ref
            currentTaskLogsRef.current.delete(task.id);
        }
    };

    const cancelTask = (taskId: number) => {
        // 添加到取消列表
        cancelledTasksRef.current.add(taskId);

        setRunningTasks((prev) => {
            const updated = new Map(prev);
            const execution = updated.get(taskId);
            if (execution && execution.status === 'RUNNING') {
                updated.set(taskId, {
                    ...execution,
                    status: 'FAILED',
                    endTime: new Date().toISOString(),
                });
            }
            return updated;
        });

        addLog(taskId, {
            timestamp: new Date().toISOString(),
            level: 'warning',
            message: '任务已被用户中断取消',
        });
    };

    const getTaskExecution = (taskId: number) => {
        return runningTasks.get(taskId);
    };

    const isTaskRunning = (taskId: number) => {
        return runningTasks.get(taskId)?.status === 'RUNNING';
    };

    const getExecutionHistory = async (): Promise<TaskExecution[]> => {
        try {
            const history = await deploymentApi.getAllHistory();
            return history.map(h => ({
                id: h.id,
                taskId: h.taskId,
                taskName: h.taskName,
                planId: h.planId,
                planName: h.planName,
                status: h.status as TaskStatus,
                totalSteps: h.totalSteps,
                progress: h.progress,
                startTime: h.startTime,
                endTime: h.endTime,
                logs: [],
                serverGroups: JSON.parse(h.serverGroups),
            }));
        } catch (error) {
            debug.error('[DeploymentContext] 获取执行历史失败:', error);
            return [];
        }
    };

    const clearExecutionHistory = async () => {
        try {
            await deploymentApi.clearAllHistory();
        } catch (error) {
            debug.error('[DeploymentContext] 清除执行历史失败:', error);
        }
    };

    return (
        <DeploymentContext.Provider
            value={{
                runningTasks,
                executeTask,
                cancelTask,
                getTaskExecution,
                isTaskRunning,
                getExecutionHistory,
                clearExecutionHistory,
            }}
        >
            {children}
        </DeploymentContext.Provider>
    );
}


export function useDeployment() {
    const context = useContext(DeploymentContext);
    if (!context) {
        throw new Error('useDeployment must be used within DeploymentProvider');
    }
    return context;
}

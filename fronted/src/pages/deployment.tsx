import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Rocket,
    Plus,
    PlayCircle,
    FileText,
    History,
    Settings,
    Upload,
    Terminal,
    Edit,
    Trash2,
    TrendingUp,
    Clock,
} from 'lucide-react';
import PlanEditor from '@/components/deployment/plan-editor';
import TaskWizard from '@/components/deployment/task-wizard';
import TaskExecutionMonitor from '@/components/deployment/task-execution-monitor';
import ExecutionHistoryList from '@/components/deployment/execution-history-list';
import type { ExecutionPlan, DeploymentTask } from '@/types/deployment';
import { toast } from 'sonner';
import { debug } from '@/utils/debug';
import { useDeployment } from '@/contexts/deployment-context';
import * as deploymentApi from '@/api/deployment';
import { parseExecutionPlan, parseDeploymentTask, serializeExecutionPlan, serializeDeploymentTask } from '@/utils/deployment';

export default function DeploymentPage() {
    const { t } = useTranslation();
    const { executeTask, getExecutionHistory, clearExecutionHistory } = useDeployment();
    const [activeTab, setActiveTab] = useState<'tasks' | 'plans' | 'history'>('tasks');

    // 执行计划
    const [plans, setPlans] = useState<ExecutionPlan[]>([]);
    const [planEditorOpen, setPlanEditorOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<ExecutionPlan | undefined>();

    // 部署任务
    const [tasks, setTasks] = useState<DeploymentTask[]>([]);
    const [taskWizardOpen, setTaskWizardOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<DeploymentTask | undefined>();

    // 任务执行监控
    const [executionMonitorOpen, setExecutionMonitorOpen] = useState(false);
    const [executingTaskId, setExecutingTaskId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // 执行历史
    const [history, setHistory] = useState<any[]>([]);

    // 加载数据
    useEffect(() => {
        loadData();
    }, []);

    // 切换到历史标签页时刷新历史
    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab]);

    // 计算全局统计信息
    const stats = useMemo(() => {
        const result = {
            successRate: '--',
            lastExecution: '--',
            runningCount: 0
        };

        // 成功率 (最近30天)
        if (history && history.length > 0) {
            const last30Days = new Date();
            last30Days.setDate(last30Days.getDate() - 30);

            const recentHistory = history.filter(h => new Date(h.startTime) >= last30Days);
            if (recentHistory.length > 0) {
                const completedCount = recentHistory.filter(h => h.status === 'COMPLETED').length;
                result.successRate = `${Math.round((completedCount / recentHistory.length) * 100)}%`;
            }

            // 最近执行
            const latest = [...history].sort((a, b) =>
                new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
            )[0];

            if (latest) {
                const date = new Date(latest.startTime);
                const now = new Date();
                const diff = now.getTime() - date.getTime();
                const minutes = Math.floor(diff / (1000 * 60));
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));

                if (days > 0) result.lastExecution = t('deployment.stats.daysAgo', { count: days });
                else if (hours > 0) result.lastExecution = t('deployment.stats.hoursAgo', { count: hours });
                else if (minutes > 0) result.lastExecution = t('deployment.stats.minutesAgo', { count: minutes });
                else result.lastExecution = t('deployment.stats.justNow');
            }
        }

        return result;
    }, [history, t]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [plansData, tasksData, historyData] = await Promise.all([
                deploymentApi.getPlans(),
                deploymentApi.getTasks(),
                getExecutionHistory(),
            ]);
            setPlans(plansData.map(parseExecutionPlan));
            setTasks(tasksData.map(parseDeploymentTask));
            setHistory(historyData);
        } catch (error) {
            debug.error('[AuthContext] 加载数据失败:', error);
            toast.error('加载数据失败');
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async () => {
        try {
            debug.log('[AuthContext] 正在加载执行历史...');
            const historyData = await getExecutionHistory();
            debug.log('[AuthContext] 执行历史加载成功, 数量:', historyData.length);
            setHistory(historyData);
        } catch (error) {
            debug.error('[AuthContext] 加载历史失败:', error);
        }
    };

    const handleCreatePlan = () => {
        setEditingPlan(undefined);
        setPlanEditorOpen(true);
    };

    const handleEditPlan = (plan: ExecutionPlan) => {
        setEditingPlan(plan);
        setPlanEditorOpen(true);
    };

    const handleSavePlan = async (plan: ExecutionPlan) => {
        try {
            if (editingPlan) {
                await deploymentApi.updatePlan(plan.id, serializeExecutionPlan(plan));
                setPlans(plans.map((p) => (p.id === plan.id ? plan : p)));
                toast.success('执行计划已更新');
            } else {
                const created = await deploymentApi.createPlan(serializeExecutionPlan(plan));
                setPlans([...plans, parseExecutionPlan(created)]);
                toast.success('执行计划已创建');
            }
        } catch (error) {
            debug.error('[AuthContext] 保存执行计划失败:', error);
            toast.error('保存失败');
        }
    };

    const handleDeletePlan = async (planId: number) => {
        try {
            await deploymentApi.deletePlan(planId);
            setPlans(plans.filter((p) => p.id !== planId));
            toast.success('执行计划已删除');
        } catch (error: any) {
            // 如果计划不存在(404),也从本地状态删除
            if (error?.response?.status === 404) {
                setPlans(plans.filter((p) => p.id !== planId));
                toast.success('执行计划已删除');
            } else {
                debug.error('[AuthContext] 删除执行计划失败:', error);
                toast.error('删除失败');
            }
        }
    };

    const handleCreateTask = () => {
        setEditingTask(undefined);
        setTaskWizardOpen(true);
    };

    const handleEditTask = (task: DeploymentTask) => {
        setEditingTask(task);
        setTaskWizardOpen(true);
    };

    const handleSaveTask = async (task: DeploymentTask) => {
        try {
            if (editingTask) {
                await deploymentApi.updateTask(task.id, serializeDeploymentTask(task));
                setTasks(tasks.map((t) => (t.id === task.id ? task : t)));
                toast.success('部署任务已更新');
            } else {
                const created = await deploymentApi.createTask(serializeDeploymentTask(task));
                setTasks([...tasks, parseDeploymentTask(created)]);
                toast.success('部署任务已创建');
            }
        } catch (error) {
            debug.error('[AuthContext] 保存部署任务失败:', error);
            toast.error('保存失败');
        }
    };

    const handleDeleteTask = async (taskId: number) => {
        try {
            await deploymentApi.deleteTask(taskId);
            setTasks(tasks.filter((t) => t.id !== taskId));
            toast.success('部署任务已删除');
        } catch (error: any) {
            // 如果任务不存在(404),也从本地状态删除
            if (error?.response?.status === 404) {
                setTasks(tasks.filter((t) => t.id !== taskId));
                toast.success('部署任务已删除');
            } else {
                debug.error('[AuthContext] 删除部署任务失败:', error);
                toast.error('删除失败');
            }
        }
    };

    const handleExecuteTask = async (task: DeploymentTask) => {
        const plan = plans.find((p) => p.id === task.planId);
        if (!plan) {
            toast.error('找不到对应的执行计划');
            return;
        }

        setExecutingTaskId(task.id);
        setExecutionMonitorOpen(true);

        try {
            await executeTask(task, plan);
            // 执行完成后刷新历史记录
            await loadHistory();
        } catch (error) {
            toast.error(`执行失败: ${error}`);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Rocket className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('deployment.title')}</h1>
                        <p className="text-muted-foreground mt-1">
                            {t('deployment.subtitle')}
                        </p>
                    </div>
                </div>
                <Button size="lg" className="gap-2" onClick={handleCreateTask}>
                    <Plus className="h-5 w-5" />
                    {t('deployment.createTask')}
                </Button>
            </div>

            {/* 快速统计卡片 */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t('deployment.stats.totalTasks')}
                        </CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tasks.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {t('deployment.stats.tasksDescription', { count: 0 })}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t('deployment.stats.totalPlans')}
                        </CardTitle>
                        <Settings className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{plans.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {t('deployment.stats.reusablePlans')}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t('deployment.stats.successRate')}
                        </CardTitle>
                        <PlayCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.successRate}</div>
                        <p className="text-xs text-muted-foreground">
                            {t('deployment.stats.last30Days')}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t('deployment.stats.lastExecution')}
                        </CardTitle>
                        <History className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.lastExecution}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.lastExecution === '--' ? t('deployment.stats.neverExecuted') : t('deployment.stats.sinceLastExecution')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* 标签页切换 */}
            <div className="flex gap-2 border-b">
                <Button
                    variant={activeTab === 'tasks' ? 'default' : 'ghost'}
                    onClick={() => setActiveTab('tasks')}
                    className="gap-2"
                >
                    <FileText className="h-4 w-4" />
                    {t('deployment.tabs.tasks')}
                </Button>
                <Button
                    variant={activeTab === 'plans' ? 'default' : 'ghost'}
                    onClick={() => setActiveTab('plans')}
                    className="gap-2"
                >
                    <Settings className="h-4 w-4" />
                    {t('deployment.tabs.plans')}
                </Button>
                <Button
                    variant={activeTab === 'history' ? 'default' : 'ghost'}
                    onClick={() => setActiveTab('history')}
                    className="gap-2"
                >
                    <History className="h-4 w-4" />
                    {t('deployment.tabs.history')}
                </Button>
            </div>

            {/* 内容区域 */}
            <div className="space-y-4">
                {activeTab === 'tasks' && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>{t('deployment.tasks.title')}</CardTitle>
                                    <CardDescription>
                                        {t('deployment.tasks.description')}
                                    </CardDescription>
                                </div>
                                <Button className="gap-2" onClick={handleCreateTask}>
                                    <Plus className="h-4 w-4" />
                                    {t('deployment.createTask')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center items-center py-20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : tasks.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Rocket className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                    <p className="text-lg font-medium mb-2">
                                        {t('deployment.tasks.empty')}
                                    </p>
                                    <p className="text-sm mb-4">
                                        {t('deployment.tasks.emptyHint')}
                                    </p>
                                    <Button variant="outline" className="gap-2" onClick={handleCreateTask}>
                                        <Plus className="h-4 w-4" />
                                        {t('deployment.createTask')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {tasks.map((task) => (
                                        <Card key={task.id} className="border-2">
                                            <CardHeader>
                                                <div className="flex items-start justify-between">
                                                    <div className="space-y-1 flex-1">
                                                        <CardTitle className="text-lg">
                                                            {task.name}
                                                        </CardTitle>
                                                        {task.description && (
                                                            <CardDescription>
                                                                {task.description}
                                                            </CardDescription>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-2"
                                                            onClick={() => handleExecuteTask(task)}
                                                        >
                                                            <PlayCircle className="h-4 w-4" />
                                                            {t('common.execute')}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-2"
                                                            onClick={() => handleEditTask(task)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                            {t('common.edit')}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteTask(task.id)}
                                                            className="text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-2 text-sm">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Settings className="h-4 w-4" />
                                                    <span>{t('deployment.plans.planName')}: {task.planName}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <FileText className="h-4 w-4" />
                                                    <span>
                                                        {t('deployment.wizard.selectServersHint')}: {task.serverGroups.length} {t('nav.groups')},
                                                        {t('common.total', { count: task.serverGroups.reduce((sum, g) => sum + g.serverCount, 0) })}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 pt-4 mt-2 border-t border-dashed">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                                                            <TrendingUp className="h-3.5 w-3.5" />
                                                            <span>{t('deployment.stats.successRate')}</span>
                                                        </div>
                                                        <div className="font-semibold text-sm">
                                                            {(() => {
                                                                // 增强匹配逻辑，同时尝试 taskId 和 task_id
                                                                const taskHistory = history.filter(h =>
                                                                    (h.taskId !== undefined && Number(h.taskId) === Number(task.id)) ||
                                                                    (h.task_id !== undefined && Number(h.task_id) === Number(task.id))
                                                                );

                                                                if (taskHistory.length === 0) return <span className="text-muted-foreground font-normal">-</span>;
                                                                const successCount = taskHistory.filter(h => h.status === 'COMPLETED').length;
                                                                const rate = Math.round((successCount / taskHistory.length) * 100);
                                                                return (
                                                                    <span className={rate >= 80 ? "text-green-500" : rate >= 50 ? "text-yellow-500" : "text-red-500"}>
                                                                        {rate}%
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            <span>{t('deployment.stats.lastExecution')}</span>
                                                        </div>
                                                        <div className="font-semibold text-sm truncate">
                                                            {(() => {
                                                                // 增强匹配逻辑
                                                                const taskHistory = history
                                                                    .filter(h =>
                                                                        (h.taskId !== undefined && Number(h.taskId) === Number(task.id)) ||
                                                                        (h.task_id !== undefined && Number(h.task_id) === Number(task.id))
                                                                    )
                                                                    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

                                                                if (taskHistory.length === 0) return <span className="text-muted-foreground font-normal">{t('deployment.stats.never')}</span>;

                                                                const latest = taskHistory[0];
                                                                const date = new Date(latest.startTime);
                                                                const now = new Date();
                                                                const diff = now.getTime() - date.getTime();
                                                                const minutes = Math.floor(diff / (1000 * 60));
                                                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));

                                                                if (days > 0) return t('deployment.stats.daysAgo', { count: days });
                                                                if (hours > 0) return t('deployment.stats.hoursAgo', { count: hours });
                                                                if (minutes > 0) return t('deployment.stats.minutesAgo', { count: minutes });
                                                                return <span className="text-primary font-medium">{t('deployment.stats.justNow')}</span>;
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'plans' && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>{t('deployment.plans.title')}</CardTitle>
                                    <CardDescription>
                                        {t('deployment.plans.description')}
                                    </CardDescription>
                                </div>
                                <Button className="gap-2" onClick={handleCreatePlan}>
                                    <Plus className="h-4 w-4" />
                                    {t('deployment.plans.create')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center items-center py-20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : plans.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Settings className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                    <p className="text-lg font-medium mb-2">
                                        {t('deployment.plans.empty')}
                                    </p>
                                    <p className="text-sm mb-4">
                                        {t('deployment.plans.emptyHint')}
                                    </p>
                                    <Button variant="outline" className="gap-2" onClick={handleCreatePlan}>
                                        <Plus className="h-4 w-4" />
                                        {t('deployment.plans.create')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {plans.map((plan) => (
                                        <Card key={plan.id} className="border-2 hover:border-primary/50 transition-colors">
                                            <CardHeader>
                                                <div className="flex items-start justify-between">
                                                    <div className="space-y-1 flex-1">
                                                        <CardTitle className="text-lg">
                                                            {plan.name}
                                                        </CardTitle>
                                                        {plan.description && (
                                                            <CardDescription>
                                                                {plan.description}
                                                            </CardDescription>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-2"
                                                            onClick={() => handleEditPlan(plan)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                            编辑
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-2"
                                                            onClick={handleCreateTask}
                                                        >
                                                            <PlayCircle className="h-4 w-4" />
                                                            执行
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeletePlan(plan.id)}
                                                            className="text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Settings className="h-4 w-4" />
                                                        <span>{t('deployment.plans.totalSteps', { count: plan.steps.length })}</span>
                                                    </div>
                                                    {plan.steps.slice(0, 3).map((step, index) => (
                                                        <div key={step.id} className="flex items-center gap-2 text-muted-foreground pl-6">
                                                            {step.type === 'FILE_UPLOAD' ? (
                                                                <Upload className="h-4 w-4 text-blue-500" />
                                                            ) : (
                                                                <Terminal className="h-4 w-4 text-green-500" />
                                                            )}
                                                            <span>
                                                                {t('deployment.plans.stepWithIndex', { index: index + 1, name: step.name })}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {plan.steps.length > 3 && (
                                                        <div className="text-muted-foreground pl-6 text-xs">
                                                            {t('deployment.plans.moreSteps', { count: plan.steps.length - 3 })}
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'history' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('deployment.history.title')}</CardTitle>
                            <CardDescription>
                                {t('deployment.history.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ExecutionHistoryList
                                history={history}
                                onClear={async () => {
                                    await clearExecutionHistory();
                                    await loadHistory();
                                    toast.success('执行历史已清空');
                                }}
                            />
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* 执行计划编辑器 */}
            <PlanEditor
                open={planEditorOpen}
                onOpenChange={setPlanEditorOpen}
                plan={editingPlan}
                onSave={handleSavePlan}
            />

            {/* 任务创建向导 */}
            <TaskWizard
                open={taskWizardOpen}
                onOpenChange={setTaskWizardOpen}
                plans={plans}
                task={editingTask}
                onSave={handleSaveTask}
            />

            {/* 任务执行监控 */}
            <TaskExecutionMonitor
                open={executionMonitorOpen}
                onOpenChange={setExecutionMonitorOpen}
                taskId={executingTaskId}
            />
        </div>
    );
}

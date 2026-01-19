import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    PlayCircle,
    CheckCircle,
    XCircle,
    Clock,
    Server,
    Terminal,
    AlertCircle,
    StopCircle,
    ArrowLeft,
} from 'lucide-react';
import type { TaskExecution, ExecutionLog } from '@/contexts/deployment-context';
import { useDeployment } from '@/contexts/deployment-context';

interface TaskExecutionMonitorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taskId: number | null;
    execution?: TaskExecution; // 可选的执行对象,用于查看历史记录
}

export default function TaskExecutionMonitor({
    open,
    onOpenChange,
    taskId,
    execution: externalExecution,
}: TaskExecutionMonitorProps) {
    const { t } = useTranslation();
    const { getTaskExecution, cancelTask } = useDeployment();
    const [execution, setExecution] = useState<TaskExecution | undefined>(externalExecution);
    const [autoScroll, setAutoScroll] = useState(false);

    useEffect(() => {
        // 如果传入了外部execution(历史记录),直接使用
        if (externalExecution) {
            setExecution(externalExecution);
            return;
        }

        // 否则从context中获取正在运行的任务
        if (!open || taskId === null) return;

        const interval = setInterval(() => {
            const latest = getTaskExecution(taskId);
            setExecution(latest);

            // 自动滚动到底部
            if (autoScroll) {
                const logContainer = document.getElementById('execution-logs');
                if (logContainer) {
                    logContainer.scrollTop = logContainer.scrollHeight;
                }
            }
        }, 100);

        return () => clearInterval(interval);
    }, [open, taskId, getTaskExecution, autoScroll, externalExecution]);

    // 控制body滚动
    useEffect(() => {
        if (open) {
            // 禁止body滚动
            document.body.style.overflow = 'hidden';
        } else {
            // 恢复body滚动
            document.body.style.overflow = '';
        }

        // 清理函数
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    if (!open || !execution) return null;

    const getStatusIcon = () => {
        switch (execution.status) {
            case 'RUNNING':
                return <PlayCircle className="h-5 w-5 text-blue-500 animate-pulse" />;
            case 'COMPLETED':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'FAILED':
                return <XCircle className="h-5 w-5 text-red-500" />;
            default:
                return <Clock className="h-5 w-5 text-gray-500" />;
        }
    };

    const getStatusBadge = () => {
        switch (execution.status) {
            case 'RUNNING':
                return <Badge className="bg-blue-500">{t('deployment.monitor.status.running')}</Badge>;
            case 'COMPLETED':
                return <Badge className="bg-green-500">{t('deployment.monitor.status.completed')}</Badge>;
            case 'FAILED':
                return <Badge variant="destructive">{t('deployment.monitor.status.failed')}</Badge>;
            default:
                return <Badge variant="secondary">{t('deployment.monitor.status.pending')}</Badge>;
        }
    };

    const getLogIcon = (log: ExecutionLog) => {
        switch (log.level) {
            case 'success':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'warning':
                return <AlertCircle className="h-4 w-4 text-yellow-500" />;
            default:
                return <Terminal className="h-4 w-4 text-blue-500" />;
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    };

    const getDuration = () => {
        const start = new Date(execution.startTime);
        const end = execution.endTime ? new Date(execution.endTime) : new Date();
        const diff = end.getTime() - start.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    };

    // 计算已完成的步骤数
    const getCompletedSteps = () => {
        if (execution.status === 'COMPLETED') {
            return execution.totalSteps;
        }
        // 根据进度百分比估算
        return Math.floor((execution.progress / 100) * execution.totalSteps);
    };

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
            {/* 顶部标题栏 */}
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenChange(false)}
                                className="gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                {t('deployment.monitor.back')}
                            </Button>
                            <div className="flex items-center gap-3">
                                {getStatusIcon()}
                                <div>
                                    <h1 className="text-xl font-bold">{execution.taskName}</h1>
                                    <p className="text-sm text-muted-foreground">
                                        {t('deployment.monitor.taskId')}: {execution.taskId}
                                    </p>
                                </div>
                            </div>
                        </div>
                        {getStatusBadge()}
                    </div>
                </div>
            </div>

            {/* 主内容区域 */}
            <div className="flex-1 overflow-hidden flex flex-col px-6 py-4 min-h-0">
                {/* 进度信息 */}
                <div className="grid grid-cols-4 gap-4 mb-4 flex-shrink-0">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{execution.progress}%</div>
                            <p className="text-xs text-muted-foreground mt-1">{t('deployment.monitor.progress')}</p>
                            <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${execution.progress}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{getDuration()}</div>
                            <p className="text-xs text-muted-foreground mt-1">{t('deployment.monitor.duration')}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">
                                {getCompletedSteps()}/{execution.totalSteps}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{t('deployment.monitor.stepProgress')}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">
                                {execution.logs.length}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{t('deployment.monitor.logCount')}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* 执行日志 */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold">{t('deployment.monitor.logs')}</h3>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 text-xs">
                                <input
                                    type="checkbox"
                                    checked={autoScroll}
                                    onChange={(e) => setAutoScroll(e.target.checked)}
                                    className="h-3 w-3"
                                />
                                {t('deployment.monitor.autoScroll')}
                            </label>
                            {execution.status === 'RUNNING' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => taskId !== null && cancelTask(taskId)}
                                    className="gap-2"
                                >
                                    <StopCircle className="h-4 w-4" />
                                    {t('deployment.monitor.cancelTask')}
                                </Button>
                            )}
                        </div>
                    </div>

                    <Card className="flex-1 min-h-0 flex flex-col">
                        <CardContent
                            id="execution-logs"
                            className="p-4 flex-1 overflow-y-auto font-mono text-xs bg-black/5 dark:bg-black/20"
                        >
                            {execution.logs.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                    {t('deployment.monitor.noLogs')}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {execution.logs.map((log, index) => (
                                        <div
                                            key={index}
                                            className="flex items-start gap-2 py-1 hover:bg-secondary/50 px-2 rounded"
                                        >
                                            <span className="text-muted-foreground shrink-0">
                                                {formatTime(log.timestamp)}
                                            </span>
                                            {getLogIcon(log)}
                                            {log.serverName && (
                                                <Badge variant="outline" className="shrink-0 text-xs">
                                                    <Server className="h-3 w-3 mr-1" />
                                                    {log.serverName}
                                                </Badge>
                                            )}
                                            {log.stepName && (
                                                <Badge variant="outline" className="shrink-0 text-xs">
                                                    {log.stepName}
                                                </Badge>
                                            )}
                                            <span className={`flex - 1 ${log.level === 'error' ? 'text-red-500' :
                                                log.level === 'success' ? 'text-green-500' :
                                                    log.level === 'warning' ? 'text-yellow-500' :
                                                        ''
                                                }`}>
                                                {log.message}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

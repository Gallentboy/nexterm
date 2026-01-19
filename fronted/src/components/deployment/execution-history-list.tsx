import { debug } from '@/utils/debug';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    History,
    CheckCircle,
    XCircle,
    Clock,
    Server,
    Trash2,
    Eye,
    Calendar,
} from 'lucide-react';
import type { TaskExecution } from '@/contexts/deployment-context';
import TaskExecutionMonitor from './task-execution-monitor';
import * as deploymentApi from '@/api/deployment';

interface ExecutionHistoryListProps {
    history: TaskExecution[];
    onClear: () => void;
}

export default function ExecutionHistoryList({ history, onClear }: ExecutionHistoryListProps) {
    const { t, i18n } = useTranslation();
    const [selectedExecution, setSelectedExecution] = useState<TaskExecution | null>(null);
    const [monitorOpen, setMonitorOpen] = useState(false);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return <Badge className="bg-green-500">{t('deployment.history.status.completed')}</Badge>;
            case 'FAILED':
                return <Badge variant="destructive">{t('deployment.history.status.failed')}</Badge>;
            case 'PARTIAL':
                return <Badge className="bg-yellow-500">{t('deployment.history.status.partial')}</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'FAILED':
                return <XCircle className="h-5 w-5 text-red-500" />;
            default:
                return <Clock className="h-5 w-5 text-gray-500" />;
        }
    };

    const formatDateTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const getDuration = (startTime: string, endTime?: string) => {
        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : new Date();
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

    const handleViewDetails = async (historyItem: any) => {
        try {
            // 从API加载完整的历史记录(包含日志)
            const detail = await deploymentApi.getHistory(historyItem.id);

            // 转换为TaskExecution格式
            const execution: TaskExecution = {
                taskId: detail.taskId,
                taskName: detail.taskName,
                planId: detail.planId,
                planName: detail.planName,
                status: detail.status as any,
                totalSteps: detail.totalSteps,
                progress: detail.progress,
                startTime: detail.startTime,
                endTime: detail.endTime,
                logs: detail.logs.map(log => ({
                    timestamp: log.timestamp,
                    level: log.level as any,
                    message: log.message,
                    serverId: log.serverId,
                    serverName: log.serverName,
                    stepId: log.stepId,
                    stepName: log.stepName,
                })),
                serverGroups: JSON.parse(detail.serverGroups),
            };

            setSelectedExecution(execution);
            setMonitorOpen(true);
        } catch (error) {
            debug.error('[ExecutionHistory] 加载历史详情失败:', error);
        }
    };

    if (history.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <History className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">{t('deployment.history.empty')}</p>
                <p className="text-sm">{t('deployment.history.emptyHint')}</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                        {t('deployment.history.total', { count: history.length })}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClear}
                        className="gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        {t('deployment.history.clear')}
                    </Button>
                </div>

                {history.map((execution) => (
                    <Card key={`${execution.taskId}-${execution.startTime}`} className="border-2">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4 flex-1">
                                    {getStatusIcon(execution.status)}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-semibold text-lg">
                                                {execution.taskName}
                                            </h3>
                                            {getStatusBadge(execution.status)}
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4" />
                                                <span>{t('deployment.history.startTime')}: {formatDateTime(execution.startTime)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4" />
                                                <span>
                                                    {t('deployment.monitor.duration')}: {getDuration(execution.startTime, execution.endTime)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Server className="h-4 w-4" />
                                                <span>{t('deployment.monitor.stepProgress').split('/')[0]}: {execution.totalSteps}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4" />
                                                <span>{t('deployment.history.progress')}: {execution.progress}%</span>
                                            </div>
                                        </div>

                                        {execution.logs.length > 0 && (
                                            <div className="text-sm">
                                                <span className="text-muted-foreground">
                                                    {t('deployment.monitor.logCount')}: {execution.logs.length}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewDetails(execution)}
                                    className="gap-2"
                                >
                                    <Eye className="h-4 w-4" />
                                    {t('deployment.history.viewDetails')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* 执行详情监控器 */}
            {selectedExecution && (
                <TaskExecutionMonitor
                    open={monitorOpen}
                    onOpenChange={setMonitorOpen}
                    taskId={selectedExecution.taskId}
                    execution={selectedExecution}
                />
            )}
        </>
    );
}

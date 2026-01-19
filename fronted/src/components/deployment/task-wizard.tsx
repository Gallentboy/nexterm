import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { debug } from '@/utils/debug';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    ChevronRight,
    ChevronLeft,
    Check,
    FileText,
    Server,
    Settings as SettingsIcon,
} from 'lucide-react';
import type { DeploymentTask, ExecutionPlan, ExecutionStrategy } from '@/types/deployment';
import { getServerGroups } from '@/api/server';
import type { ServerGroup } from '@/api/server';

interface TaskWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plans: ExecutionPlan[];
    task?: DeploymentTask;
    onSave: (task: DeploymentTask) => void;
}

type WizardStep = 'basic' | 'plan' | 'servers' | 'strategy' | 'review';

export default function TaskWizard({ open, onOpenChange, plans, task, onSave }: TaskWizardProps) {
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState<WizardStep>('basic');

    // 任务基本信息
    const [taskName, setTaskName] = useState('');
    const [taskDescription, setTaskDescription] = useState('');

    // 选择的执行计划
    const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

    // 服务器选择
    const [groups, setGroups] = useState<ServerGroup[]>([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

    // 执行策略
    const [strategy, setStrategy] = useState<ExecutionStrategy>('SEQUENTIAL');

    useEffect(() => {
        if (open) {
            loadServersAndGroups();
            // 如果是编辑模式,初始化表单数据
            if (task) {
                setTaskName(task.name);
                setTaskDescription(task.description || '');
                setSelectedPlanId(task.planId);
                setSelectedGroupIds(task.serverGroups.map(g => g.id));
                setStrategy(task.strategy);
            } else {
                // 创建模式,重置表单
                resetForm();
            }
        }
    }, [open, task]);

    const loadServersAndGroups = async () => {
        try {
            const groupsData = await getServerGroups();
            setGroups(groupsData.items || []);
        } catch (error) {
            debug.error('[TaskWizard] Failed to load servers and groups:', error);
        }
    };

    const steps: { id: WizardStep; label: string; icon: any }[] = [
        { id: 'basic', label: t('deployment.wizard.basicInfo'), icon: FileText },
        { id: 'plan', label: t('deployment.wizard.selectPlan'), icon: SettingsIcon },
        { id: 'servers', label: t('deployment.wizard.selectServers'), icon: Server },
        { id: 'strategy', label: t('deployment.wizard.executionStrategy'), icon: SettingsIcon },
        { id: 'review', label: t('deployment.wizard.review'), icon: Check },
    ];

    const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
    const canGoNext = () => {
        switch (currentStep) {
            case 'basic':
                return taskName.trim().length > 0;
            case 'plan':
                return selectedPlanId !== null;
            case 'servers':
                return selectedGroupIds.length > 0;
            case 'strategy':
                return true;
            case 'review':
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStep(steps[currentStepIndex + 1].id);
        }
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) {
            setCurrentStep(steps[currentStepIndex - 1].id);
        }
    };

    const handleSave = () => {
        const selectedPlan = plans.find((p) => p.id === selectedPlanId);
        if (!selectedPlan) return;

        const selectedGroups = groups.filter((g) => selectedGroupIds.includes(g.id));

        const newTask: DeploymentTask = {
            id: task?.id || 0,
            name: taskName,
            description: taskDescription,
            planId: selectedPlanId!,
            planName: selectedPlan.name,
            serverGroups: selectedGroups.map((g) => ({
                id: g.id,
                name: g.name,
                serverCount: g.server_count || 0,
            })),
            strategy,
            status: task?.status || 'PENDING',
            createdAt: task?.createdAt || new Date().toISOString(),
        };

        onSave(newTask);
        onOpenChange(false);
        resetForm();
    };

    const resetForm = () => {
        setCurrentStep('basic');
        setTaskName('');
        setTaskDescription('');
        setSelectedPlanId(null);
        setSelectedGroupIds([]);
        setStrategy('SEQUENTIAL');
    };

    const toggleGroupSelection = (groupId: number) => {
        setSelectedGroupIds((prev) =>
            prev.includes(groupId)
                ? prev.filter((id) => id !== groupId)
                : [...prev, groupId]
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {task ? '编辑部署任务' : t('deployment.wizard.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('deployment.wizard.description')}
                    </DialogDescription>
                </DialogHeader>

                {/* 步骤指示器 */}
                <div className="flex items-center justify-between mb-6">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = step.id === currentStep;
                        const isCompleted = index < currentStepIndex;

                        return (
                            <div key={step.id} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                    <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${isActive
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : isCompleted
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-muted-foreground/30 text-muted-foreground'
                                            }`}
                                    >
                                        {isCompleted ? (
                                            <Check className="h-5 w-5" />
                                        ) : (
                                            <Icon className="h-5 w-5" />
                                        )}
                                    </div>
                                    <span
                                        className={`mt-2 text-xs text-center ${isActive ? 'font-medium' : 'text-muted-foreground'
                                            }`}
                                    >
                                        {step.label}
                                    </span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div
                                        className={`h-0.5 flex-1 mx-2 ${isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                                            }`}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 步骤内容 */}
                <div className="min-h-[400px]">
                    {currentStep === 'basic' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="task-name">{t('deployment.wizard.taskName')}</Label>
                                <Input
                                    id="task-name"
                                    value={taskName}
                                    onChange={(e) => setTaskName(e.target.value)}
                                    placeholder={t('deployment.wizard.taskNamePlaceholder')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="task-description">
                                    {t('deployment.wizard.taskDescription')}
                                </Label>
                                <Textarea
                                    id="task-description"
                                    value={taskDescription}
                                    onChange={(e) => setTaskDescription(e.target.value)}
                                    placeholder={t('deployment.wizard.taskDescriptionPlaceholder')}
                                    rows={4}
                                />
                            </div>
                        </div>
                    )}

                    {currentStep === 'plan' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {t('deployment.wizard.selectPlanHint')}
                            </p>
                            {plans.length === 0 ? (
                                <Card className="border-dashed">
                                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <SettingsIcon className="h-12 w-12 mb-4 opacity-20" />
                                        <p>{t('deployment.wizard.noPlans')}</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid gap-3">
                                    {plans.map((plan) => (
                                        <Card
                                            key={plan.id}
                                            className={`cursor-pointer transition-all ${selectedPlanId === plan.id
                                                ? 'border-primary border-2 bg-primary/5'
                                                : 'border-2 hover:border-primary/50'
                                                }`}
                                            onClick={() => setSelectedPlanId(plan.id)}
                                        >
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="text-base">
                                                            {plan.name}
                                                        </CardTitle>
                                                        {plan.description && (
                                                            <p className="text-sm text-muted-foreground mt-1">
                                                                {plan.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {selectedPlanId === plan.id && (
                                                        <Check className="h-5 w-5 text-primary" />
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <span>{plan.steps.length} 个步骤</span>
                                                    <span>
                                                        {
                                                            plan.steps.filter(
                                                                (s) => s.type === 'FILE_UPLOAD'
                                                            ).length
                                                        }{' '}
                                                        个上传
                                                    </span>
                                                    <span>
                                                        {
                                                            plan.steps.filter(
                                                                (s) => s.type === 'COMMAND_EXECUTION'
                                                            ).length
                                                        }{' '}
                                                        个命令
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {currentStep === 'servers' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {t('deployment.wizard.selectServersHint')}
                            </p>
                            {groups.length === 0 ? (
                                <Card className="border-dashed">
                                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <Server className="h-12 w-12 mb-4 opacity-20" />
                                        <p>{t('deployment.wizard.noGroups')}</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid gap-3">
                                    {groups
                                        .filter((group) => (group.server_count || 0) > 0)
                                        .map((group) => (
                                            <Card
                                                key={group.id}
                                                className={`cursor-pointer transition-all ${selectedGroupIds.includes(group.id)
                                                    ? 'border-primary border-2 bg-primary/5'
                                                    : 'border-2 hover:border-primary/50'
                                                    }`}
                                                onClick={() => toggleGroupSelection(group.id)}
                                            >
                                                <CardContent className="flex items-center justify-between py-4">
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedGroupIds.includes(group.id)}
                                                            onChange={() => toggleGroupSelection(group.id)}
                                                            className="h-4 w-4"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <div>
                                                            <p className="font-medium">{group.name}</p>
                                                            {group.description && (
                                                                <p className="text-sm text-muted-foreground">
                                                                    {group.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary">
                                                        {group.server_count || 0} 台服务器
                                                    </Badge>
                                                </CardContent>
                                            </Card>
                                        ))}
                                </div>
                            )}
                        </div>
                    )}

                    {currentStep === 'strategy' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label>{t('deployment.wizard.strategyLabel')}</Label>
                                <Select value={strategy} onValueChange={(v) => setStrategy(v as ExecutionStrategy)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SEQUENTIAL">
                                            {t('deployment.strategy.sequential')}
                                        </SelectItem>
                                        <SelectItem value="PARALLEL">
                                            {t('deployment.strategy.parallel')}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground">
                                    {strategy === 'SEQUENTIAL' && t('deployment.strategy.sequentialDesc')}
                                    {strategy === 'PARALLEL' && t('deployment.strategy.parallelDesc')}
                                </p>
                            </div>
                        </div>
                    )}

                    {currentStep === 'review' && (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">基本信息</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">任务名称:</span>
                                        <span className="font-medium">{taskName}</span>
                                    </div>
                                    {taskDescription && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">任务描述:</span>
                                            <span className="font-medium">{taskDescription}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">执行计划</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    {plans.find((p) => p.id === selectedPlanId) && (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">计划名称:</span>
                                                <span className="font-medium">
                                                    {plans.find((p) => p.id === selectedPlanId)?.name}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">步骤数量:</span>
                                                <span className="font-medium">
                                                    {plans.find((p) => p.id === selectedPlanId)?.steps.length}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">目标服务器</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">服务器组:</span>
                                        <span className="font-medium">{selectedGroupIds.length} 个</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">服务器总数:</span>
                                        <span className="font-medium">
                                            {groups
                                                .filter((g) => selectedGroupIds.includes(g.id))
                                                .reduce((sum, g) => sum + (g.server_count || 0), 0)}{' '}
                                            台
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">执行策略</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">策略类型:</span>
                                        <span className="font-medium">
                                            {strategy === 'SEQUENTIAL' && '串行执行'}
                                            {strategy === 'PARALLEL' && '并行执行'}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex justify-between">
                    <Button
                        variant="outline"
                        onClick={handlePrevious}
                        disabled={currentStepIndex === 0}
                        className="gap-2"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        上一步
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                resetForm();
                                onOpenChange(false);
                            }}
                        >
                            {t('common.cancel')}
                        </Button>
                        {currentStep === 'review' ? (
                            <Button onClick={handleSave} className="gap-2">
                                <Check className="h-4 w-4" />
                                {task ? '完成' : t('deployment.wizard.create')}
                            </Button>
                        ) : (
                            <Button onClick={handleNext} disabled={!canGoNext()} className="gap-2">
                                下一步
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

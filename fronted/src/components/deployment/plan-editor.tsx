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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
    Upload,
    Terminal,
    Plus,
    Trash2,
    GripVertical,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import type { ExecutionPlan, Step, StepType, FileUploadStep, CommandExecutionStep } from '@/types/deployment';
import PathInput from './path-input';

interface PlanEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plan?: ExecutionPlan;
    onSave: (plan: ExecutionPlan) => void;
}

export default function PlanEditor({ open, onOpenChange, plan, onSave }: PlanEditorProps) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState<Step[]>([]);
    const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

    // 当 plan prop 变化时更新表单
    useEffect(() => {
        if (plan) {
            setName(plan.name);
            setDescription(plan.description || '');
            setSteps(plan.steps || []);
        } else {
            // 创建模式,重置表单
            setName('');
            setDescription('');
            setSteps([]);
            setExpandedSteps(new Set());
        }
    }, [plan]);

    const addStep = (type: StepType) => {
        let newStep: Step;

        if (type === 'FILE_UPLOAD') {
            newStep = {
                id: `step-${Date.now()}`,
                order: steps.length,
                type: 'FILE_UPLOAD',
                name: '上传文件',
                sourcePath: '',
                targetPath: '/opt/app/',
                overwrite: true,
            } as FileUploadStep;
        } else {
            newStep = {
                id: `step-${Date.now()}`,
                order: steps.length,
                type: 'COMMAND_EXECUTION',
                name: '执行命令',
                commands: [],
                workingDirectory: '/opt/app/',
            } as CommandExecutionStep;
        }

        setSteps([...steps, newStep]);
        setExpandedSteps(new Set([...expandedSteps, newStep.id]));
    };

    const removeStep = (stepId: string) => {
        setSteps(steps.filter((s) => s.id !== stepId));
        const newExpanded = new Set(expandedSteps);
        newExpanded.delete(stepId);
        setExpandedSteps(newExpanded);
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        const newSteps = [...steps];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= steps.length) return;

        [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
        newSteps.forEach((step, idx) => {
            step.order = idx;
        });
        setSteps(newSteps);
    };

    const updateStep = (stepId: string, updates: Partial<Step>) => {
        setSteps(
            steps.map((step) =>
                step.id === stepId ? ({ ...step, ...updates } as Step) : step
            )
        );
    };

    const toggleStepExpanded = (stepId: string) => {
        const newExpanded = new Set(expandedSteps);
        if (newExpanded.has(stepId)) {
            newExpanded.delete(stepId);
        } else {
            newExpanded.add(stepId);
        }
        setExpandedSteps(newExpanded);
    };

    const handleSave = () => {
        const newPlan: ExecutionPlan = {
            id: plan?.id || 0,
            name,
            description,
            steps,
            version: '1.0',
            createdAt: plan?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        onSave(newPlan);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {plan ? t('deployment.plans.edit') : t('deployment.plans.create')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('deployment.plans.editorDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* 基本信息 */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="plan-name">{t('deployment.plans.planName')}</Label>
                            <Input
                                id="plan-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('deployment.plans.planNamePlaceholder')}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="plan-description">
                                {t('deployment.plans.planDescription')}
                            </Label>
                            <Textarea
                                id="plan-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('deployment.plans.planDescriptionPlaceholder')}
                                rows={2}
                            />
                        </div>
                    </div>

                    {/* 步骤列表 */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">
                                {t('deployment.plans.steps')} ({steps.length})
                            </Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addStep('FILE_UPLOAD')}
                                    className="gap-2"
                                >
                                    <Upload className="h-4 w-4" />
                                    {t('deployment.steps.addUpload')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addStep('COMMAND_EXECUTION')}
                                    className="gap-2"
                                >
                                    <Terminal className="h-4 w-4" />
                                    {t('deployment.steps.addCommand')}
                                </Button>
                            </div>
                        </div>

                        {steps.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                    <Plus className="h-12 w-12 mb-4 opacity-20" />
                                    <p>{t('deployment.steps.empty')}</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {steps.map((step, index) => (
                                    <StepCard
                                        key={step.id}
                                        step={step}
                                        index={index}
                                        isExpanded={expandedSteps.has(step.id)}
                                        onToggleExpand={() => toggleStepExpanded(step.id)}
                                        onUpdate={(updates) => updateStep(step.id, updates)}
                                        onRemove={() => removeStep(step.id)}
                                        onMoveUp={() => moveStep(index, 'up')}
                                        onMoveDown={() => moveStep(index, 'down')}
                                        canMoveUp={index > 0}
                                        canMoveDown={index < steps.length - 1}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={!name || steps.length === 0}>
                        {t('common.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface StepCardProps {
    step: Step;
    index: number;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onUpdate: (updates: Partial<Step>) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
}

function StepCard({
    step,
    index,
    isExpanded,
    onToggleExpand,
    onUpdate,
    onRemove,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
}: StepCardProps) {
    const { t } = useTranslation();

    return (
        <Card className="border-2">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                            {index + 1}
                        </div>
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            {step.type === 'FILE_UPLOAD' ? (
                                <Upload className="h-4 w-4 text-blue-500" />
                            ) : (
                                <Terminal className="h-4 w-4 text-green-500" />
                            )}
                            <Input
                                value={step.name}
                                onChange={(e) => onUpdate({ name: e.target.value })}
                                className="font-medium h-8"
                                placeholder={t('deployment.steps.stepName')}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onMoveUp}
                            disabled={!canMoveUp}
                            className="h-8 w-8"
                        >
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onMoveDown}
                            disabled={!canMoveDown}
                            className="h-8 w-8"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onToggleExpand}
                            className="h-8 w-8"
                        >
                            {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onRemove}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-4 pt-0">
                    {step.type === 'FILE_UPLOAD' ? (
                        <FileUploadStepEditor step={step as FileUploadStep} onUpdate={onUpdate} />
                    ) : (
                        <CommandExecutionStepEditor step={step as CommandExecutionStep} onUpdate={onUpdate} />
                    )}
                </CardContent>
            )}
        </Card>
    );
}

function FileUploadStepEditor({
    step,
    onUpdate,
}: {
    step: FileUploadStep;
    onUpdate: (updates: Partial<Step>) => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>{t('deployment.steps.sourcePath')}</Label>
                <PathInput
                    value={step.sourcePath || ''}
                    onChange={(path) => onUpdate({ sourcePath: path })}
                    placeholder={t('deployment.steps.sourcePathPlaceholder')}
                />
            </div>

            <div className="space-y-2">
                <Label>{t('deployment.steps.targetPath')}</Label>
                <Input
                    value={step.targetPath || ''}
                    onChange={(e) => onUpdate({ targetPath: e.target.value })}
                    placeholder="/opt/app/"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>{t('deployment.steps.permissions')}</Label>
                    <Input
                        value={step.permissions || ''}
                        onChange={(e) => onUpdate({ permissions: e.target.value })}
                        placeholder="755"
                    />
                </div>
                <div className="flex items-center gap-2 pt-8">
                    <input
                        type="checkbox"
                        id={`overwrite-${step.id}`}
                        checked={step.overwrite || false}
                        onChange={(e) => onUpdate({ overwrite: e.target.checked })}
                        className="h-4 w-4"
                    />
                    <Label htmlFor={`overwrite-${step.id}`} className="cursor-pointer">
                        {t('deployment.steps.overwrite')}
                    </Label>
                </div>
            </div>
        </div>
    );
}

function CommandExecutionStepEditor({
    step,
    onUpdate,
}: {
    step: CommandExecutionStep;
    onUpdate: (updates: Partial<Step>) => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>{t('deployment.steps.commands')}</Label>
                <Textarea
                    value={step.commands?.join('\n') || ''}
                    onChange={(e) =>
                        onUpdate({
                            commands: e.target.value.split('\n').filter((c) => c.trim()),
                        })
                    }
                    placeholder={t('deployment.steps.commandsPlaceholder')}
                    rows={5}
                    className="font-mono text-sm"
                />
            </div>

            <div className="space-y-2">
                <Label>{t('deployment.steps.workingDirectory')}</Label>
                <Input
                    value={step.workingDirectory || ''}
                    onChange={(e) => onUpdate({ workingDirectory: e.target.value })}
                    placeholder="/opt/app/"
                />
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id={`continue-${step.id}`}
                    checked={step.continueOnError || false}
                    onChange={(e) => onUpdate({ continueOnError: e.target.checked })}
                    className="h-4 w-4"
                />
                <Label htmlFor={`continue-${step.id}`} className="cursor-pointer">
                    {t('deployment.steps.continueOnError')}
                </Label>
            </div>
        </div>
    );
}

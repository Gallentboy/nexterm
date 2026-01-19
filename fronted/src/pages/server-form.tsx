import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Plus, Eye, EyeOff, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { debug } from '@/utils/debug';
import { useTranslation } from 'react-i18next';
import {
    createServer,
    updateServer,
    getServer,
    getServerGroups,
    createServerGroup,
    type CreateServerRequest,
    type ServerGroup,
} from '@/api/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export default function ServerFormPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = !!id;

    // 动态验证 Schema
    const serverSchema = z.object({
        name: z.string().min(1, t('serverForm.serverName') + t('common.emailNotSet')),
        host: z.string()
            .min(1, t('serverForm.hostPlaceholder'))
            .regex(
                /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/,
                t('serverForm.invalidHost')
            ),
        port: z.number()
            .min(1, t('serverForm.portRange'))
            .max(65535, t('serverForm.portRange')),
        username: z.string().min(1, t('serverForm.usernamePlaceholder')),
        password: z.string().optional(),
        private_key: z.string().optional(),
        description: z.string().optional(),
        group_id: z.number().optional(),
    });

    type ServerFormData = z.infer<typeof serverSchema>;

    const [groups, setGroups] = useState<ServerGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');

    // 密码显示/隐藏状态
    const [showPassword, setShowPassword] = useState(false);

    // Combobox 状态
    const [openGroupCombobox, setOpenGroupCombobox] = useState(false);
    const [groupSearchValue, setGroupSearchValue] = useState('');

    // 新建分组对话框状态
    const [showGroupDialog, setShowGroupDialog] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');
    const [creatingGroup, setCreatingGroup] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
    } = useForm<ServerFormData>({
        resolver: zodResolver(serverSchema),
        defaultValues: {
            port: 22,
        },
    });

    useEffect(() => {
        loadGroups();
        if (isEdit) {
            loadServer();
        }
    }, [id]);

    const loadGroups = async () => {
        try {
            const res = await getServerGroups({ page_size: 100 });
            setGroups(res.items || []);
        } catch (error) {
            debug.error('[ServerForm] 加载分组失败:', error);
        }
    };

    const loadServer = async () => {
        if (!id) return;

        try {
            setLoading(true);
            const server = await getServer(parseInt(id));
            setValue('name', server.name);
            setValue('host', server.host);
            setValue('port', server.port);
            setValue('username', server.username);
            setValue('description', server.description || '');
            if (server.password) {
                setValue('password', server.password);
            }
            if (server.private_key) {
                setValue('private_key', server.private_key);
            }
            if (server.group_id) {
                setValue('group_id', server.group_id);
            }
        } catch (error: any) {
            debug.error('[ServerForm] 加载服务器失败:', error);
            const msg = error.response?.data?.message || error.response?.data?.error || t('common.error');
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) {
            return;
        }

        try {
            setCreatingGroup(true);
            const newGroup = await createServerGroup({
                name: newGroupName.trim(),
                description: newGroupDescription.trim() || undefined,
            });

            // 重新加载分组列表
            await loadGroups();

            // 自动选择新创建的分组
            setValue('group_id', newGroup.id);

            // 关闭对话框并重置表单
            setShowGroupDialog(false);
            setNewGroupName('');
            setNewGroupDescription('');
        } catch (error: any) {
            debug.error('[ServerForm] 创建分组失败:', error);
            const msg = error.response?.data?.message || error.response?.data?.error || t('common.error');
            toast.error(msg);
        } finally {
            setCreatingGroup(false);
        }
    };

    // 快速创建分组(从搜索值)
    const handleQuickCreateGroup = async (groupName: string) => {
        if (!groupName.trim()) {
            return;
        }

        try {
            const newGroup = await createServerGroup({
                name: groupName.trim(),
            });

            // 重新加载分组列表
            await loadGroups();

            // 自动选择新创建的分组
            setValue('group_id', newGroup.id);

            // 关闭 Combobox 并清空搜索
            setOpenGroupCombobox(false);
            setGroupSearchValue('');
        } catch (error: any) {
            debug.error('[ServerForm] 创建分组失败:', error);
            const msg = error.response?.data?.message || error.response?.data?.error || t('common.error');
            toast.error(msg);
        }
    };

    const onSubmit = async (data: ServerFormData) => {
        try {
            setLoading(true);
            setError('');

            // 严格按照接口文档构建请求体
            const payload: CreateServerRequest = {
                name: data.name,
                host: data.host,
                port: data.port,
                username: data.username,
            };

            // 只在有值时添加可选字段
            if (data.password) {
                payload.password = data.password;
            }
            if (data.private_key) {
                payload.private_key = data.private_key;
            }
            if (data.description) {
                payload.description = data.description;
            }
            if (data.group_id) {
                payload.group_id = data.group_id;
            }

            if (isEdit && id) {
                await updateServer(parseInt(id), payload);
                toast.success(t('common.success'));
            } else {
                await createServer(payload);
                toast.success(t('common.success'));
            }

            navigate('/servers');
        } catch (err: any) {
            const msg = err.response?.data?.message || err.response?.data?.error || t('common.error');
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEdit) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg animate-pulse">{t('common.loading')}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            <div className="container mx-auto p-6 max-w-2xl">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/servers')}
                    className="mb-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('serverForm.backToList')}
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>{isEdit ? t('serverForm.editTitle') : t('serverForm.addTitle')}</CardTitle>
                        <CardDescription>
                            {isEdit ? t('serverForm.editSubtitle') : t('serverForm.addSubtitle')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">{t('serverForm.serverName')} *</Label>
                                <Input
                                    id="name"
                                    placeholder={t('serverForm.serverNamePlaceholder')}
                                    {...register('name')}
                                    disabled={loading}
                                />
                                {errors.name && (
                                    <p className="text-sm text-destructive">{errors.name.message}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="host">{t('common.host')} *</Label>
                                    <Input
                                        id="host"
                                        placeholder={t('serverForm.hostPlaceholder')}
                                        {...register('host')}
                                        disabled={loading}
                                    />
                                    {errors.host && (
                                        <p className="text-sm text-destructive">{errors.host.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="port">{t('common.port')} *</Label>
                                    <Input
                                        id="port"
                                        type="number"
                                        placeholder="22"
                                        {...register('port', { valueAsNumber: true })}
                                        disabled={loading}
                                    />
                                    {errors.port && (
                                        <p className="text-sm text-destructive">{errors.port.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="username">{t('common.username')} *</Label>
                                <Input
                                    id="username"
                                    placeholder={t('serverForm.usernamePlaceholder')}
                                    autoComplete="off"
                                    {...register('username')}
                                    disabled={loading}
                                />
                                {errors.username && (
                                    <p className="text-sm text-destructive">{errors.username.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">{t('common.password')}</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder={t('serverForm.passwordPlaceholder')}
                                        autoComplete="new-password"
                                        {...register('password')}
                                        disabled={loading}
                                        className="pr-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={loading}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </Button>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {t('serverForm.passwordHint')}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>{t('serverForm.serverGroup')}</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowGroupDialog(true)}
                                        disabled={loading}
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        {t('groups.add')}
                                    </Button>
                                </div>
                                <Popover open={openGroupCombobox} onOpenChange={setOpenGroupCombobox}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openGroupCombobox}
                                            className="w-full justify-between"
                                            disabled={loading}
                                        >
                                            {watch('group_id')
                                                ? groups.find((group) => group.id === watch('group_id'))?.name
                                                : t('serverForm.selectGroup')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                        <Command>
                                            <CommandInput
                                                placeholder={t('serverForm.searchGroup')}
                                                value={groupSearchValue}
                                                onValueChange={setGroupSearchValue}
                                                onKeyDown={(e) => {
                                                    // 当按下回车且有搜索值且没有匹配的分组时,创建新分组
                                                    if (e.key === 'Enter' && groupSearchValue.trim()) {
                                                        const hasMatch = groups.some(
                                                            (group) =>
                                                                group.name.toLowerCase().includes(groupSearchValue.toLowerCase())
                                                        );
                                                        if (!hasMatch) {
                                                            e.preventDefault();
                                                            handleQuickCreateGroup(groupSearchValue);
                                                        }
                                                    }
                                                }}
                                            />
                                            <CommandList>
                                                <CommandEmpty>
                                                    <div className="p-2 text-center">
                                                        <p className="text-sm text-muted-foreground mb-2">
                                                            {t('groups.noGroups')}
                                                        </p>
                                                        {groupSearchValue && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleQuickCreateGroup(groupSearchValue)}
                                                            >
                                                                <Plus className="h-4 w-4 mr-1" />
                                                                {t('serverForm.createGroupBtn', { name: groupSearchValue })}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        value="none"
                                                        onSelect={() => {
                                                            setValue('group_id', undefined);
                                                            setOpenGroupCombobox(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                'mr-2 h-4 w-4',
                                                                !watch('group_id') ? 'opacity-100' : 'opacity-0'
                                                            )}
                                                        />
                                                        {t('serverForm.noGroup')}
                                                    </CommandItem>
                                                    {groups.map((group) => (
                                                        <CommandItem
                                                            key={group.id}
                                                            value={`${group.name}-${group.id}`}
                                                            onSelect={() => {
                                                                setValue('group_id', group.id);
                                                                setOpenGroupCombobox(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    'mr-2 h-4 w-4',
                                                                    watch('group_id') === group.id
                                                                        ? 'opacity-100'
                                                                        : 'opacity-0'
                                                                )}
                                                            />
                                                            {group.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">{t('groups.tableDesc')}</Label>
                                <Textarea
                                    id="description"
                                    placeholder={t('serverForm.descriptionPlaceholder')}
                                    rows={3}
                                    {...register('description')}
                                    disabled={loading}
                                />
                            </div>

                            {error && (
                                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-2 justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate('/servers')}
                                    disabled={loading}
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? t('common.saving') : isEdit ? t('serverForm.saveChanges') : t('serverForm.addTitle')}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* 新建分组对话框 */}
                <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('groups.newTitle')}</DialogTitle>
                            <DialogDescription>
                                {t('groups.subtitle')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="group-name">{t('groups.tableName')} *</Label>
                                <Input
                                    id="group-name"
                                    placeholder={t('groups.namePlaceholder')}
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    disabled={creatingGroup}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="group-description">{t('groups.tableDesc')}</Label>
                                <Textarea
                                    id="group-description"
                                    placeholder={t('groups.descPlaceholder')}
                                    rows={3}
                                    value={newGroupDescription}
                                    onChange={(e) => setNewGroupDescription(e.target.value)}
                                    disabled={creatingGroup}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setShowGroupDialog(false);
                                    setNewGroupName('');
                                    setNewGroupDescription('');
                                }}
                                disabled={creatingGroup}
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button
                                type="button"
                                onClick={handleCreateGroup}
                                disabled={creatingGroup || !newGroupName.trim()}
                            >
                                {creatingGroup ? t('serverForm.creating') : t('groups.add')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

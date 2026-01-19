import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { debug } from '@/utils/debug';
import { Plus, FolderEdit, Pencil, Trash2, CheckSquare, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    getServerGroups,
    createServerGroup,
    updateServerGroup,
    deleteServerGroup,
    batchDeleteServerGroups,
    type ServerGroup,
} from '@/api/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';

export default function GroupsPage() {
    const { t } = useTranslation();
    const [groups, setGroups] = useState<ServerGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);

    // 选择状态
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // 对话框相关
    const [showDialog, setShowDialog] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ServerGroup | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // 删除确认
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<ServerGroup | null>(null);
    const [deleting, setDeleting] = useState(false);

    // 批量删除确认
    const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, [page]);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await getServerGroups({ page, page_size: pageSize });
            setGroups(res.items || []);
            setTotal(res.total || 0);
            setSelectedIds([]); // 状态重置
        } catch (error: any) {
            debug.error('[DeploymentContext] 加载分组失败:', error);
            const msg = error.response?.data?.message || error.response?.data?.error || t('common.error');
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (group?: ServerGroup) => {
        if (group) {
            setEditingGroup(group);
            setName(group.name);
            setDescription(group.description || '');
        } else {
            setEditingGroup(null);
            setName('');
            setDescription('');
        }
        setShowDialog(true);
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error(t('groups.nameRequired'));
            return;
        }

        try {
            setSubmitting(true);
            if (editingGroup) {
                await updateServerGroup(editingGroup.id, {
                    name: name.trim(),
                    description: description.trim(),
                });
                toast.success(t('common.success'));
            } else {
                await createServerGroup({
                    name: name.trim(),
                    description: description.trim(),
                });
                toast.success(t('common.success'));
            }
            setShowDialog(false);
            loadData();
        } catch (error: any) {
            debug.error('[Groups] 保存分组失败:', error);
            const msg = error.response?.data?.message || error.response?.data?.error || t('common.error');
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteClick = (group: ServerGroup) => {
        setGroupToDelete(group);
        setDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!groupToDelete) return;

        try {
            setDeleting(true);
            await deleteServerGroup(groupToDelete.id);
            toast.success(t('common.success'));
            setDeleteOpen(false);
            loadData();
        } catch (error: any) {
            debug.error('[DeploymentContext] 删除失败:', error);
            const msg = error.response?.data?.message || error.response?.data?.error || t('common.error');
            toast.error(msg);
        } finally {
            setDeleting(false);
        }
    };

    const confirmBatchDelete = async () => {
        if (selectedIds.length === 0) return;

        try {
            setDeleting(true);
            await batchDeleteServerGroups(selectedIds);
            toast.success(t('common.success'));
            setBatchDeleteOpen(false);
            setSelectedIds([]);
            loadData();
        } catch (error: any) {
            debug.error('[DeploymentContext] 批量删除失败:', error);
            const msg = error.response?.data?.message || error.response?.data?.error || t('common.error');
            toast.error(msg);
        } finally {
            setDeleting(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === groups.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(groups.map(g => g.id));
        }
    };

    const toggleSelect = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="container mx-auto p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FolderEdit className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('groups.title')}</h1>
                        <p className="text-muted-foreground mt-1">
                            {t('groups.subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {selectedIds.length > 0 && (
                        <Button
                            variant="destructive"
                            onClick={() => setBatchDeleteOpen(true)}
                            className="shadow-sm animate-in fade-in slide-in-from-right-2"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('common.batchDelete')} ({selectedIds.length})
                        </Button>
                    )}
                    <Button onClick={() => handleOpenDialog()} className="shadow-sm">
                        <Plus className="mr-2 h-4 w-4" />
                        {t('groups.newButton')}
                    </Button>
                </div>
            </div>

            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-12">
                                    <div
                                        className="flex items-center justify-center cursor-pointer text-muted-foreground hover:text-primary transition-colors"
                                        onClick={toggleSelectAll}
                                    >
                                        {selectedIds.length === groups.length && groups.length > 0 ? (
                                            <CheckSquare className="h-4 w-4 text-primary" />
                                        ) : (
                                            <Square className="h-4 w-4" />
                                        )}
                                    </div>
                                </TableHead>
                                <TableHead className="font-semibold">{t('common.name')}</TableHead>
                                <TableHead className="font-semibold">{t('groups.description')}</TableHead>
                                <TableHead className="font-semibold">{t('groups.serverCountLabel')}</TableHead>
                                <TableHead className="font-semibold">{t('groups.createdAt')}</TableHead>
                                <TableHead className="text-right font-semibold">{t('common.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && groups.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 animate-pulse text-muted-foreground text-sm">
                                        {t('common.loading')}
                                    </TableCell>
                                </TableRow>
                            ) : groups.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                            <FolderEdit className="h-10 w-10 mb-2 opacity-20" />
                                            <p>{t('groups.empty')}</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                groups.map((group) => (
                                    <TableRow
                                        key={group.id}
                                        className={`transition-colors ${selectedIds.includes(group.id) ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                                    >
                                        <TableCell>
                                            <div
                                                className="flex items-center justify-center cursor-pointer text-muted-foreground hover:text-primary transition-colors"
                                                onClick={() => toggleSelect(group.id)}
                                            >
                                                {selectedIds.includes(group.id) ? (
                                                    <CheckSquare className="h-4 w-4 text-primary" />
                                                ) : (
                                                    <Square className="h-4 w-4" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{group.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                            {group.description || <span className="text-muted-foreground/40 italic">{t('groups.noDescription')}</span>}
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                                                {t('groups.serverCount', { count: group.server_count || 0 })}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {group.created_at || '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                                                    onClick={() => handleOpenDialog(group)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                                    onClick={() => handleDeleteClick(group)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {total > 0 && (
                    <div className="p-4 border-t bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                            {t('common.total', { count: total })}
                            <span className="mx-2 text-muted-foreground/30">|</span>
                            {t('common.page', { current: page, total: totalPages || 1 })}
                        </div>

                        {totalPages > 1 && (
                            <Pagination className="mx-0 w-auto">
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                                            className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                        />
                                    </PaginationItem>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                        <PaginationItem key={p}>
                                            <PaginationLink
                                                href="#"
                                                isActive={p === page}
                                                onClick={(e) => { e.preventDefault(); setPage(p); }}
                                            >
                                                {p}
                                            </PaginationLink>
                                        </PaginationItem>
                                    ))}
                                    <PaginationItem>
                                        <PaginationNext
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}
                                            className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        )}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title={t('groups.deleteConfirmTitle')}
                description={t('groups.deleteConfirmDesc', { name: groupToDelete?.name })}
                onConfirm={confirmDelete}
                loading={deleting}
            />

            <ConfirmDialog
                open={batchDeleteOpen}
                onOpenChange={setDeleteOpen}
                title={t('groups.batchDeleteConfirmTitle')}
                description={t('groups.batchDeleteConfirmDesc', { count: selectedIds.length })}
                onConfirm={confirmBatchDelete}
                loading={deleting}
            />

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingGroup ? t('groups.editTitle') : t('groups.newTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('groups.dialogDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">{t('common.name')}</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('groups.namePlaceholder')}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">{t('groups.description')}</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('groups.descPlaceholder')}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting ? t('common.saving') : t('common.submit')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Server as ServerIcon, Pencil, Trash2, Search, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { debug } from '@/utils/debug';
import { useTranslation } from 'react-i18next';
import { getServers, deleteServer, batchDeleteServers, type Server, type ServerGroup, getServerGroups } from '@/api/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';

export default function ServersPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [servers, setServers] = useState<Server[]>([]);
    const [groups, setGroups] = useState<ServerGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('all');

    // 分页状态
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [total, setTotal] = useState(0);

    // 选择状态
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // 删除确认相关状态
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [serverToDelete, setServerToDelete] = useState<{ id: number; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    // 批量删除确认状态
    const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

    useEffect(() => {
        loadGroups();
    }, []);

    useEffect(() => {
        loadData();
    }, [page, selectedGroup, pageSize]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (page !== 1) {
                setPage(1);
            } else {
                loadData();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const loadGroups = async () => {
        try {
            const res = await getServerGroups({ page_size: 100 });
            setGroups(res.items || []);
        } catch (error: any) {
            debug.error('[Servers] 加载分组失败:', error);
            const msg = error.response?.data?.message || error.response?.data?.error || t('common.error');
            toast.error(msg);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const params: any = {
                page,
                page_size: pageSize,
                search: search || undefined,
            };

            if (selectedGroup !== 'all') {
                params.group_id = selectedGroup === 'none' ? 0 : parseInt(selectedGroup);
            }

            const res = await getServers(params);
            setServers(res.items || []);
            setTotal(res.total || 0);
            setSelectedIds([]); // 翻页或搜索后清空选择
        } catch (error: any) {
            debug.error('[Servers] 加载数据失败:', error);
            const msg = error.response?.data?.message || error.response?.data?.error || t('common.error');
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (id: number, name: string) => {
        setServerToDelete({ id, name });
        setDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!serverToDelete) return;

        try {
            setDeleting(true);
            await deleteServer(serverToDelete.id);
            toast.success(t('common.success'));
            setDeleteOpen(false);
            await loadData();
        } catch (error: any) {
            debug.error('[Servers] 删除失败:', error);
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
            await batchDeleteServers(selectedIds);
            toast.success(t('common.success'));
            setBatchDeleteOpen(false);
            setSelectedIds([]);
            await loadData();
        } catch (error: any) {
            debug.error('[Servers] 批量删除失败:', error);
            const msg = error.response?.data?.message || error.response?.data?.error || t('common.error');
            toast.error(msg);
        } finally {
            setDeleting(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === servers.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(servers.map(s => s.id));
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
                        <ServerIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('servers.title')}</h1>
                        <p className="text-muted-foreground mt-1">
                            {t('servers.subtitle')}
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
                    <Button onClick={() => navigate('/servers/new')} size="lg" className="shadow-sm">
                        <Plus className="mr-2 h-4 w-4" />
                        {t('servers.add')}
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle>{t('servers.all')}</CardTitle>
                            <CardDescription>
                                {t('servers.countServer', { count: total })}
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('common.search')}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 bg-muted/50 border-none focus-visible:ring-1"
                                />
                            </div>
                            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                                <SelectTrigger className="w-full sm:w-40 bg-muted/50 border-none focus:ring-1">
                                    <SelectValue placeholder={t('servers.allGroups')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('servers.allGroups')}</SelectItem>
                                    <SelectItem value="none">{t('servers.noGroup')}</SelectItem>
                                    {groups.map((group) => (
                                        <SelectItem key={group.id} value={group.id.toString()}>
                                            {group.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading && servers.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
                        </div>
                    ) : servers.length === 0 ? (
                        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed">
                            <ServerIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold text-foreground/80">{t('servers.notFound')}</h3>
                            <p className="text-muted-foreground mt-1 max-w-xs mx-auto">
                                {search || selectedGroup !== 'all'
                                    ? t('common.search')
                                    : t('servers.add')}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="relative overflow-x-auto border rounded-xl bg-background shadow-sm scrollbar-premium">
                                <Table className="min-w-[1500px] border-separate border-spacing-0">
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[48px] sticky left-0 z-40 bg-muted border-b border-r text-center p-0">
                                                <div
                                                    className="flex items-center justify-center cursor-pointer text-muted-foreground hover:text-primary h-full w-full"
                                                    onClick={toggleSelectAll}
                                                >
                                                    {selectedIds.length === servers.length && servers.length > 0 ? (
                                                        <CheckSquare className="h-4 w-4 text-primary" />
                                                    ) : (
                                                        <Square className="h-4 w-4" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead className="w-[150px] font-semibold sticky left-[48px] z-40 bg-muted border-b border-r">{t('common.name')}</TableHead>
                                            <TableHead className="w-[180px] font-semibold sticky left-[198px] z-40 bg-muted border-b border-r">{t('common.host')}</TableHead>
                                            <TableHead className="w-[80px] font-semibold sticky left-[378px] z-40 bg-muted border-b border-r text-center">{t('common.port')}</TableHead>
                                            <TableHead className="w-[120px] font-semibold sticky left-[458px] z-40 bg-muted border-b border-r">{t('common.username')}</TableHead>
                                            <TableHead className="min-w-[120px] font-semibold border-b border-r bg-muted">{t('servers.group')}</TableHead>
                                            <TableHead className="min-w-[200px] font-semibold border-b border-r bg-muted">{t('common.description')}</TableHead>
                                            <TableHead className="min-w-[200px] font-semibold border-b border-r bg-muted">{t('common.createdAt')}</TableHead>
                                            <TableHead className="min-w-[200px] font-semibold border-b bg-muted">{t('common.updatedAt')}</TableHead>
                                            <TableHead className="w-[100px] text-right font-semibold sticky right-0 z-40 bg-muted border-b border-l">{t('common.actions')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {servers.map((server) => {
                                            const isSelected = selectedIds.includes(server.id);
                                            const rowBgClass = isSelected
                                                ? 'bg-primary/10 dark:bg-primary/20'
                                                : 'bg-background group-hover:bg-muted/80';
                                            const stickyBgClass = isSelected
                                                ? 'bg-[#edf2f7] dark:bg-[#1a202c]' // 选中的固列背景，使用更深的固定色
                                                : 'bg-background group-hover:bg-muted'; // 未选中的固定列背景

                                            return (
                                                <TableRow
                                                    key={server.id}
                                                    className={`group transition-colors border-none ${isSelected ? 'bg-primary/5' : ''}`}
                                                >
                                                    <TableCell className={`w-[48px] sticky left-0 z-30 border-b border-r text-center p-0 transition-colors ${stickyBgClass}`}>
                                                        <div
                                                            className="flex items-center justify-center cursor-pointer text-muted-foreground hover:text-primary h-full w-full"
                                                            onClick={() => toggleSelect(server.id)}
                                                        >
                                                            {isSelected ? (
                                                                <CheckSquare className="h-4 w-4 text-primary" />
                                                            ) : (
                                                                <Square className="h-4 w-4" />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={`w-[150px] font-bold sticky left-[48px] z-30 border-b border-r transition-colors ${stickyBgClass}`}>
                                                        {server.name}
                                                    </TableCell>
                                                    <TableCell className={`w-[180px] font-mono text-sm text-muted-foreground sticky left-[198px] z-30 border-b border-r transition-colors ${stickyBgClass}`}>
                                                        {server.host}
                                                    </TableCell>
                                                    <TableCell className={`w-[80px] text-sm sticky left-[378px] z-30 border-b border-r text-center transition-colors ${stickyBgClass}`}>
                                                        {server.port}
                                                    </TableCell>
                                                    <TableCell className={`w-[120px] text-sm sticky left-[458px] z-30 border-b border-r transition-colors ${stickyBgClass}`}>
                                                        {server.username}
                                                    </TableCell>
                                                    <TableCell className={`border-b border-r transition-colors ${isSelected ? rowBgClass : 'bg-background'}`}>
                                                        {server.group_name ? (
                                                            <Badge variant="secondary" className="font-normal border-none bg-primary/10 text-primary">
                                                                {server.group_name}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground/60 text-xs">
                                                                {t('servers.noGroup')}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className={`text-sm text-muted-foreground max-w-[200px] truncate border-b border-r transition-colors ${isSelected ? rowBgClass : 'bg-background'}`} title={server.description || ''}>
                                                        {server.description || '-'}
                                                    </TableCell>
                                                    <TableCell className={`text-sm text-muted-foreground whitespace-nowrap border-b border-r transition-colors ${isSelected ? rowBgClass : 'bg-background'}`}>
                                                        {server.created_at || '-'}
                                                    </TableCell>
                                                    <TableCell className={`text-sm text-muted-foreground whitespace-nowrap border-b transition-colors ${isSelected ? rowBgClass : 'bg-background'}`}>
                                                        {server.updated_at || '-'}
                                                    </TableCell>
                                                    <TableCell className={`w-[100px] text-right sticky right-0 z-30 border-b border-l transition-colors ${stickyBgClass}`}>
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                                                                onClick={() => navigate(`/servers/${server.id}/edit`)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                                                onClick={() => handleDeleteClick(server.id, server.name)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* 分页控制器 */}
                            {total > 0 && (
                                <div className="mt-8 pt-6 border-t border-dashed flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                                            {t('common.total', { count: total })}
                                            <span className="mx-2 text-muted-foreground/30">|</span>
                                            {t('common.page', { current: page, total: totalPages || 1 })}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">{t('common.rowsPerPage')}</span>
                                            <Select
                                                value={pageSize.toString()}
                                                onValueChange={(v) => {
                                                    setPageSize(parseInt(v));
                                                    setPage(1);
                                                }}
                                            >
                                                <SelectTrigger className="h-8 w-[70px] bg-muted/30 border-none focus:ring-1 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[5, 10, 20, 50].map(size => (
                                                        <SelectItem key={size} value={size.toString()} className="text-xs">
                                                            {size}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
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

                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                                                    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                                                        return (
                                                            <PaginationItem key={p}>
                                                                <PaginationLink
                                                                    href="#"
                                                                    isActive={p === page}
                                                                    onClick={(e) => { e.preventDefault(); setPage(p); }}
                                                                >
                                                                    {p}
                                                                </PaginationLink>
                                                            </PaginationItem>
                                                        );
                                                    } else if (p === page - 2 || p === page + 2) {
                                                        return (
                                                            <PaginationItem key={p}>
                                                                <PaginationEllipsis />
                                                            </PaginationItem>
                                                        );
                                                    }
                                                    return null;
                                                })}

                                                <PaginationItem>
                                                    <PaginationNext
                                                        href="#"
                                                        onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}
                                                        className={page === totalPages || totalPages === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                                    />
                                                </PaginationItem>
                                            </PaginationContent>
                                        </Pagination>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title={t('servers.deleteConfirmTitle')}
                description={t('servers.deleteConfirmDesc', { name: serverToDelete?.name })}
                onConfirm={confirmDelete}
                loading={deleting}
            />

            <ConfirmDialog
                open={batchDeleteOpen}
                onOpenChange={setBatchDeleteOpen}
                title={t('servers.batchDeleteConfirmTitle')}
                description={t('servers.batchDeleteConfirmDesc', { count: selectedIds.length })}
                onConfirm={confirmBatchDelete}
                loading={deleting}
            />
        </div>
    );
}

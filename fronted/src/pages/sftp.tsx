import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FileIcon,
    FolderIcon,
    Download,
    Trash2,
    RefreshCw,
    Search,
    HardDrive,
    ArrowUp,
    FolderPlus,
    X,
    RotateCw,
    Pencil,
    Upload,
    Edit3,
    Eye,
    ArrowUpDown,
    ArrowDown,
    Shield
} from 'lucide-react';
import { getServers, type Server } from '@/api/server';
import { toast } from 'sonner';
import { useSFTP, type FileEntry, type SFTPSession } from '@/contexts/sftp-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { EditorModal } from '@/components/sftp/editor-modal';
import { PdfViewerModal } from '@/components/sftp/pdf-viewer-modal';

export default function SFTPPage() {
    const { t } = useTranslation();
    const {
        sessions,
        activeSessionId,
        setActiveSessionId,
        connect,
        disconnect,
        listDir,
        deleteFile,
        deleteDir,
        createDir,
        rename,
        setPermissions,
        uploadFile,
        cancelUpload,
        downloadFile
    } = useSFTP();

    const [servers, setServers] = useState<Server[]>([]);
    const [selectedServerId, setSelectedServerId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [pathInput, setPathInput] = useState('');

    // Operation Dialog States
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [operationType, setOperationType] = useState<'create' | 'rename' | 'delete' | null>(null);
    const [operationTarget, setOperationTarget] = useState<FileEntry | null>(null);
    const [newName, setNewName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Permissions Dialog States
    const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
    const [permissionsTarget, setPermissionsTarget] = useState<FileEntry | null>(null);
    const [ownerRead, setOwnerRead] = useState(false);
    const [ownerWrite, setOwnerWrite] = useState(false);
    const [ownerExecute, setOwnerExecute] = useState(false);
    const [groupRead, setGroupRead] = useState(false);
    const [groupWrite, setGroupWrite] = useState(false);
    const [groupExecute, setGroupExecute] = useState(false);
    const [othersRead, setOthersRead] = useState(false);
    const [othersWrite, setOthersWrite] = useState(false);
    const [othersExecute, setOthersExecute] = useState(false);

    const activeSession = activeSessionId ? sessions[activeSessionId] : null;

    // Editor Modal States
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
    const [isEditorReadOnly, setIsEditorReadOnly] = useState(false);

    const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
    const [pdfFile, setPdfFile] = useState<FileEntry | null>(null);
    const sessionList = Object.values(sessions).filter(s => s && s.server);

    // 排序状态
    type SortField = 'name' | 'size' | 'modified';
    type SortDirection = 'asc' | 'desc';
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    useEffect(() => {
        loadServers();
    }, []);

    useEffect(() => {
        if (activeSession) {
            setPathInput(activeSession.currentPath);
        }
    }, [activeSession?.currentPath, activeSessionId]);

    // 当活动 session 改变时，同步选中的服务器
    useEffect(() => {
        if (activeSession?.server?.id) {
            setSelectedServerId(activeSession.server.id.toString());
        }
    }, [activeSession?.server?.id]);


    const loadServers = async () => {
        try {
            const data = await getServers({ page: 1, page_size: 100 });
            setServers(data.items);
        } catch (error) {
            toast.error(t('common.error'));
        }
    };

    const handleConnect = async () => {
        if (!selectedServerId) return;
        const server = servers.find(s => s.id.toString() === selectedServerId);
        if (server) {
            await connect(server);
        }
    };

    const handleDisconnect = (id: string) => {
        // 如果关闭的是当前选中的标签，自动选择前一个
        if (id === activeSessionId) {
            const index = sessionList.findIndex(s => s.id === id);
            let nextId = null;
            if (sessionList.length > 1) {
                // 优先选左边的，没有左边的选右边的
                if (index > 0) {
                    nextId = sessionList[index - 1].id;
                } else {
                    nextId = sessionList[1].id;
                }
            }
            setActiveSessionId(nextId);
        }
        disconnect(id);
    };

    const getSessionIndex = (session: SFTPSession) => {
        if (!session?.server?.id) return '';
        const serverSessions = sessionList.filter(s => s?.server?.id === session.server.id);
        if (serverSessions.length <= 1) return '';
        const index = serverSessions.findIndex(s => s?.id === session.id);
        return index >= 0 ? ` #${index + 1}` : '';
    };


    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (timestamp: number | null) => {
        if (!timestamp) return '-';
        return new Date(timestamp * 1000).toLocaleString();
    };

    const formatPermissions = (permissions: number | null, isDir: boolean) => {
        if (permissions === null) return '-';

        const perms = permissions & 0o777;
        const chars = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];

        const owner = chars[(perms >> 6) & 7];
        const group = chars[(perms >> 3) & 7];
        const other = chars[perms & 7];

        return (isDir ? 'd' : '-') + owner + group + other;
    };

    const handleNavigate = (entry: FileEntry) => {
        if (!activeSession || !entry.is_dir) return;
        const newPath = activeSession.currentPath === '.'
            ? entry.name
            : `${activeSession.currentPath}/${entry.name}`;
        listDir(activeSession.id, newPath);
    };

    const handleBack = () => {
        if (!activeSession) return;

        const currentPath = activeSession.currentPath;

        // 如果已经在根目录，不执行操作
        if (currentPath === '/' || currentPath === '.') return;

        // 处理绝对路径
        if (currentPath.startsWith('/')) {
            const parts = currentPath.split('/').filter(p => p);
            parts.pop();
            const newPath = '/' + parts.join('/');
            listDir(activeSession.id, newPath || '/');
        } else {
            // 处理相对路径
            const parts = currentPath.split('/');
            parts.pop();
            const newPath = parts.join('/') || '.';
            listDir(activeSession.id, newPath);
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const filteredFiles = activeSession?.files.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    // 排序文件列表（文件夹始终在前）
    const sortedFiles = [...filteredFiles].sort((a, b) => {
        // 文件夹优先
        if (a.is_dir !== b.is_dir) {
            return a.is_dir ? -1 : 1;
        }

        let comparison = 0;
        switch (sortField) {
            case 'name':
                comparison = a.name.localeCompare(b.name);
                break;
            case 'size':
                comparison = a.size - b.size;
                break;
            case 'modified':
                const aTime = a.modified || 0;
                const bTime = b.modified || 0;
                comparison = aTime - bTime;
                break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
    });

    const handleOpenDialog = (type: 'create' | 'rename' | 'delete', target?: FileEntry) => {
        setOperationType(type);
        setOperationTarget(target || null);
        setNewName(target?.name || '');
        setIsDialogOpen(true);
    };

    const handleOpenPdfViewer = (file: FileEntry) => {
        setPdfFile(file);
        setIsPdfViewerOpen(true);
    };

    const handleOpenEditor = (file: FileEntry, readOnly: boolean = false) => {
        setEditingFile(file);
        setIsEditorReadOnly(readOnly);
        setIsEditorOpen(true);
    };

    const handleOpenPermissionsDialog = (file: FileEntry) => {
        setPermissionsTarget(file);

        // 解析当前权限
        const perms = file.permissions || 0;
        setOwnerRead((perms & 0o400) !== 0);
        setOwnerWrite((perms & 0o200) !== 0);
        setOwnerExecute((perms & 0o100) !== 0);
        setGroupRead((perms & 0o040) !== 0);
        setGroupWrite((perms & 0o020) !== 0);
        setGroupExecute((perms & 0o010) !== 0);
        setOthersRead((perms & 0o004) !== 0);
        setOthersWrite((perms & 0o002) !== 0);
        setOthersExecute((perms & 0o001) !== 0);

        setIsPermissionsDialogOpen(true);
    };

    const handleSavePermissions = () => {
        if (!permissionsTarget || !activeSession) return;

        // 计算新的权限值
        let newPerms = 0;
        if (ownerRead) newPerms |= 0o400;
        if (ownerWrite) newPerms |= 0o200;
        if (ownerExecute) newPerms |= 0o100;
        if (groupRead) newPerms |= 0o040;
        if (groupWrite) newPerms |= 0o020;
        if (groupExecute) newPerms |= 0o010;
        if (othersRead) newPerms |= 0o004;
        if (othersWrite) newPerms |= 0o002;
        if (othersExecute) newPerms |= 0o001;

        // 调用后端 API 更新权限
        const currentPath = activeSession.currentPath;
        const fullPath = currentPath === '.' ? permissionsTarget.name : `${currentPath}/${permissionsTarget.name}`;
        setPermissions(activeSession.id, fullPath, newPerms);

        setIsPermissionsDialogOpen(false);
    };

    const handleConfirmOperation = () => {
        if (!activeSession) return;

        const currentPath = activeSession.currentPath;
        const getFullPath = (name: string) => currentPath === '.' ? name : `${currentPath}/${name}`;

        if (operationType === 'create') {
            if (newName.trim()) {
                createDir(activeSession.id, getFullPath(newName.trim()));
            }
        } else if (operationType === 'rename' && operationTarget) {
            if (newName.trim() && newName !== operationTarget.name) {
                rename(activeSession.id, getFullPath(operationTarget.name), getFullPath(newName.trim()));
            }
        } else if (operationType === 'delete' && operationTarget) {
            if (operationTarget.is_dir) {
                deleteDir(activeSession.id, getFullPath(operationTarget.name));
            } else {
                deleteFile(activeSession.id, getFullPath(operationTarget.name));
            }
        }

        setIsDialogOpen(false);
        setOperationType(null);
        setOperationTarget(null);
        setNewName('');
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !activeSession) return;

        // 检查是否正在上传
        if (activeSession.isUploading) {
            toast.error(t('sftp.uploadInProgress'));
            return;
        }

        const currentPath = activeSession.currentPath;

        // 依次上传所有选中的文件
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const remotePath = currentPath === '.' ? file.name : `${currentPath}/${file.name}`;
            await uploadFile(activeSession.id, remotePath, file);
        }

        // 重置 input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // 只有当离开整个容器时才取消拖拽状态
        if (e.currentTarget === e.target) {
            setIsDragging(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (!activeSession) return;

        // 检查是否正在上传
        if (activeSession.isUploading) {
            toast.error('已有文件正在上传,请等待完成');
            return;
        }

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        const currentPath = activeSession.currentPath;

        // 依次上传所有文件
        for (const file of files) {
            const remotePath = currentPath === '.' ? file.name : `${currentPath}/${file.name}`;
            await uploadFile(activeSession.id, remotePath, file);
        }
    };

    return (
        <div className="container mx-auto p-6 flex flex-col gap-6 flex-1 min-h-0">
            {/* Control Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <HardDrive className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('sftp.title')}</h1>
                        <p className="text-muted-foreground mt-1">{t('sftp.subtitle')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                        <SelectTrigger className="w-[200px] h-10 rounded-xl border-border bg-card">
                            <SelectValue placeholder={t('ssh.selectServer')} />
                        </SelectTrigger>
                        <SelectContent>
                            {servers.map((server) => (
                                <SelectItem key={server.id} value={server.id.toString()}>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        {server.name}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        onClick={handleConnect}
                        disabled={!selectedServerId}
                        className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center gap-2"
                    >
                        <RotateCw className="h-4 w-4" />
                        {t('sftp.connect')}
                    </Button>
                </div>
            </div>

            <Card className="flex-1 overflow-hidden border border-border/60 shadow-sm flex flex-col bg-card rounded-2xl">
                {/* Multi-tab bar (Styled like SSH) */}
                {sessionList.length > 0 && (
                    <div className="flex items-center bg-muted/20 border-b border-border/40 overflow-x-auto no-scrollbar shrink-0">
                        {sessionList.map((session) => (
                            <div
                                key={session.id}
                                onClick={() => setActiveSessionId(session.id)}
                                className={cn(
                                    "group flex items-center gap-2 px-5 py-3 cursor-pointer transition-all border-r border-border/50 text-xs font-semibold min-w-[140px] max-w-[240px] relative",
                                    activeSessionId === session.id
                                        ? "bg-background text-foreground"
                                        : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                )}
                            >
                                {activeSessionId === session.id && (
                                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
                                )}
                                <div className={cn(
                                    "h-2 w-2 rounded-full shrink-0",
                                    session.status === 'connected' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-yellow-500"
                                )} />
                                <span className="truncate flex-1 tracking-wide">{session.server?.name || 'Unknown'}{getSessionIndex(session)}</span>
                                <X
                                    className={cn(
                                        "h-3.5 w-3.5 transition-all shrink-0",
                                        activeSessionId === session.id ? "opacity-60 hover:opacity-100 hover:text-destructive" : "opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-destructive"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDisconnect(session.id);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                    {activeSession ? (
                        <>
                            {/* SFTP 操作区容器 */}
                            <div className="flex-1 flex flex-col min-h-0 relative">
                                {/* 磨砂蒙层 - 仅在上传时显示 */}
                                {activeSession.isUploading && (
                                    <div className="absolute inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300">
                                        <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px]" />
                                        <Card className="z-10 w-[320px] shadow-2xl border-primary/20 bg-background/95 backdrop-blur-md">
                                            <CardContent className="p-6">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <Upload className="h-6 w-6 text-primary animate-bounce" />
                                                    </div>
                                                    <div className="text-center space-y-1">
                                                        <h3 className="font-semibold text-sm">{t('sftp.uploading')}</h3>
                                                        <p className="text-[10px] text-muted-foreground truncate max-w-[240px]">
                                                            {activeSession.uploadingFileName}
                                                        </p>
                                                    </div>

                                                    <div className="w-full space-y-2">
                                                        <div className="flex justify-between text-[10px] font-mono">
                                                            <span className="text-muted-foreground">{t('sftp.uploadProgress')}</span>
                                                            <span className="text-primary">{activeSession.uploadProgress}%</span>
                                                        </div>
                                                        <div className="w-full bg-primary/10 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className="bg-primary h-full transition-all duration-300 shadow-[0_0_8px_rgba(var(--primary),0.4)]"
                                                                style={{ width: `${activeSession.uploadProgress}%` }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="mt-2 h-8 text-[11px] rounded-lg border-destructive/20 text-destructive hover:bg-destructive/5"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            cancelUpload(activeSession.id);
                                                        }}
                                                    >
                                                        {t('sftp.cancelUpload')}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* SFTP Toolbar */}
                                <div className={cn(
                                    "p-2 border-b border-border/40 flex items-center justify-between bg-muted/5 gap-4 transition-all duration-300",
                                    activeSession.isUploading && "blur-[1px] opacity-60 pointer-events-none"
                                )}>
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 hover:bg-muted text-muted-foreground">
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <div className="flex items-center gap-2 text-sm bg-muted/40 px-2 py-0.5 rounded-md flex-1 min-w-0 font-medium border border-transparent focus-within:border-primary/30 focus-within:bg-background transition-all">
                                            <FolderIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                                            <input
                                                type="text"
                                                className="bg-transparent border-none outline-none flex-1 h-7 text-xs font-mono text-foreground/80 placeholder:text-muted-foreground/50"
                                                value={pathInput}
                                                onChange={(e) => setPathInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && activeSession) {
                                                        listDir(activeSession.id, pathInput);
                                                    }
                                                }}
                                                spellCheck={false}
                                            />
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => listDir(activeSession.id, activeSession.currentPath)} className="h-8 w-8 hover:bg-muted text-muted-foreground">
                                            <RefreshCw className={cn("h-4 w-4", activeSession.loading && "animate-spin")} />
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="relative w-48 hidden md:block">
                                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder={t('sftp.search')}
                                                className="h-8 pl-8 pr-8 text-xs bg-muted/30 border-none w-full focus-visible:ring-1"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                            {searchQuery && (
                                                <button
                                                    onClick={() => setSearchQuery('')}
                                                    className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenDialog('create')}
                                            className="h-8 gap-2 text-xs border-dashed"
                                        >
                                            <FolderPlus className="h-3.5 w-3.5" />
                                            {t('sftp.newFolder')}
                                        </Button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <Button
                                            size="sm"
                                            className="h-8 gap-2 text-xs"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Upload className="h-3.5 w-3.5" />
                                            {t('sftp.upload')}
                                        </Button>
                                    </div>
                                </div>

                                {/* File List Table Container */}
                                <div
                                    className={cn(
                                        "flex-1 overflow-auto relative min-h-0 bg-background/50 transition-all duration-300",
                                        activeSession.isUploading && "blur-[1px] opacity-60 pointer-events-none"
                                    )}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    {/* Drag Overlay */}
                                    {isDragging && !activeSession.isUploading && (
                                        <div className="absolute inset-0 z-30 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-2xl flex items-center justify-center pointer-events-none">
                                            <div className="bg-background/90 rounded-2xl px-8 py-6 shadow-2xl border border-primary/20">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Upload className="h-12 w-12 text-primary animate-bounce" />
                                                    <p className="text-lg font-semibold text-foreground">{t('sftp.dropToUpload')}</p>
                                                    <p className="text-sm text-muted-foreground">{t('sftp.supportMultiple')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm shadow-border/10">
                                            <TableRow className="hover:bg-transparent border-border/40">
                                                <TableHead className="w-[450px]">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 text-xs font-bold uppercase tracking-wider hover:bg-muted/50 -ml-3"
                                                        onClick={() => handleSort('name')}
                                                    >
                                                        {t('sftp.fileName')}
                                                        {sortField === 'name' ? (
                                                            sortDirection === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />
                                                        ) : (
                                                            <ArrowUpDown className="ml-2 h-3 w-3 opacity-40" />
                                                        )}
                                                    </Button>
                                                </TableHead>
                                                <TableHead>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 text-xs font-bold uppercase tracking-wider hover:bg-muted/50 -ml-3"
                                                        onClick={() => handleSort('size')}
                                                    >
                                                        {t('sftp.fileSize')}
                                                        {sortField === 'size' ? (
                                                            sortDirection === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />
                                                        ) : (
                                                            <ArrowUpDown className="ml-2 h-3 w-3 opacity-40" />
                                                        )}
                                                    </Button>
                                                </TableHead>
                                                <TableHead>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 text-xs font-bold uppercase tracking-wider hover:bg-muted/50 -ml-3"
                                                        onClick={() => handleSort('modified')}
                                                    >
                                                        {t('sftp.modifiedTime')}
                                                        {sortField === 'modified' ? (
                                                            sortDirection === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />
                                                        ) : (
                                                            <ArrowUpDown className="ml-2 h-3 w-3 opacity-40" />
                                                        )}
                                                    </Button>
                                                </TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider">{t('sftp.permissions')}</TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider">{t('sftp.owner')}</TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider">{t('sftp.group')}</TableHead>
                                                <TableHead className="text-right text-xs font-bold uppercase tracking-wider">{t('sftp.actions')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {/* 返回上一层目录 */}
                                            {activeSession && activeSession.currentPath !== '/' && activeSession.currentPath !== '.' && (
                                                <TableRow
                                                    className="group cursor-pointer hover:bg-muted/30 transition-colors border-border/20"
                                                    onClick={handleBack}
                                                >
                                                    <TableCell className="py-2">
                                                        <div className="flex items-center gap-3">
                                                            <ArrowUp className="h-4.5 w-4.5 text-muted-foreground" />
                                                            <span className="text-sm font-medium text-muted-foreground">..</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">-</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">-</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">-</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">-</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">-</TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="text-xs text-muted-foreground">{t('sftp.backToParent')}</span>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {sortedFiles.map((file) => (
                                                <TableRow
                                                    key={file.name}
                                                    className="group cursor-default hover:bg-muted/30 transition-colors border-border/20"
                                                    onDoubleClick={() => file.is_dir && handleNavigate(file)}
                                                >
                                                    <TableCell className="py-2">
                                                        <div className="flex items-center gap-3">
                                                            {file.is_dir ? (
                                                                <FolderIcon className="h-4.5 w-4.5 text-primary" />
                                                            ) : (
                                                                <FileIcon className="h-4.5 w-4.5 text-slate-400 group-hover:text-primary transition-colors" />
                                                            )}
                                                            <span className={cn(
                                                                "text-sm font-medium transition-colors",
                                                                file.is_dir ? "cursor-pointer hover:text-primary" : "text-muted-foreground"
                                                            )}>
                                                                {file.name}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">
                                                        {file.is_dir ? '-' : formatSize(Number(file.size))}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">
                                                        {formatDate(file.modified)}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground font-mono">
                                                        {formatPermissions(file.permissions, file.is_dir)}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">
                                                        {file.uid ?? '-'}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">
                                                        {file.gid ?? '-'}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {!file.is_dir && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-muted-foreground hover:text-primary active:scale-95 transition-all"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (activeSession) {
                                                                            const remotePath = activeSession.currentPath === '.' ? file.name : `${activeSession.currentPath}/${file.name}`;
                                                                            downloadFile(activeSession.id, remotePath, file.name);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Download className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                            {(file.is_content_editable || (!file.is_dir && file.name.toLowerCase().endsWith('.pdf'))) && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-muted-foreground hover:text-primary active:scale-95 transition-all"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (!file.is_dir && file.name.toLowerCase().endsWith('.pdf')) {
                                                                            handleOpenPdfViewer(file);
                                                                        } else {
                                                                            handleOpenEditor(file, true);
                                                                        }
                                                                    }}
                                                                    title={t('sftp.view')}
                                                                >
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                            {file.is_content_editable && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-muted-foreground hover:text-primary active:scale-95 transition-all"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenEditor(file, false);
                                                                    }}
                                                                    title={t('sftp.edit')}
                                                                >
                                                                    <Edit3 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-primary active:scale-95 transition-all"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenPermissionsDialog(file);
                                                                }}
                                                                title={t('sftp.editPermissions')}
                                                            >
                                                                <Shield className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-primary active:scale-95 transition-all"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenDialog('rename', file);
                                                                }}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive active:scale-95 transition-all"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenDialog('delete', file);
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredFiles.length === 0 && !activeSession.loading && (
                                                <TableRow className="hover:bg-transparent">
                                                    <TableCell colSpan={4} className="h-40 text-center text-muted-foreground text-sm italic opacity-50">
                                                        {t('sftp.noFiles')}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-5 bg-muted/5 p-12">
                            <div className="h-24 w-24 rounded-full bg-primary/5 flex items-center justify-center shadow-inner">
                                <HardDrive className="h-12 w-12 opacity-10" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-lg font-semibold text-foreground/80">{t('sftp.noSession')}</p>
                                <p className="text-sm opacity-60 max-w-xs leading-relaxed">
                                    {t('sftp.noSessionHint')}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Bottom Status Bar */}
            {activeSession && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 tracking-tight">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                activeSession.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                            )} />
                            <span className="font-semibold uppercase truncate max-w-[150px]">{activeSession.server?.name || 'Unknown'}</span>
                        </div>
                        <span className="opacity-40">|</span>
                        <span>{activeSession.files.length} {t('sftp.items')}</span>
                        <span className="opacity-40">|</span>
                        <span className="font-mono">{activeSession.currentPath}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="h-4 text-[9px] px-1 py-0 pointer-events-none opacity-50 uppercase">sftp v3</Badge>
                    </div>
                </div>
            )}

            {/* Operation Dialogs */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>
                            {operationType === 'create' && t('sftp.createFolderTitle')}
                            {operationType === 'rename' && t('sftp.renameTitle')}
                            {operationType === 'delete' && t('sftp.deleteTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {operationType === 'create' && t('sftp.createFolderDesc')}
                            {operationType === 'rename' && t('sftp.renameDesc', { name: operationTarget?.name })}
                            {operationType === 'delete' && t('sftp.deleteDesc', { name: operationTarget?.name })}
                        </DialogDescription>
                    </DialogHeader>

                    {(operationType === 'create' || operationType === 'rename') && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                    {t('sftp.name')}
                                </Label>
                                <Input
                                    id="name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="col-span-3"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleConfirmOperation();
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            {t('sftp.cancel')}
                        </Button>
                        <Button
                            variant={operationType === 'delete' ? "destructive" : "default"}
                            onClick={handleConfirmOperation}
                        >
                            {t('sftp.confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 权限编辑对话框 */}
            <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            {t('sftp.editPermissions')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('sftp.permissionsDialog.description', { name: permissionsTarget?.name || '' })}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground">
                            <div></div>
                            <div className="text-center">{t('sftp.permissionsDialog.read')}</div>
                            <div className="text-center">{t('sftp.permissionsDialog.write')}</div>
                            <div className="text-center">{t('sftp.permissionsDialog.execute')}</div>
                        </div>

                        {/* Owner */}
                        <div className="grid grid-cols-4 gap-4 items-center">
                            <Label className="text-sm font-medium">{t('sftp.permissionsDialog.owner')}</Label>
                            <div className="flex justify-center">
                                <Switch checked={ownerRead} onCheckedChange={setOwnerRead} />
                            </div>
                            <div className="flex justify-center">
                                <Switch checked={ownerWrite} onCheckedChange={setOwnerWrite} />
                            </div>
                            <div className="flex justify-center">
                                <Switch checked={ownerExecute} onCheckedChange={setOwnerExecute} />
                            </div>
                        </div>

                        {/* Group */}
                        <div className="grid grid-cols-4 gap-4 items-center">
                            <Label className="text-sm font-medium">{t('sftp.permissionsDialog.group')}</Label>
                            <div className="flex justify-center">
                                <Switch checked={groupRead} onCheckedChange={setGroupRead} />
                            </div>
                            <div className="flex justify-center">
                                <Switch checked={groupWrite} onCheckedChange={setGroupWrite} />
                            </div>
                            <div className="flex justify-center">
                                <Switch checked={groupExecute} onCheckedChange={setGroupExecute} />
                            </div>
                        </div>

                        {/* Others */}
                        <div className="grid grid-cols-4 gap-4 items-center">
                            <Label className="text-sm font-medium">{t('sftp.permissionsDialog.others')}</Label>
                            <div className="flex justify-center">
                                <Switch checked={othersRead} onCheckedChange={setOthersRead} />
                            </div>
                            <div className="flex justify-center">
                                <Switch checked={othersWrite} onCheckedChange={setOthersWrite} />
                            </div>
                            <div className="flex justify-center">
                                <Switch checked={othersExecute} onCheckedChange={setOthersExecute} />
                            </div>
                        </div>

                        {/* 权限预览 */}
                        <div className="mt-4 p-3 bg-muted/30 rounded-md">
                            <div className="text-xs text-muted-foreground mb-1">{t('sftp.permissionsDialog.preview')}</div>
                            <div className="font-mono text-sm">
                                {formatPermissions(
                                    (ownerRead ? 0o400 : 0) |
                                    (ownerWrite ? 0o200 : 0) |
                                    (ownerExecute ? 0o100 : 0) |
                                    (groupRead ? 0o040 : 0) |
                                    (groupWrite ? 0o020 : 0) |
                                    (groupExecute ? 0o010 : 0) |
                                    (othersRead ? 0o004 : 0) |
                                    (othersWrite ? 0o002 : 0) |
                                    (othersExecute ? 0o001 : 0),
                                    permissionsTarget?.is_dir || false
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPermissionsDialogOpen(false)}>
                            {t('sftp.cancel')}
                        </Button>
                        <Button onClick={handleSavePermissions}>
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {activeSession && editingFile && (
                <EditorModal
                    open={isEditorOpen}
                    onOpenChange={setIsEditorOpen}
                    sessionId={activeSession.id}
                    path={activeSession.currentPath === '.' ? editingFile.name : `${activeSession.currentPath}/${editingFile.name}`}
                    fileName={editingFile.name}
                    readOnly={isEditorReadOnly}
                />
            )}

            {activeSession && pdfFile && (
                <PdfViewerModal
                    open={isPdfViewerOpen}
                    onOpenChange={setIsPdfViewerOpen}
                    sessionId={activeSession.id}
                    path={activeSession.currentPath === '.' ? pdfFile.name : `${activeSession.currentPath}/${pdfFile.name}`}
                    fileName={pdfFile.name}
                />
            )}
        </div>
    );
}

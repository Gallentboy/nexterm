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
    Eye
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

    const activeSession = activeSessionId ? sessions[activeSessionId] : null;

    // Editor Modal States
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
    const [isEditorReadOnly, setIsEditorReadOnly] = useState(false);

    const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
    const [pdfFile, setPdfFile] = useState<FileEntry | null>(null);
    const sessionList = Object.values(sessions).filter(s => s && s.server);

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

    const handleNavigate = (entry: FileEntry) => {
        if (!activeSession || !entry.is_dir) return;
        const newPath = activeSession.currentPath === '.'
            ? entry.name
            : `${activeSession.currentPath}/${entry.name}`;
        listDir(activeSession.id, newPath);
    };

    const handleBack = () => {
        if (!activeSession) return;
        const parts = activeSession.currentPath.split('/');
        parts.pop();
        const newPath = parts.join('/') || '.';
        listDir(activeSession.id, newPath);
    };

    const filteredFiles = activeSession?.files.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

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
            toast.error('已有文件正在上传,请等待完成');
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
                                                        <h3 className="font-semibold text-sm">正在上传文件</h3>
                                                        <p className="text-[10px] text-muted-foreground truncate max-w-[240px]">
                                                            {activeSession.uploadingFileName}
                                                        </p>
                                                    </div>

                                                    <div className="w-full space-y-2">
                                                        <div className="flex justify-between text-[10px] font-mono">
                                                            <span className="text-muted-foreground">进度</span>
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
                                                        取消上传
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
                                                placeholder="搜索文件..."
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
                                            新建目录
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
                                            上传文件
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
                                                    <p className="text-lg font-semibold text-foreground">释放以上传文件</p>
                                                    <p className="text-sm text-muted-foreground">支持同时上传多个文件</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm shadow-border/10">
                                            <TableRow className="hover:bg-transparent border-border/40">
                                                <TableHead className="w-[450px] text-xs font-bold uppercase tracking-wider">文件名</TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider">大小</TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider">修改时间</TableHead>
                                                <TableHead className="text-right text-xs font-bold uppercase tracking-wider">操作</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredFiles.map((file) => (
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
                                                        目录为空或未找到相关文件
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
                        <span>{activeSession.files.length} 个项目</span>
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
                            {operationType === 'create' && "新建目录"}
                            {operationType === 'rename' && "重命名"}
                            {operationType === 'delete' && "确认删除"}
                        </DialogTitle>
                        <DialogDescription>
                            {operationType === 'create' && "请输入新目录的名称。"}
                            {operationType === 'rename' && `正在重命名 "${operationTarget?.name}"。`}
                            {operationType === 'delete' && `您确定要删除 "${operationTarget?.name}" 吗？此操作不可撤销。`}
                        </DialogDescription>
                    </DialogHeader>

                    {(operationType === 'create' || operationType === 'rename') && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                    名称
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
                            取消
                        </Button>
                        <Button
                            variant={operationType === 'delete' ? "destructive" : "default"}
                            onClick={handleConfirmOperation}
                        >
                            确定
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

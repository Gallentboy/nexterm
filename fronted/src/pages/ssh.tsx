import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal as TerminalIcon, Play, Settings, Maximize2, Minimize2, Monitor, X, Minus, Plus, Trash2, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { debug } from '@/utils/debug';
import { getServers, type Server } from '@/api/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSSH, type SSHSession } from '@/contexts/ssh-context';
import { cn } from '@/lib/utils';
import '@xterm/xterm/css/xterm.css';

export default function SSHPage() {
    const { t } = useTranslation();
    const { sessions, activeSessionId, setActiveSessionId, connect, disconnect } = useSSH();
    const [servers, setServers] = useState<Server[]>([]);
    const [selectedServerId, setSelectedServerId] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fontSize, setFontSize] = useState(14);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const terminalRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // 加载服务器列表
    useEffect(() => {
        const loadServers = async () => {
            try {
                const res = await getServers({ page_size: 1000 });
                setServers(res.items || []);
            } catch (error) {
                debug.error('[SSH] Failed to load servers:', error);
                toast.error(t('common.error'));
            }
        };
        loadServers();
    }, [t]);

    const activeSession = activeSessionId ? sessions[activeSessionId] : null;
    const activeServerId = activeSession?.server?.id?.toString() || selectedServerId;
    const selectedServer = servers.find(s => s && s.id?.toString() === activeServerId);
    const status = activeSession?.status || 'disconnected';
    const sessionList = Object.values(sessions).filter(s => s && s.server);

    // 处理终端挂载和重铺后的恢复
    useEffect(() => {
        if (!activeSessionId || !terminalRef.current) return;

        const session = sessions[activeSessionId];
        if (!session || !session.container) return;

        const container = terminalRef.current;
        if (container) {
            // 关键：将持久化的终端容器直接移动到当前页面的 DOM 树中
            if (session.container instanceof Node) {
                container.appendChild(session.container);
                session.terminal.focus();

                // 延迟触发 resize 计算
                const timer = setTimeout(() => {
                    session.fitAddon.fit();
                }, 100);

                const handleResize = () => session.fitAddon.fit();
                window.addEventListener('resize', handleResize);

                // 更新页面标题
                const originalTitle = document.title;
                if (session.server.name) {
                    document.title = `${session.server.name} - ${t('common.appTitle')}`;
                }

                return () => {
                    window.removeEventListener('resize', handleResize);
                    clearTimeout(timer);
                    document.title = originalTitle;
                    // 卸载时将容器移出，归还给 Context 持有，避免被 React 销毁
                    if (session.container instanceof Node && container.contains(session.container)) {
                        container.removeChild(session.container);
                    }
                };
            }
        }
    }, [activeSessionId, sessions, t]);

    // 当标签页切换时，同步该会话的字体大小到本地 UI 状态
    useEffect(() => {
        const session = activeSessionId ? sessions[activeSessionId] : null;
        if (session?.terminal) {
            const currentSize = session.terminal.options.fontSize;
            if (currentSize && currentSize !== fontSize) {
                setFontSize(currentSize);
            }
        }
    }, [activeSessionId, sessions]); // 移除 fontSize 依赖，仅在切换时同步

    // 当活动 session 改变时，同步选中的服务器
    useEffect(() => {
        if (activeSession?.server?.id) {
            setSelectedServerId(activeSession.server.id.toString());
        }
    }, [activeSession?.server?.id]);


    const updateFontSize = (newSize: number) => {
        if (activeSessionId && sessions[activeSessionId]) {
            const session = sessions[activeSessionId];
            session.terminal.options.fontSize = newSize;
            setFontSize(newSize);
            // 字体改变后需要重新计算尺寸
            setTimeout(() => session.fitAddon.fit(), 50);
        }
    };

    const handleConnect = async () => {
        const idToConnect = selectedServerId;
        if (!idToConnect) {
            toast.error(t('ssh.selectServer'));
            return;
        }
        const server = servers.find(s => s.id.toString() === idToConnect);
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

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
        if (activeSessionId && sessions[activeSessionId]) {
            // 延时略大于 CSS transition 的 300ms，确保 DOM 尺寸已经稳定
            setTimeout(() => {
                const session = sessions[activeSessionId];
                if (session) {
                    session.fitAddon.fit();
                }
            }, 400);
        }
    };

    // 辅助：获取同一服务器的会话编号
    const getSessionIndex = (session: SSHSession) => {
        if (!session?.server?.id) return '';
        const serverSessions = sessionList.filter(s => s?.server?.id === session.server.id);
        if (serverSessions.length <= 1) return '';
        const index = serverSessions.findIndex(s => s?.id === session.id);
        return index >= 0 ? ` #${index + 1}` : '';
    };

    // 搜索功能
    const handleSearch = (direction: 'next' | 'prev' = 'next') => {
        if (!activeSessionId || !sessions[activeSessionId] || !searchQuery) return;
        const session = sessions[activeSessionId];
        if (direction === 'next') {
            session.searchAddon.findNext(searchQuery, { caseSensitive: false, wholeWord: false });
        } else {
            session.searchAddon.findPrevious(searchQuery, { caseSensitive: false, wholeWord: false });
        }
    };

    // 快捷键监听
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+F / Ctrl+F 打开搜索
            if ((e.metaKey || e.ctrlKey) && e.key === 'f' && activeSessionId) {
                e.preventDefault();
                setShowSearch(true);
                setTimeout(() => searchInputRef.current?.focus(), 100);
            }
            // Esc 关闭搜索
            if (e.key === 'Escape' && showSearch) {
                setShowSearch(false);
                setSearchQuery('');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeSessionId, showSearch]);

    return (
        <div className={cn(
            "flex flex-col gap-4 transition-all duration-300",
            isFullscreen
                ? "fixed inset-0 z-50 bg-background p-0"
                : "container mx-auto p-6 flex-1 min-h-0"
        )}>
            {/* 顶栏控制区 */}
            {!isFullscreen && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <TerminalIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">
                                {activeSession?.server?.name || selectedServer?.name || t('ssh.title')}
                            </h1>
                            <p className="text-muted-foreground mt-1">{t('ssh.terminal')}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                            <SelectTrigger className="w-[180px] h-9 border-none bg-muted/50 hover:bg-muted transition-colors text-xs">
                                <SelectValue placeholder={t('ssh.selectServer')} />
                            </SelectTrigger>
                            <SelectContent>
                                {servers.map((server) => (
                                    <SelectItem key={server.id} value={server.id.toString()}>
                                        {server.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button size="sm" onClick={handleConnect} className="h-9 px-4" disabled={!selectedServerId}>
                            <Play className="mr-2 h-3.5 w-3.5" />
                            {t('ssh.connect')}
                        </Button>

                        {activeSessionId && (
                            <Button variant="outline" size="icon" className="h-9 w-9 border-none bg-muted/50" onClick={toggleFullscreen}>
                                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <Card className={cn(
                "flex-1 overflow-hidden border flex flex-col relative transition-all duration-300",
                isFullscreen
                    ? "rounded-none h-full border-none shadow-none"
                    : "rounded-2xl bg-card border-border/60 shadow-sm dark:shadow-2xl dark:border-border"
            )}>
                {/* 扁平化风格的集成式标签栏 */}
                {sessionList.length > 0 && (
                    <div className="flex items-center bg-muted/20 border-b border-border/40 overflow-x-auto no-scrollbar shrink-0">
                        {sessionList.map((session) => (
                            <div
                                key={session.id}
                                onClick={() => {
                                    setActiveSessionId(session.id);
                                    setSelectedServerId(session.server.id.toString());
                                }}
                                className={cn(
                                    "group flex items-center gap-2 px-5 py-3 cursor-pointer transition-all border-r border-border/50 text-xs font-semibold min-w-[140px] max-w-[240px] relative",
                                    activeSessionId === session.id
                                        ? "bg-background text-foreground"
                                        : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                )}
                            >
                                {/* 活跃指示线 */}
                                {activeSessionId === session.id && (
                                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
                                )}

                                <div className={cn(
                                    "h-2 w-2 rounded-full shrink-0",
                                    session.status === 'connected' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-yellow-500"
                                )} />
                                <span className="truncate flex-1 tracking-wide">{session.server.name}{getSessionIndex(session)}</span>
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

                        {isFullscreen && (
                            <div className="ml-auto flex items-center pr-4">
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={toggleFullscreen}>
                                    <Minimize2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                <CardContent className="p-0 flex-1 relative min-h-0">
                    {/* 搜索面板 */}
                    {showSearch && activeSessionId && (
                        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 animate-in fade-in slide-in-from-top-2">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSearch(e.shiftKey ? 'prev' : 'next');
                                    }
                                }}
                                placeholder={t('common.search')}
                                className="w-48 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/50"
                            />
                            <div className="flex items-center gap-1 border-l border-border pl-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleSearch('prev')}
                                    disabled={!searchQuery}
                                >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleSearch('next')}
                                    disabled={!searchQuery}
                                >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-1"
                                onClick={() => {
                                    setShowSearch(false);
                                    setSearchQuery('');
                                }}
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}

                    <div
                        ref={terminalRef}
                        className="absolute inset-0 p-4"
                        style={{ background: 'transparent' }} // 终端容器背景由 xterm 内部决定
                    />
                    {!activeSessionId && (
                        <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-4 bg-muted/5">
                            <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center">
                                <Monitor className="h-10 w-10 opacity-10" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium">{t('ssh.selectServer')}</p>
                                <p className="text-xs opacity-50 mt-1">{t('ssh.selectServerHint')}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 状态栏 */}
            {!isFullscreen && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className={cn(
                                "h-2 w-2 rounded-full",
                                status === 'connected' ? 'bg-green-500 animate-pulse outline outline-offset-2 outline-green-500/20' :
                                    status === 'connecting' ? 'bg-yellow-500 animate-bounce' : 'bg-slate-500'
                            )} />
                            <span className="capitalize">{status}</span>
                        </div>
                        {status === 'connected' && (
                            <span className="font-mono opacity-60">UTF-8 • xterm-256color • Active Session</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-primary transition-colors">
                                    <Settings className="h-3.5 w-3.5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3" align="end" side="top">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            {t('ssh.terminalSettings', '终端设置')}
                                        </h4>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm">{t('ssh.fontSize', '字体大小')}</span>
                                            <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateFontSize(Math.max(10, fontSize - 1))}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="text-xs font-mono w-6 text-center">{fontSize}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateFontSize(Math.min(32, fontSize + 1))}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-border/50">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full justify-start text-xs h-8"
                                            onClick={() => {
                                                activeSession?.terminal?.clear();
                                                activeSession?.terminal?.focus();
                                            }}
                                        >
                                            <Trash2 className="mr-2 h-3 w-3" />
                                            {t('ssh.clearScreen', '清屏')}
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            )}
        </div>
    );
}

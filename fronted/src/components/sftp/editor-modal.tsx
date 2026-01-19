import { useState, useEffect, useRef, useCallback } from 'react';
import type { editor } from 'monaco-editor';
import Editor from '@monaco-editor/react';
import { initVimMode } from 'monaco-vim';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Save, X, Loader2, FileText, Code, Settings, Wand2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useSFTP } from '@/contexts/sftp-context';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';

interface EditorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionId: string;
    path: string;
    fileName: string;
    readOnly?: boolean;
}

export function EditorModal({ open, onOpenChange, sessionId, path, fileName, readOnly = false }: EditorModalProps) {
    const { t } = useTranslation();
    const { readFile, saveFile } = useSFTP();
    const { theme } = useTheme();
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [language, setLanguage] = useState('plaintext');
    const [isVimEnabled, setIsVimEnabled] = useState(false);

    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const vimAdapterRef = useRef<any>(null);
    const statusBarRef = useRef<HTMLDivElement>(null);

    const editorTheme = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs-light')
        : (theme === 'dark' ? 'vs-dark' : 'vs-light');

    useEffect(() => {
        if (open && sessionId && path) {
            loadContent();
            detectLanguage();
        }
    }, [open, sessionId, path]);

    const detectLanguage = () => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const langMap: Record<string, string> = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'md': 'markdown',
            'py': 'python',
            'sh': 'shell',
            'yml': 'yaml',
            'yaml': 'yaml',
            'toml': 'toml',
            'xml': 'xml',
            'rs': 'rust',
            'go': 'go',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'sql': 'sql',
            'env': 'properties',
            'conf': 'properties',
            'ini': 'ini',
            'log': 'plaintext',
            'php': 'php',
            'rb': 'ruby',
            'lua': 'lua',
            'swift': 'swift',
            'kt': 'kotlin',
            'kts': 'kotlin',
            'dart': 'dart',
            'scala': 'scala',
            'pl': 'perl',
            'r': 'r',
            'cs': 'csharp',
            'm': 'objective-c',
            'mm': 'objective-c',
            'hs': 'haskell',
            'clj': 'clojure',
            'ex': 'elixir',
            'exs': 'elixir',
            'erl': 'erlang',
            'fs': 'fsharp',
        };
        if (ext && langMap[ext]) {
            setLanguage(langMap[ext]);
        } else {
            setLanguage('plaintext');
        }
    };

    const loadContent = async () => {
        try {
            setLoading(true);
            const data = await readFile(sessionId, path);
            setContent(data);
        } catch (error: any) {
            toast.error(t('sftp.readFailed') + ': ' + error.message);
            onOpenChange(false);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (readOnly) {
            toast.error(t('sftp.saveFailed') + ': ' + 'Read-only mode');
            return;
        }
        try {
            setSaving(true);
            await saveFile(sessionId, path, content);
        } catch (error: any) {
            toast.error(t('sftp.saveFailed') + ': ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleFormat = () => {
        if (editorRef.current) {
            editorRef.current.getAction('editor.action.formatDocument')?.run();
        }
    };

    const handleSearch = () => {
        if (editorRef.current) {
            editorRef.current.getAction('editor.action.startFindReplaceAction')?.run();
        }
    };

    const toggleVim = useCallback(() => {
        if (!editorRef.current || !statusBarRef.current) return;

        if (isVimEnabled) {
            if (vimAdapterRef.current) {
                vimAdapterRef.current.dispose();
                vimAdapterRef.current = null;
            }
            setIsVimEnabled(false);
        } else {
            vimAdapterRef.current = initVimMode(editorRef.current, statusBarRef.current);
            setIsVimEnabled(true);
        }
    }, [isVimEnabled]);

    const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: any) => {
        editorRef.current = editor;

        // Add Save Shortcut (Cmd+S / Ctrl+S)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            handleSave();
        });

        if (isVimEnabled && statusBarRef.current) {
            vimAdapterRef.current = initVimMode(editor, statusBarRef.current);
        }
    };

    useEffect(() => {
        return () => {
            if (vimAdapterRef.current) {
                vimAdapterRef.current.dispose();
            }
        };
    }, []);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-none sm:max-w-none w-screen h-screen p-0 gap-0 overflow-hidden border-none shadow-none rounded-none bg-background/95 backdrop-blur-xl flex flex-col top-0 left-0 translate-x-0 translate-y-0"
                showCloseButton={false}
                onKeyDown={(e) => {
                    // Prevent closing dialog on Escape if Vim is active
                    if (e.key === 'Escape' && isVimEnabled) {
                        e.stopPropagation();
                    }
                }}
            >
                <DialogHeader className="px-6 py-4 border-b bg-muted/30 flex flex-row items-center justify-between shrink-0 h-16 space-y-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            {language === 'plaintext' ? <FileText className="h-5 w-5 text-primary" /> : <Code className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold tracking-tight truncate max-w-[400px]">
                                {fileName}
                            </DialogTitle>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest bg-muted px-1.5 py-0.5 rounded leading-none">
                                    {language}
                                </span>
                                {readOnly && (
                                    <span className="text-[10px] uppercase font-bold text-amber-500/80 tracking-widest bg-amber-500/10 px-1.5 py-0.5 rounded leading-none border border-amber-500/20">
                                        Read Only
                                    </span>
                                )}
                                <span className="text-[10px] text-muted-foreground/40 font-mono leading-none">
                                    {path}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pr-8">
                        <Button
                            variant={isVimEnabled ? "default" : "outline"}
                            size="sm"
                            onClick={toggleVim}
                            className={cn(
                                "h-9 px-3 gap-2 transition-all active:scale-95",
                                isVimEnabled
                                    ? "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                                    : "border-border/40 text-muted-foreground hover:bg-muted font-normal"
                            )}
                        >
                            <Settings className={cn("h-3.5 w-3.5", isVimEnabled && "animate-spin-slow")} />
                            <span className="text-xs">Vim Mode: {isVimEnabled ? 'On' : 'Off'}</span>
                        </Button>
                        {!readOnly && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleFormat}
                                className="h-9 w-9 border-border/40 hover:bg-primary/10 hover:text-primary transition-all active:scale-95 shrink-0"
                                title="Format Document (Ctrl+Shift+F)"
                            >
                                <Wand2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleSearch}
                            className="h-9 w-9 border-border/40 hover:bg-primary/10 hover:text-primary transition-all active:scale-95 shrink-0"
                            title="Find and Replace (Ctrl+H)"
                        >
                            <Search className="h-4 w-4" />
                        </Button>
                        {!readOnly && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 h-9 px-4 gap-2 transition-all active:scale-95"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {t('common.save')}
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onOpenChange(false)}
                            className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className={cn(
                    "flex-1 relative min-h-0",
                    editorTheme === 'vs-dark' ? "bg-[#1e1e1e]" : "bg-[#fffffe]"
                )}>
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/50 backdrop-blur-sm z-50">
                            <div className="relative">
                                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                                <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground animate-pulse">{t('common.loading')}</p>
                        </div>
                    ) : (
                        <Editor
                            height="100%"
                            language={language}
                            theme={editorTheme}
                            value={content}
                            onMount={handleEditorDidMount}
                            onChange={(value) => setContent(value || '')}
                            options={{
                                minimap: { enabled: true },
                                fontSize: 14,
                                fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', monospace",
                                lineNumbers: 'on',
                                roundedSelection: true,
                                scrollBeyondLastLine: false,
                                readOnly: readOnly,
                                automaticLayout: true,
                                cursorSmoothCaretAnimation: 'on',
                                cursorBlinking: 'smooth',
                                smoothScrolling: true,
                                padding: { top: 16, bottom: 16 },
                                bracketPairColorization: { enabled: true },
                            }}
                        />
                    )}
                </div>

                <div
                    ref={statusBarRef}
                    className={cn(
                        "px-4 py-1.5 border-t text-[12px] font-mono tracking-wide min-h-[28px] flex items-center transition-all duration-200",
                        !isVimEnabled ? "h-0 py-0 border-t-0 overflow-hidden opacity-0" : "h-auto opacity-100",
                        isVimEnabled && (editorTheme === 'vs-dark' ? "bg-[#007acc] text-white" : "bg-muted text-muted-foreground border-t-border/50")
                    )}
                />

                <div className="px-4 py-2 bg-muted/30 border-t flex items-center justify-between text-[11px] text-muted-foreground tracking-tight h-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                readOnly ? "bg-amber-500" : "bg-green-500"
                            )} />
                            <span className="font-semibold uppercase">
                                {readOnly ? 'Viewer Mode' : 'Editor Mode'}
                            </span>
                        </div>
                        <span className="opacity-40">|</span>
                        <span>UTF-8</span>
                        <span className="opacity-40">|</span>
                        <span>Lines: {content.split('\n').length}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono opacity-50">Monaco Engine v0.55.1</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Loader2, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useSFTP } from '@/contexts/sftp-context';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface PdfViewerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionId: string;
    path: string;
    fileName: string;
}

export function PdfViewerModal({ open, onOpenChange, sessionId, path, fileName }: PdfViewerModalProps) {
    const { t } = useTranslation();
    const { getFileBlob, downloadFile } = useSFTP();
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const defaultLayoutPluginInstance = defaultLayoutPlugin();

    useEffect(() => {
        let currentUrl: string | null = null;

        const loadPdf = async () => {
            try {
                setLoading(true);
                const blob = await getFileBlob(sessionId, path);
                currentUrl = URL.createObjectURL(blob);
                setFileUrl(currentUrl);
            } catch (error: any) {
                toast.error(t('sftp.readFailed') + ': ' + error.message);
                onOpenChange(false);
            } finally {
                setLoading(false);
            }
        };

        if (open && sessionId && path) {
            loadPdf();
        }

        return () => {
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
                setFileUrl(null);
            }
        };
    }, [open, sessionId, path, getFileBlob, onOpenChange, t]);

    const handleDownload = () => {
        downloadFile(sessionId, path, fileName);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-none sm:max-w-none w-screen h-screen p-0 gap-0 overflow-hidden border-none shadow-none rounded-none bg-background/95 backdrop-blur-xl flex flex-col top-0 left-0 translate-x-0 translate-y-0 z-[100]"
                showCloseButton={false}
            >
                <DialogHeader className="px-6 py-4 border-b bg-muted/30 flex flex-row items-center justify-between shrink-0 h-16 space-y-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold tracking-tight truncate max-w-[400px]">
                                {fileName}
                            </DialogTitle>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest bg-muted px-1.5 py-0.5 rounded leading-none">
                                    PDF Document
                                </span>
                                <span className="text-[10px] text-muted-foreground/40 font-mono leading-none">
                                    {path}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pr-8">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownload}
                            className="h-9 px-4 gap-2 border-border/40 hover:bg-muted transition-all active:scale-95"
                        >
                            <Download className="h-4 w-4" />
                            <span>{t('common.download')}</span>
                        </Button>
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

                <div className="flex-1 relative min-h-0 bg-[#525659]">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/50 backdrop-blur-sm z-50">
                            <div className="relative">
                                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                                <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground animate-pulse">{t('common.loading')}</p>
                        </div>
                    ) : fileUrl && (
                        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                            <div className="h-full w-full">
                                <Viewer
                                    fileUrl={fileUrl}
                                    plugins={[defaultLayoutPluginInstance]}
                                    theme={{
                                        theme: 'dark'
                                    }}
                                />
                            </div>
                        </Worker>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

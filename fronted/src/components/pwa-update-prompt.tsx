import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';

export default function PWAUpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false);

    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('[PWA] Service Worker 已注册');
            // 每小时检查一次更新
            r && setInterval(() => {
                r.update();
            }, 60 * 60 * 1000);
        },
        onRegisterError(error) {
            console.error('[PWA] Service Worker 注册失败:', error);
        },
    });

    useEffect(() => {
        if (offlineReady) {
            console.log('[PWA] 应用已准备好离线使用');
        }
        if (needRefresh) {
            setShowPrompt(true);
        }
    }, [offlineReady, needRefresh]);

    const close = () => {
        setShowPrompt(false);
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    const handleUpdate = () => {
        updateServiceWorker(true);
        setShowPrompt(false);
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
            <Card className="w-80 shadow-2xl border-2 border-primary/20 bg-card">
                <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <RefreshCw className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">发现新版本</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    点击更新以获取最新功能
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={close}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleUpdate}
                            className="flex-1 gap-2"
                            size="sm"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            立即更新
                        </Button>
                        <Button
                            onClick={close}
                            variant="outline"
                            size="sm"
                        >
                            稍后
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}

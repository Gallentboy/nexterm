import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, ClipboardPaste } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TerminalContextMenuProps {
    /** 获取当前选中的文本 */
    getSelectedText: () => string;
    /** 粘贴回调 */
    onPaste: (text: string) => void;
    /** 恢复终端焦点 */
    onFocus?: () => void;
    /** 终端容器的 ref */
    containerRef: React.RefObject<HTMLDivElement | null>;
}

interface MenuPosition {
    x: number;
    y: number;
}

/**
 * 终端右键上下文菜单组件
 * 
 * @author zhangyue
 * @date 2026-01-26
 */
export function TerminalContextMenu({ getSelectedText, onPaste, onFocus, containerRef }: TerminalContextMenuProps) {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });

    const handleContextMenu = useCallback((e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 计算菜单位置，确保不超出视口
        const menuWidth = 140;
        const menuHeight = 80;
        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 8;
        }
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 8;
        }

        setPosition({ x, y });
        setVisible(true);
    }, []);

    const handleClick = useCallback(() => {
        setVisible(false);
    }, []);

    const handleCopy = useCallback(async () => {
        const selectedText = getSelectedText();
        if (selectedText) {
            await navigator.clipboard.writeText(selectedText);
        }
        setVisible(false);
        onFocus?.();
    }, [getSelectedText, onFocus]);

    const handlePaste = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                onPaste(text);
            }
        } catch (err) {
            console.error('Failed to read clipboard:', err);
        }
        setVisible(false);
        onFocus?.();
    }, [onPaste, onFocus]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('click', handleClick);
        document.addEventListener('contextmenu', handleClick);

        return () => {
            container.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('click', handleClick);
            document.removeEventListener('contextmenu', handleClick);
        };
    }, [containerRef, handleContextMenu, handleClick]);

    if (!visible) return null;

    return (
        <div
            className={cn(
                "fixed z-[9999] min-w-[120px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg",
                "animate-in fade-in-0 zoom-in-95 duration-100"
            )}
            style={{ left: position.x, top: position.y }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                onClick={handleCopy}
                className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors cursor-pointer",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground"
                )}
            >
                <Copy className="h-4 w-4" />
                <span>{t('common.copy', '复制')}</span>
            </button>
            <button
                onClick={handlePaste}
                className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors cursor-pointer",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground"
                )}
            >
                <ClipboardPaste className="h-4 w-4" />
                <span>{t('common.paste', '粘贴')}</span>
            </button>
        </div>
    );
}

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import type { ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SearchAddon } from '@xterm/addon-search';
import * as Zmodem from 'zmodem.js/src/zmodem_browser';
import { type Server } from '@/api/server';
import { toast } from 'sonner';
import { useTheme } from './theme-context';
import { getWebSocketUrl } from '@/utils/websocket';
import { debug } from '@/utils/debug';
import '@xterm/xterm/css/xterm.css';

// Zmodem 辅助函数
const saveFile = async (session: any, term: Terminal) => {
    debug.log('[Zmodem] saveFile called with session:', session);

    return new Promise<void>((resolve, reject) => {
        session.on('offer', (xfer: any) => {
            debug.log('[Zmodem] Received offer event, xfer:', xfer);
            const details = xfer.get_details();
            const fileName = details.name;
            const fileSize = details.size || 0;
            debug.log('[Zmodem] File details:', details);
            toast.info(`正在接收文件: ${fileName}`);

            const buffer: Uint8Array[] = [];
            let receivedBytes = 0;
            let lastProgressUpdate = 0;
            let lastProgressBytes = 0;
            const startTime = Date.now();

            // 接受传输
            xfer.accept().then(
                () => {
                    debug.log('[Zmodem] Transfer accepted, starting to receive data');
                },
                (err: Error) => {
                    debug.error('[Zmodem] Accept failed:', err);
                    reject(err);
                }
            );

            // 监听数据输入
            xfer.on('input', (chunk: Uint8Array) => {
                debug.log('[Zmodem] Received chunk, size:', chunk.length);
                buffer.push(new Uint8Array(chunk));
                receivedBytes += chunk.length;

                // 每接收 500ms 更新一次进度
                const now = Date.now();
                if (fileSize > 0 && (now - lastProgressUpdate > 500 || receivedBytes >= fileSize)) {
                    const progress = Math.min(100, Math.round((receivedBytes / fileSize) * 100));
                    const mbReceived = (receivedBytes / 1024 / 1024).toFixed(2);
                    const mbTotal = (fileSize / 1024 / 1024).toFixed(2);

                    // 计算速度
                    const timeDiff = (now - (lastProgressUpdate || startTime)) / 1000; // 秒
                    const bytesDiff = receivedBytes - lastProgressBytes;
                    const speed = timeDiff > 0 ? (bytesDiff / 1024 / 1024 / timeDiff).toFixed(2) : '0.00';

                    // 在终端显示进度
                    term.write(`\r\x1b[1;36m[Zmodem] 下载: ${progress}% (${mbReceived}MB / ${mbTotal}MB) ${speed}MB/s\x1b[0m`);
                    lastProgressUpdate = now;
                    lastProgressBytes = receivedBytes;
                }
            });

            // 监听传输完成
            xfer.on('complete', () => {
                debug.log('[Zmodem] Transfer complete, total chunks:', buffer.length);
                // 清除进度行
                term.write('\r\x1b[K');

                const blob = new Blob(buffer as BlobPart[]);
                debug.log('[Zmodem] Blob created, size:', blob.size);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);

                const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
                toast.success(`文件接收完成: ${fileName} (${sizeMB}MB)`);
                resolve();
            });
        });

        // 监听会话完成
        session.on('session_end', () => {
            debug.log('[Zmodem] Session ended');
            resolve();
        });

        // 启动会话 - 这是关键！
        debug.log('[Zmodem] Starting session...');
        session.start();
    });
};

const sendFile = async (session: any, files: FileList, term: Terminal) => {
    // 禁用终端输入
    term.attachCustomKeyEventHandler(() => false);

    try {
        // 添加会话事件监听器
        session.on('session_end', () => {
            debug.log('[Zmodem] Send session ended');
        });

        for (const file of Array.from(files)) {
            debug.log('[Zmodem] Preparing to send file:', file.name);
            const buffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(buffer);

            debug.log('[Zmodem] Sending offer for file:', file.name, 'size:', file.size);

            const offer = {
                name: file.name,
                size: file.size,
                mtime: new Date(file.lastModified),
                mode: 0o100644,
                files_remaining: files.length,
                bytes_remaining: file.size
            };

            try {
                debug.log('[Zmodem] Calling send_offer with:', offer);

                // send_offer 返回 Promise<Transfer | undefined>
                const xfer = await session.send_offer(offer);
                debug.log('[Zmodem] send_offer returned:', xfer);

                if (!xfer) {
                    debug.log('[Zmodem] File skipped by receiver:', file.name);
                    toast.warning(`文件被服务器跳过: ${file.name}，可能文件已存在或被拒绝`);
                    continue;
                }

                debug.log('[Zmodem] Offer accepted, sending data...');
                toast.info(`正在发送文件: ${file.name}`);

                // 分块发送数据 - 每次只转换一个块，并显示进度
                const chunkSize = 2 * 1024 * 1024; // 2MB
                let sentBytes = 0;
                let lastProgressUpdate = 0;
                let lastProgressBytes = 0;
                const startTime = Date.now();

                for (let offset = 0; offset < uint8Array.length; offset += chunkSize) {
                    const chunk = uint8Array.slice(offset, offset + chunkSize);

                    // 只转换当前块为 Array
                    await xfer.send(Array.from(chunk));

                    sentBytes += chunk.length;

                    // 更新进度 - 每 300ms 更新一次
                    const now = Date.now();
                    const shouldUpdate = (now - lastProgressUpdate > 300) ||
                        (sentBytes === chunk.length) || // 第一个块
                        (sentBytes >= uint8Array.length);

                    if (shouldUpdate) {
                        const progress = Math.min(100, Math.round((sentBytes / uint8Array.length) * 100));
                        const mbSent = (sentBytes / 1024 / 1024).toFixed(2);
                        const mbTotal = (uint8Array.length / 1024 / 1024).toFixed(2);

                        // 计算速度
                        const timeDiff = (now - (lastProgressUpdate || startTime)) / 1000;
                        const bytesDiff = sentBytes - lastProgressBytes;
                        const speed = timeDiff > 0 ? (bytesDiff / 1024 / 1024 / timeDiff).toFixed(2) : '0.00';

                        // 在同一行更新进度
                        term.write(`\r\x1b[K\x1b[1;36m[Zmodem] 上传: ${progress}% (${mbSent}MB / ${mbTotal}MB) ${speed}MB/s\x1b[0m`);
                        lastProgressUpdate = now;
                        lastProgressBytes = sentBytes;

                        // 让出控制权给浏览器，允许 UI 更新
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }

                // 完成后换行
                term.writeln('');

                // 结束传输
                await xfer.end();
                debug.log('[Zmodem] File sent successfully:', file.name);
                const sizeMB = (uint8Array.length / 1024 / 1024).toFixed(2);
                toast.success(`文件发送完成: ${file.name} (${sizeMB}MB)`);

            } catch (err) {
                debug.error('[Zmodem] Error sending file:', err);
                throw err;
            }
        }
    } finally {
        // 恢复终端输入
        term.attachCustomKeyEventHandler(() => true);
    }
};

export type SSHStatus = 'disconnected' | 'connecting' | 'connected';

export interface SSHSession {
    id: string;
    server: Server;
    status: SSHStatus;
    terminal: Terminal;
    fitAddon: FitAddon;
    searchAddon: SearchAddon;
    socket: WebSocket | null;
    container: HTMLDivElement; // 持久化容器
}

interface SSHContextType {
    sessions: Record<string, SSHSession>;
    activeSessionId: string | null;
    setActiveSessionId: (id: string | null) => void;
    connect: (server: Server) => Promise<void>;
    disconnect: (serverId: string) => void;
}

const SSHContext = createContext<SSHContextType | undefined>(undefined);

// 获取与当前主题匹配的 xterm 配置
const getTerminalTheme = (theme: string, color: string): ITheme => {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // 基础颜色定义 (适配 Tailwind 配置)
    const colors: Record<string, string> = {
        zinc: isDark ? '#3f3f46' : '#71717a',
        blue: '#3b82f6',
        green: '#22c55e',
        rose: '#f43f5e',
        orange: '#f97316',
    };

    const primaryColor = colors[color] || colors.blue;

    if (isDark) {
        return {
            background: '#0f172a', // slate-900 风格
            foreground: '#cbd5e1', // slate-300
            cursor: primaryColor,
            selectionBackground: `${primaryColor}4d`, // 30% opacity
            black: '#1e293b',
            red: '#ef4444',
            green: '#22c55e',
            yellow: '#eab308',
            blue: '#3b82f6',
            magenta: '#a855f7',
            cyan: '#06b6d4',
            white: '#f8fafc',
        };
    } else {
        return {
            background: '#ffffff',
            foreground: '#334155', // slate-700
            cursor: primaryColor,
            selectionBackground: `${primaryColor}4d`,
            black: '#f1f5f9',
            red: '#dc2626',
            green: '#16a34a',
            yellow: '#d97706',
            blue: '#2563eb',
            magenta: '#9333ea',
            cyan: '#0891b2',
            white: '#0f172a',
        };
    }
};

export function SSHProvider({ children }: { children: React.ReactNode }) {
    const [sessions, setSessions] = useState<Record<string, SSHSession>>({});
    const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
    const sessionsRef = useRef<Record<string, SSHSession>>({});
    const { theme, color } = useTheme();

    // 当全局主题改变时，同步更新所有现有终端的主题
    useEffect(() => {
        const newTheme = getTerminalTheme(theme, color);
        Object.values(sessionsRef.current).forEach(session => {
            session.terminal.options.theme = newTheme;
        });
    }, [theme, color]);

    // 辅助函数：更新状态
    const updateSession = useCallback((id: string, updates: Partial<SSHSession>) => {
        setSessions(prev => {
            const next = {
                ...prev,
                [id]: { ...prev[id], ...updates }
            };
            sessionsRef.current = next;
            return next;
        });
    }, []);

    const connect = useCallback(async (server: Server) => {
        const id = `${server.id}-${Date.now()}`;

        // 初始化 Terminal
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: '"Cascadia Code", Menlo, Monaco, "Courier New", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", monospace',
            theme: getTerminalTheme(theme, color),
            allowProposedApi: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        const searchAddon = new SearchAddon();
        term.loadAddon(searchAddon);

        term.loadAddon(new WebLinksAddon());
        const unicode11Addon = new Unicode11Addon();
        term.loadAddon(unicode11Addon);
        term.unicode.activeVersion = '11';

        const wsUrl = getWebSocketUrl('/ssh');

        const socket = new WebSocket(wsUrl);
        socket.binaryType = 'arraybuffer';

        const container = document.createElement('div');
        container.style.width = '100%';
        container.style.height = '100%';

        term.open(container);

        const session: SSHSession = {
            id,
            server,
            status: 'connecting',
            terminal: term,
            fitAddon,
            searchAddon,
            socket,
            container
        };

        setSessions(prev => ({ ...prev, [id]: session }));
        sessionsRef.current = { ...sessionsRef.current, [id]: session };
        setActiveSessionIdState(id);

        // Zmodem 传输标志
        let zmodemActive = false;

        term.onData((data) => {
            // Zmodem 传输期间阻止用户输入
            if (zmodemActive) {
                return;
            }
            const s = sessionsRef.current[id];
            if (s?.socket?.readyState === WebSocket.OPEN) {
                s.socket.send(JSON.stringify({ type: 'Input', data }));
            }
        });

        term.onResize((size) => {
            const s = sessionsRef.current[id];
            if (s?.socket?.readyState === WebSocket.OPEN) {
                s.socket.send(JSON.stringify({
                    type: 'Resize',
                    cols: size.cols,
                    rows: size.rows
                }));
            }
        });

        socket.onopen = () => {
            updateSession(id, { status: 'connected' });
            term.writeln(`\x1b[1;34m  ➜  \x1b[0mConnecting to ${server.name} (${server.host})...`);

            const params = {
                server_id: server.id,
                mode: 'shell',
                term: 'xterm-256color',
                cols: term.cols || 80,
                rows: term.rows || 24,
                env: {
                    LANG: 'zh_CN.UTF-8',
                    LC_ALL: 'zh_CN.UTF-8'
                }
            };
            socket.send(JSON.stringify(params));
            term.writeln('\x1b[1;32m  ➜  Connected successfully.\x1b[0m\r\n');
        };

        // Zmodem 检测器
        let zmodemSentry: any = null;
        let zmodemSession: any = null;

        socket.onmessage = (event) => {
            if (typeof event.data === 'string') {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'Error') {
                        term.writeln(`\r\n\x1b[31mError: ${msg.message}\x1b[0m`);
                        toast.error(`SSH Error: ${msg.message}`);
                        updateSession(id, { status: 'disconnected' });
                    } else if (msg.type === 'Closed') {
                        term.writeln('\r\n\x1b[1;31m  ➜  Connection closed by server.\x1b[0m');
                        updateSession(id, { status: 'disconnected' });
                    }
                } catch (e) {
                    term.write(event.data);
                }
            } else {
                // 二进制数据 - 检测 Zmodem
                const data = new Uint8Array(event.data);
                // Zmodem.js 需要 Array 而不是 Uint8Array
                const dataArray = Array.from(data);

                if (!zmodemSentry) {
                    zmodemSentry = new Zmodem.Sentry({
                        to_terminal: (octets: ArrayLike<number>) => {
                            term.write(new Uint8Array(octets));
                        },
                        sender: (octets: ArrayLike<number>) => {
                            socket.send(new Uint8Array(octets));
                        },
                        on_retract: () => {
                            // Zmodem 会话结束
                            zmodemSession = null;
                        },
                        on_detect: (detection: any) => {
                            // 检测到 Zmodem 会话
                            zmodemSession = detection.confirm();

                            // 设置 Zmodem 传输标志，阻止用户输入
                            zmodemActive = true;

                            if (zmodemSession.type === 'receive') {
                                // sz - 服务器发送，浏览器接收（下载）
                                term.writeln('\r\n\x1b[1;33m[Zmodem] 检测到 sz 传输，正在接收文件...\x1b[0m\r\n');
                                saveFile(zmodemSession, term).then(() => {
                                    debug.log('[Zmodem] saveFile completed');
                                    // session_end 事件会自动触发，不需要手动 close
                                    if (zmodemSession && typeof zmodemSession.close === 'function') {
                                        try {
                                            zmodemSession.close();
                                        } catch (e) {
                                            debug.log('[Zmodem] Session already closed');
                                        }
                                    }
                                    zmodemSession = null;
                                    zmodemActive = false; // 恢复输入
                                }).catch((err: Error) => {
                                    debug.error('[Zmodem] saveFile failed:', err);
                                    toast.error(`文件接收失败: ${err.message}`);
                                    if (zmodemSession) {
                                        zmodemSession.abort();
                                        zmodemSession = null;
                                    }
                                    zmodemActive = false; // 恢复输入
                                });
                            } else if (zmodemSession.type === 'send') {
                                // rz - 浏览器发送，服务器接收（上传）
                                term.writeln('\r\n\x1b[1;33m[Zmodem] 检测到 rz 请求，请选择要上传的文件...\x1b[0m\r\n');

                                const input = document.createElement('input');
                                input.type = 'file';
                                input.multiple = true;
                                input.onchange = () => {
                                    if (input.files && input.files.length > 0) {
                                        sendFile(zmodemSession, input.files, term).then(() => {
                                            debug.log('[Zmodem] sendFile completed');
                                            // session_end 事件会自动触发，不需要手动 close
                                            if (zmodemSession && typeof zmodemSession.close === 'function') {
                                                try {
                                                    zmodemSession.close();
                                                } catch (e) {
                                                    debug.log('[Zmodem] Session already closed');
                                                }
                                            }
                                            zmodemSession = null;
                                            zmodemActive = false; // 恢复输入
                                        }).catch((err: Error) => {
                                            debug.error('[Zmodem] sendFile failed:', err);
                                            toast.error(`文件发送失败: ${err.message}`);
                                            if (zmodemSession) {
                                                zmodemSession.abort();
                                                zmodemSession = null;
                                            }
                                            zmodemActive = false; // 恢复输入
                                        });
                                    } else {
                                        zmodemSession.abort();
                                        zmodemSession = null;
                                        zmodemActive = false; // 恢复输入
                                    }
                                };
                                input.click();
                            }
                        }
                    });
                }

                try {
                    // 如果有活跃的 Zmodem 会话，让会话消费数据
                    if (zmodemSession) {
                        zmodemSession.consume(dataArray);
                    } else {
                        // 否则让 Sentry 检测
                        zmodemSentry.consume(dataArray);
                    }
                } catch (e) {
                    debug.error('[Zmodem] Error consuming data:', e);
                    // 如果不是 Zmodem 数据，直接写入终端
                    term.write(data);
                }
            }
        };

        socket.onclose = () => {
            updateSession(id, { status: 'disconnected' });
        };

        socket.onerror = () => {
            updateSession(id, { status: 'disconnected' });
            toast.error('WebSocket connection failed');
        };

    }, [updateSession, theme, color]);

    const disconnect = useCallback((id: string) => {
        const session = sessionsRef.current[id];
        if (session) {
            session.socket?.close();
            session.terminal.dispose();
            setSessions(prev => {
                const next = { ...prev };
                delete next[id];
                sessionsRef.current = next;
                return next;
            });
        }
    }, []);

    const setActiveSessionId = useCallback((id: string | null) => {
        setActiveSessionIdState(id);
    }, []);

    return (
        <SSHContext.Provider value={{ sessions, activeSessionId, setActiveSessionId, connect, disconnect }}>
            {children}
        </SSHContext.Provider>
    );
}

export const useSSH = () => {
    const context = useContext(SSHContext);
    if (!context) {
        throw new Error('useSSH must be used within a SSHProvider');
    }
    return context;
};

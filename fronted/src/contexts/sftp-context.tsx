import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { type Server } from '@/api/server';
import { toast } from 'sonner';
import { getWebSocketUrl } from '@/utils/websocket';
import streamSaver from 'streamsaver';

import { debug } from '@/utils/debug';


export type SFTPStatus = 'disconnected' | 'connecting' | 'connected';

export interface FileEntry {
    name: string;
    is_dir: boolean;
    size: number;
    modified: number | null;
    permissions: number | null;
    uid: number | null;
    gid: number | null;
    is_content_editable: boolean;
}

export interface SFTPSession {
    id: string;
    server: Server;
    status: SFTPStatus;
    socket: WebSocket | null;
    currentPath: string;
    files: FileEntry[];
    loading: boolean;
    uploadingFileName: string | null;
    uploadProgress: number;
    downloadingFileName: string | null;
    downloadProgress: number;
    isUploading: boolean;  // 是否正在上传
    isDownloading: boolean;  // 是否正在下载
}

interface SFTPContextType {
    sessions: Record<string, SFTPSession>;
    activeSessionId: string | null;
    setActiveSessionId: (id: string | null) => void;
    connect: (server: Server) => Promise<void>;
    disconnect: (sessionId: string) => void;
    listDir: (sessionId: string, path: string) => void;
    deleteFile: (sessionId: string, path: string) => void;
    deleteDir: (sessionId: string, path: string) => void;
    createDir: (sessionId: string, path: string) => void;
    rename: (sessionId: string, oldPath: string, newPath: string) => void;
    uploadFile: (sessionId: string, remotePath: string, file: File) => Promise<void>;
    cancelUpload: (sessionId: string) => void;
    downloadFile: (sessionId: string, remotePath: string, fileName: string) => void;
    getFileBlob: (id: string, path: string) => Promise<Blob>;
    readFile: (sessionId: string, path: string) => Promise<string>;
    saveFile: (sessionId: string, path: string, content: string) => Promise<void>;
    setPermissions: (sessionId: string, path: string, permissions: number) => void;
}

const SFTPContext = createContext<SFTPContextType | undefined>(undefined);

export function SFTPProvider({ children }: { children: React.ReactNode }) {
    const [sessions, setSessions] = useState<Record<string, SFTPSession>>({});
    const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
    const sessionsRef = useRef<Record<string, SFTPSession>>({});
    const pendingReads = useRef<Map<string, (content: string) => void>>(new Map());
    const downloadCallbacks = useRef<Map<string, Array<(blob: Blob) => void>>>(new Map());


    const updateSession = useCallback((id: string, updates: Partial<SFTPSession>) => {
        setSessions(prev => {
            const next = {
                ...prev,
                [id]: { ...prev[id], ...updates }
            };
            sessionsRef.current = next;
            return next;
        });
    }, []);

    // 清理会话资源
    const cleanupSession = useCallback((id: string) => {
        debug.log('[SFTP] Cleaning up session:', id);

        // 清理待处理的文件读取
        const keysToDelete: string[] = [];
        pendingReads.current.forEach((_, key) => {
            if (key.startsWith(`${id}:`)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => pendingReads.current.delete(key));

        // 清理下载回调
        downloadCallbacks.current.delete(id);

        debug.log('[SFTP] Session cleanup completed:', id);
    }, []);

    const connect = useCallback(async (server: Server) => {
        const id = `sftp-${server.id}-${Date.now()}`;

        const wsUrl = getWebSocketUrl('/sftp');

        const socket = new WebSocket(wsUrl);

        const session: SFTPSession = {
            id,
            server,
            status: 'connecting',
            socket,
            currentPath: '.',
            files: [],
            loading: true,
            uploadingFileName: null,
            uploadProgress: 0,
            downloadingFileName: null,
            downloadProgress: 0,
            isUploading: false,
            isDownloading: false,
        };

        setSessions(prev => ({ ...prev, [id]: session }));
        sessionsRef.current = { ...sessionsRef.current, [id]: session };
        setActiveSessionIdState(id);

        // 下载状态
        let downloadState: {
            fileName: string;
            totalSize: number;
            chunks: BlobPart[];
            receivedSize: number;
            expectedChunks: number;
            streamWriter?: WritableStreamDefaultWriter<Uint8Array>; // StreamSaver 的写入流
        } | null = null;

        socket.onopen = () => {
            updateSession(id, { status: 'connected' });
            // 连接成功后发送初始化参数
            socket.send(JSON.stringify({ server_id: server.id }));
        };

        socket.onmessage = (event) => {
            // 处理二进制消息(文件块)
            if (event.data instanceof Blob) {
                if (downloadState) {
                    const currentDownloadState = downloadState;
                    event.data.arrayBuffer().then(async buffer => {
                        const chunk = new Uint8Array(buffer);
                        currentDownloadState.chunks.push(chunk); // 保留用于 getFileBlob
                        currentDownloadState.receivedSize += chunk.length;

                        const progress = Math.round((currentDownloadState.receivedSize / currentDownloadState.totalSize) * 100);
                        updateSession(id, { downloadProgress: progress });

                        // 立即将数据写入 StreamSaver 流
                        if (currentDownloadState.streamWriter) {
                            try {
                                await currentDownloadState.streamWriter.write(chunk);
                                debug.log('[SFTP] Chunk written to stream:', currentDownloadState.chunks.length);
                            } catch (e) {
                                debug.error('[SFTP] Stream write error:', e);
                                toast.error('写入文件流失败');
                            }
                        }

                        debug.log('[SFTP] Chunk received:', currentDownloadState.chunks.length, '/', currentDownloadState.expectedChunks);
                    });
                } else {
                    debug.log('[SFTP] Received binary data but downloadState is null');
                }
                return;
            }

            // 处理文本消息
            try {
                const msg = JSON.parse(event.data);
                switch (msg.type) {
                    case 'connected':
                        // 真正连接成功，列出初始目录
                        updateSession(id, { loading: false });
                        socket.send(JSON.stringify({ type: 'list_dir', path: '.' }));
                        break;
                    case 'dir_list':
                        updateSession(id, {
                            currentPath: msg.path,
                            files: msg.entries,
                            loading: false
                        });
                        break;
                    case 'upload_progress':
                        updateSession(id, {
                            uploadProgress: Math.round((msg.received / msg.total) * 100)
                        });
                        break;
                    case 'download_start': {
                        const fileName = sessionsRef.current[id]?.downloadingFileName || 'download';

                        // 设置下载状态为 true
                        updateSession(id, { isDownloading: true });

                        // 使用 StreamSaver 创建可写流
                        const fileStream = streamSaver.createWriteStream(fileName, {
                            size: msg.total_size, // 提供文件大小以显示准确的进度
                        });

                        const streamWriter = fileStream.getWriter();

                        downloadState = {
                            fileName,
                            totalSize: msg.total_size,
                            chunks: [], // 仍保留用于 getFileBlob
                            receivedSize: 0,
                            expectedChunks: 0,
                            streamWriter
                        };

                        debug.log('[SFTP] StreamSaver download started:', fileName, msg.total_size);
                        break;
                    }
                    case 'download_chunk':
                        // 下一个消息应该是二进制数据
                        if (downloadState) {
                            downloadState.expectedChunks++;
                        }
                        break;
                    case 'download_end':
                        if (downloadState) {
                            debug.log('[SFTP] Download end, expected:', downloadState.expectedChunks, 'received:', downloadState.chunks.length);

                            const finalDownloadState = downloadState;
                            const checkAndFinish = async () => {
                                if (finalDownloadState.chunks.length >= finalDownloadState.expectedChunks && finalDownloadState.expectedChunks > 0) {
                                    debug.log('[SFTP] All chunks received, closing stream');

                                    // 关闭 StreamSaver 流
                                    if (finalDownloadState.streamWriter) {
                                        try {
                                            await finalDownloadState.streamWriter.close();
                                            debug.log('[SFTP] StreamSaver stream closed successfully');
                                            toast.success('文件下载成功');
                                        } catch (e) {
                                            debug.error('[SFTP] Stream close error:', e);
                                            toast.error('关闭文件流失败');
                                        }
                                    }

                                    // 检查是否有回调(用于 getFileBlob)
                                    const callbacks = downloadCallbacks.current.get(id);
                                    const blobCallback = callbacks && callbacks.length > 0 ? callbacks.shift() : null;

                                    if (blobCallback) {
                                        // 如果是 getFileBlob 调用,返回 blob
                                        const blob = new Blob(finalDownloadState.chunks);
                                        blobCallback(blob);
                                    }

                                    updateSession(id, { downloadingFileName: null, downloadProgress: 0, isDownloading: false });
                                } else if (finalDownloadState.chunks.length < finalDownloadState.expectedChunks) {
                                    setTimeout(checkAndFinish, 50);
                                } else {
                                    debug.log('[SFTP] Download invalid:', finalDownloadState);
                                }
                            };

                            setTimeout(checkAndFinish, 10);
                            downloadState = null;
                        }
                        break;
                    case 'success':
                        if (msg.message === "文件上传成功" || msg.message === "上传已取消") {
                            updateSession(id, { uploadingFileName: null, uploadProgress: 0, isUploading: false });
                        }
                        if (msg.message === "文件保存成功") {
                            toast.success(msg.message, { duration: 300 });
                        } else {
                            toast.success(msg.message);
                        }
                        // 进行一些操作后可能需要刷新当前目录
                        const currentSession = sessionsRef.current[id];
                        if (currentSession) {
                            socket.send(JSON.stringify({ type: 'list_dir', path: currentSession.currentPath }));
                        }
                        break;
                    case 'error':
                        toast.error(msg.message);
                        // 错误时重置上传和下载状态
                        updateSession(id, {
                            loading: false,
                            isUploading: false,
                            uploadingFileName: null,
                            uploadProgress: 0,
                            isDownloading: false,
                            downloadingFileName: null,
                            downloadProgress: 0
                        });
                        break;
                    case 'closed':
                        updateSession(id, { status: 'disconnected' });
                        cleanupSession(id);
                        break;
                    case 'file_content':
                        const readCallback = pendingReads.current.get(`${id}:${msg.path}`);
                        if (readCallback) {
                            readCallback(msg.content);
                            pendingReads.current.delete(`${id}:${msg.path}`);
                        }
                        break;
                }
            } catch (e) {
                debug.error('[SFTP] SFTP message error:', e);
            }
        };

        socket.onclose = () => {
            debug.log('[SFTP] WebSocket closed for session:', id);
            updateSession(id, { status: 'disconnected' });
            cleanupSession(id);
        };

        socket.onerror = () => {
            debug.log('[SFTP] WebSocket error for session:', id);
            updateSession(id, { status: 'disconnected' });
            toast.error('SFTP 连接失败');
            cleanupSession(id);
        };

    }, [updateSession, cleanupSession]);

    const readFile = useCallback((id: string, path: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const session = sessionsRef.current[id];
            if (!session?.socket || session.socket.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            pendingReads.current.set(`${id}:${path}`, resolve);
            session.socket.send(JSON.stringify({ type: 'read_file_content', path }));

            // Timeout after 30 seconds
            setTimeout(() => {
                if (pendingReads.current.has(`${id}:${path}`)) {
                    pendingReads.current.delete(`${id}:${path}`);
                    reject(new Error('Read file timeout'));
                }
            }, 30000);
        });
    }, []);

    const saveFile = useCallback((id: string, path: string, content: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            const session = sessionsRef.current[id];
            if (!session?.socket || session.socket.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            // We use the Success message handling or a specific save callback
            // Current success message handling is generic, so we might need a way to differentiate
            // For now, let's just listen for the next 'success' with the right message or just resolve if we get any success
            const checkSuccess = (event: MessageEvent) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'success' && msg.message === '文件保存成功') {
                        session.socket?.removeEventListener('message', checkSuccess);
                        resolve();
                    } else if (msg.type === 'error') {
                        session.socket?.removeEventListener('message', checkSuccess);
                        reject(new Error(msg.message));
                    }
                } catch (e) { }
            };

            session.socket.addEventListener('message', checkSuccess);
            session.socket.send(JSON.stringify({ type: 'save_file_content', path, content }));

            setTimeout(() => {
                session.socket?.removeEventListener('message', checkSuccess);
                reject(new Error('Save file timeout'));
            }, 30000);
        });
    }, []);

    const disconnect = useCallback((id: string) => {
        debug.log('[SFTP] Disconnecting session:', id);
        const session = sessionsRef.current[id];
        if (session?.socket) {
            session.socket.close();
        }
        // 清理资源
        cleanupSession(id);
        // 从 sessions 中删除
        setSessions(prev => {
            const next = { ...prev };
            delete next[id];
            sessionsRef.current = next;
            return next;
        });
    }, [cleanupSession]);

    const listDir = (id: string, path: string) => {
        const session = sessionsRef.current[id];
        if (session?.socket?.readyState === WebSocket.OPEN) {
            updateSession(id, { loading: true });
            session.socket.send(JSON.stringify({ type: 'list_dir', path }));
        }
    };

    const deleteFile = (id: string, path: string) => {
        const session = sessionsRef.current[id];
        if (session?.socket?.readyState === WebSocket.OPEN) {
            session.socket.send(JSON.stringify({ type: 'delete_file', path }));
        }
    };

    const deleteDir = (id: string, path: string) => {
        const session = sessionsRef.current[id];
        if (session?.socket?.readyState === WebSocket.OPEN) {
            session.socket.send(JSON.stringify({ type: 'delete_dir', path }));
        }
    };

    const createDir = (id: string, path: string) => {
        const session = sessionsRef.current[id];
        if (session?.socket?.readyState === WebSocket.OPEN) {
            session.socket.send(JSON.stringify({ type: 'create_dir', path }));
        }
    };

    const rename = (id: string, oldPath: string, newPath: string) => {
        const session = sessionsRef.current[id];
        if (session?.socket?.readyState === WebSocket.OPEN) {
            session.socket.send(JSON.stringify({ type: 'rename', old_path: oldPath, new_path: newPath }));
        }
    };

    const setPermissions = (id: string, path: string, permissions: number) => {
        const session = sessionsRef.current[id];
        if (session?.socket?.readyState === WebSocket.OPEN) {
            session.socket.send(JSON.stringify({ type: 'set_permissions', path, permissions }));
        }
    };

    const cancelUpload = useCallback((id: string) => {
        const session = sessionsRef.current[id];
        if (session?.socket?.readyState === WebSocket.OPEN) {
            session.socket.send(JSON.stringify({ type: 'upload_file_cancel' }));
        }
        updateSession(id, { isUploading: false, uploadingFileName: null, uploadProgress: 0 });
    }, [updateSession]);

    const uploadFile = async (id: string, remotePath: string, file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const session = sessionsRef.current[id];
            if (!session?.socket || session.socket.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            // 检查是否正在上传
            if (session.isUploading) {
                toast.error('已有文件正在上传,请等待完成');
                reject(new Error('Upload in progress'));
                return;
            }

            updateSession(id, { uploadingFileName: file.name, uploadProgress: 0, isUploading: true });

            const CHUNK_SIZE = 1024 * 1024 * 5; // 5MB
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

            // 监听上传完成或错误
            const handleUploadComplete = (event: MessageEvent) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'success' && (msg.message === '文件上传成功' || msg.message === '上传已取消')) {
                        session.socket?.removeEventListener('message', handleUploadComplete);
                        resolve();
                    } else if (msg.type === 'error') {
                        session.socket?.removeEventListener('message', handleUploadComplete);
                        reject(new Error(msg.message));
                    }
                } catch (e) { }
            };

            session.socket.addEventListener('message', handleUploadComplete);

            // 设置超时
            const timeout = setTimeout(() => {
                session.socket?.removeEventListener('message', handleUploadComplete);
                updateSession(id, { isUploading: false, uploadingFileName: null, uploadProgress: 0 });
                reject(new Error('Upload timeout'));
            }, 300000); // 5分钟超时

            // 发送开始上传指令
            session.socket.send(JSON.stringify({
                type: 'upload_file_start',
                path: remotePath,
                total_size: file.size
            }));

            const reader = new FileReader();
            let chunkId = 0;

            const uploadNextChunk = () => {
                const currentSession = sessionsRef.current[id];
                // 如果上传已取消（isUploading 被置为 false），停止循环
                if (!currentSession || !currentSession.isUploading) {
                    debug.log('[SFTP] Upload loop stopped (cancelled or finished)');
                    clearTimeout(timeout);
                    session.socket?.removeEventListener('message', handleUploadComplete);
                    reject(new Error('Upload cancelled'));
                    return;
                }

                if (chunkId >= totalChunks) {
                    currentSession.socket?.send(JSON.stringify({ type: 'upload_file_end' }));
                    clearTimeout(timeout);
                    return;
                }

                const start = chunkId * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const blob = file.slice(start, end);

                reader.onload = (e) => {
                    if (e.target?.result instanceof ArrayBuffer) {
                        // 直接发送二进制数据，不再使用 JSON
                        currentSession.socket?.send(e.target.result);
                        chunkId++;
                        // 添加小延迟让后端处理并返回进度
                        setTimeout(uploadNextChunk, 50);
                    }
                };
                reader.readAsArrayBuffer(blob);
            };

            // 给一点点延迟让后端准备好文件句柄
            setTimeout(uploadNextChunk, 100);
        });
    };

    const downloadFile = (id: string, remotePath: string, fileName: string) => {
        const session = sessionsRef.current[id];
        if (!session?.socket || session.socket.readyState !== WebSocket.OPEN) return;

        updateSession(id, { downloadingFileName: fileName, downloadProgress: 0 });
        session.socket.send(JSON.stringify({ type: 'download_file', path: remotePath }));
    };

    return (
        <SFTPContext.Provider value={{
            sessions,
            activeSessionId,
            setActiveSessionId: setActiveSessionIdState,
            connect,
            disconnect,
            listDir,
            deleteFile,
            deleteDir,
            getFileBlob: useCallback((id: string, path: string): Promise<Blob> => {
                return new Promise((resolve) => {
                    const fileName = path.split('/').pop() || 'file';

                    if (!downloadCallbacks.current.has(id)) {
                        downloadCallbacks.current.set(id, []);
                    }
                    downloadCallbacks.current.get(id)!.push(resolve);

                    const session = sessionsRef.current[id];
                    if (session?.socket?.readyState === WebSocket.OPEN) {
                        updateSession(id, { downloadingFileName: fileName, downloadProgress: 0 });
                        session.socket.send(JSON.stringify({ type: 'download_file', path }));
                    }
                });
            }, [updateSession]),
            createDir,
            rename,
            setPermissions,
            uploadFile,
            cancelUpload,
            downloadFile,
            readFile,
            saveFile
        }}>
            {children}
        </SFTPContext.Provider>
    );
}

export function useSFTP() {
    const context = useContext(SFTPContext);
    if (context === undefined) {
        throw new Error('useSFTP must be used within a SFTPProvider');
    }
    return context;
}

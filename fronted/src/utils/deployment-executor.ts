import type { DeploymentTask, ExecutionPlan, Step } from '@/types/deployment';
import type { ExecutionLog } from '@/contexts/deployment-context';
import { getServers } from '@/api/server';
import { getWebSocketUrl } from '@/utils/websocket';

/**
 * 部署执行引擎
 * 负责协调 SSH/SFTP 连接执行部署步骤
 */
export class DeploymentExecutor {
    private task: DeploymentTask;
    private plan: ExecutionPlan;
    private onLog: (log: ExecutionLog) => void;
    private onProgress: (progress: number) => void;
    private isCancelled: () => boolean;

    constructor(
        task: DeploymentTask,
        plan: ExecutionPlan,
        onLog: (log: ExecutionLog) => void,
        onProgress: (progress: number) => void,
        isCancelled: () => boolean
    ) {
        this.task = task;
        this.plan = plan;
        this.onLog = onLog;
        this.onProgress = onProgress;
        this.isCancelled = isCancelled;
    }

    /**
     * 执行部署任务
     */
    async execute(): Promise<void> {
        const totalSteps = this.plan.steps.length *
            this.task.serverGroups.reduce((sum, g) => sum + g.serverCount, 0);
        let completedSteps = 0;

        try {
            // 根据策略执行
            if (this.task.strategy === 'SEQUENTIAL') {
                await this.executeSequential(totalSteps, completedSteps);
            } else {
                await this.executeParallel(totalSteps, completedSteps);
            }
        } catch (error) {
            this.log('error', `执行失败: ${error}`);
            throw error;
        }
    }

    /**
     * 串行执行
     */
    private async executeSequential(totalSteps: number, completedSteps: number): Promise<void> {
        for (const group of this.task.serverGroups) {
            if (this.isCancelled()) {
                this.log('warning', '任务已取消');
                return;
            }

            this.log('info', `开始处理服务器组: ${group.name}`);

            const servers = await this.getServersInGroup(group.id);

            if (servers.length === 0) {
                this.log('warning', `服务器组 ${group.name} 中没有服务器,跳过执行`);
                continue;
            }

            for (const server of servers) {
                if (this.isCancelled()) return;

                this.log('info', `连接服务器: ${server.name} (${server.host})`);

                for (const step of this.plan.steps) {
                    if (this.isCancelled()) return;

                    await this.executeStep(step, server);
                    completedSteps++;
                    this.onProgress(Math.round((completedSteps / totalSteps) * 100));
                }
            }
        }
    }

    /**
     * 并行执行
     */
    private async executeParallel(totalSteps: number, completedSteps: number): Promise<void> {
        const promises: Promise<void>[] = [];

        for (const group of this.task.serverGroups) {
            this.log('info', `开始处理服务器组: ${group.name}`);
            const servers = await this.getServersInGroup(group.id);

            if (servers.length === 0) {
                this.log('warning', `服务器组 ${group.name} 中没有服务器,跳过执行`);
                continue;
            }

            for (const server of servers) {
                const promise = (async () => {
                    for (const step of this.plan.steps) {
                        if (this.isCancelled()) return;
                        await this.executeStep(step, server);
                        completedSteps++;
                        this.onProgress(Math.round((completedSteps / totalSteps) * 100));
                    }
                })();

                promises.push(promise);
            }
        }

        await Promise.all(promises);
    }

    /**
     * 执行单个步骤
     */
    private async executeStep(step: Step, server: any): Promise<void> {
        this.log('info', `执行步骤: ${step.name}`, server.id, server.name, step.id, step.name);

        try {
            if (step.type === 'FILE_UPLOAD') {
                await this.executeFileUpload(step, server);
            } else if (step.type === 'COMMAND_EXECUTION') {
                await this.executeCommand(step, server);
            }

            this.log('success', `步骤完成: ${step.name}`, server.id, server.name, step.id, step.name);
        } catch (error) {
            this.log('error', `步骤失败: ${step.name} - ${error}`, server.id, server.name, step.id, step.name);

            if (!step.continueOnError) {
                throw error;
            }
        }
    }

    /**
     * 执行文件上传步骤
     */
    private async executeFileUpload(step: any, server: any): Promise<void> {
        this.log('info', `上传文件: ${step.sourcePath} -> ${step.targetPath}`, server.id, server.name);

        try {
            await this.executeFileUploadViaSFTP(
                server,
                step.sourcePath,
                step.targetPath
            );

            // 如果指定了权限,执行 chmod
            if (step.permissions) {
                this.log('info', `设置权限: ${step.permissions}`, server.id, server.name);
                await this.executeCommandViaSSH(
                    server,
                    `chmod ${step.permissions} ${step.targetPath}`
                );
            }

            this.log('success', `文件上传完成: ${step.targetPath}`, server.id, server.name);
        } catch (error) {
            this.log('error', `文件上传失败: ${error}`, server.id, server.name);
            throw error;
        }
    }

    /**
     * 执行命令步骤
     */
    private async executeCommand(step: any, server: any): Promise<void> {
        for (const command of step.commands) {
            if (this.isCancelled()) return;

            this.log('info', `执行命令: ${command}`, server.id, server.name);

            try {
                const output = await this.executeCommandViaSSH(
                    server,
                    command,
                    step.workingDirectory,
                    step.environment
                );

                this.log('success', `命令执行完成: ${command}`, server.id, server.name);

                if (output) {
                    this.log('info', `输出:\n${output}`, server.id, server.name);
                }
            } catch (error) {
                this.log('error', `命令执行失败: ${error}`, server.id, server.name);
                throw error;
            }
        }
    }

    /**
     * 通过 SFTP WebSocket 上传本地文件到远程
     */
    private executeFileUploadViaSFTP(
        server: any,
        localPath: string,
        remotePath: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const wsUrl = getWebSocketUrl('/sftp');
            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                // 1. 发送连接参数
                const params = {
                    server_id: server.id,
                };
                socket.send(JSON.stringify(params));
            };

            socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    switch (msg.type) {
                        case 'connected':
                            // 2. 发送上传指令
                            socket.send(JSON.stringify({
                                type: 'upload_local',
                                local_path: localPath,
                                remote_path: remotePath
                            }));
                            break;

                        case 'upload_progress':
                            const progress = Math.round((msg.received / msg.total) * 100);
                            this.log('info', `上传进度: ${progress}%`, server.id, server.name);
                            break;

                        case 'success':
                            if (msg.message === '文件上传成功') {
                                resolve();
                                socket.close();
                            }
                            break;

                        case 'error':
                            reject(new Error(msg.message));
                            socket.close();
                            break;

                        case 'closed':
                            reject(new Error('SFTP 连接已关闭'));
                            break;
                    }
                } catch (e) {
                    // 忽略非 JSON 消息
                }
            };

            socket.onerror = () => {
                reject(new Error('WebSocket 连接失败'));
            };

            socket.onclose = () => {
                // 如果没有 resolve/reject,说明异常关闭
                reject(new Error('连接已关闭'));
            };

            // 超时处理 (2分钟,文件上传可能较慢)
            setTimeout(() => {
                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                    socket.close();
                    reject(new Error('文件上传超时'));
                }
            }, 120000);
        });
    }

    /**
     * 通过 SSH WebSocket 执行命令
     */
    private executeCommandViaSSH(
        server: any,
        command: string,
        workdir?: string,
        env?: Record<string, string>
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const wsUrl = getWebSocketUrl('/ssh');
            const socket = new WebSocket(wsUrl);
            socket.binaryType = 'arraybuffer';

            let output = '';
            let exitCode: number | null = null;

            socket.onopen = () => {
                const params = {
                    server_id: server.id,
                    mode: 'exec',
                    command: command,
                    workdir: workdir,
                    env: env || {
                        LANG: 'zh_CN.UTF-8',
                        LC_ALL: 'zh_CN.UTF-8'
                    },
                    term: 'xterm-256color',
                    cols: 80,
                    rows: 24,
                };
                socket.send(JSON.stringify(params));
            };

            socket.onmessage = (event) => {
                if (typeof event.data === 'string') {
                    try {
                        const msg = JSON.parse(event.data);

                        if (msg.type === 'Error') {
                            reject(new Error(msg.message));
                            socket.close();
                        } else if (msg.type === 'exec_complete') {
                            // 命令执行完成
                            exitCode = msg.exit_code;
                            output = msg.output || '';

                            if (exitCode !== 0) {
                                reject(new Error(`命令退出码: ${exitCode}\n输出: ${output}`));
                            } else {
                                resolve(output);
                            }
                            socket.close();
                        } else {
                            // 其他文本消息,可能是实时输出
                            output += event.data;
                        }
                    } catch (e) {
                        // 不是JSON,是普通文本输出
                        output += event.data;
                    }
                } else {
                    // 二进制数据,转换为字符串
                    const decoder = new TextDecoder();
                    const text = decoder.decode(new Uint8Array(event.data));
                    output += text;
                }
            };

            socket.onerror = (error) => {
                this.log('error', `WebSocket 连接失败: ${error}`);
                reject(new Error('WebSocket 连接失败'));
            };

            socket.onclose = (event) => {
                // 如果还没有收到 exec_complete,可能是异常关闭
                if (exitCode === null) {
                    this.log('error', `WebSocket 异常关闭,代码: ${event.code}`);
                    reject(new Error('连接异常关闭'));
                }
            };

            // 超时处理 (30秒)
            setTimeout(() => {
                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                    socket.close();
                    reject(new Error('命令执行超时'));
                }
            }, 30000);
        });
    }



    /**
     * 获取服务器组中的服务器列表
     */
    private async getServersInGroup(groupId: number): Promise<any[]> {
        try {
            const data = await getServers({ group_id: groupId });
            return data.items || [];
        } catch (error) {
            this.log('error', `获取服务器组 ${groupId} 的服务器列表失败: ${error}`);
            return [];
        }
    }

    /**
     * 记录日志
     */
    private log(
        level: 'info' | 'success' | 'warning' | 'error',
        message: string,
        serverId?: number,
        serverName?: string,
        stepId?: string,
        stepName?: string
    ): void {
        this.onLog({
            timestamp: new Date().toISOString(),
            level,
            message,
            serverId,
            serverName,
            stepId,
            stepName,
        });
    }
}

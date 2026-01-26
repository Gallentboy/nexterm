import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

/**
 * 配置 Monaco Editor 使用离线模式
 * 
 * 默认情况下,@monaco-editor/react 会从 CDN 加载 Monaco Editor 文件。
 * 此配置确保所有资源都从本地 node_modules 加载,实现完全离线使用。
 * 
 * @author zhangyue
 * @date 2026-01-26
 */
export function configureMonacoOffline() {
    // 配置 loader 使用本地的 monaco-editor
    // 这样可以避免从 CDN 加载,实现完全离线
    loader.config({ monaco });
}

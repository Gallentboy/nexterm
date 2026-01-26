# Monaco Editor 和 PDF.js 离线配置说明

## 概述

本项目已配置 **Monaco Editor** 和 **PDF.js** 完全离线使用,不再依赖任何在线 CDN 资源。所有相关文件(包括核心库、语言支持、Worker 文件等)都从本地 `node_modules` 打包并加载。

### 离线组件
<ul>
  <li><b>Monaco Editor</b>: 代码编辑器,用于 SFTP 文件编辑功能</li>
  <li><b>PDF.js</b>: PDF 查看器,用于 SFTP PDF 文件预览功能</li>
  <li><b>Monaco Vim</b>: Vim 模式支持</li>
</ul>


## 配置文件

### 1. Monaco 配置文件
**文件**: `src/config/monaco-config.ts`

```typescript
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

export function configureMonacoOffline() {
  // 配置 loader 使用本地的 monaco-editor
  // 这样可以避免从 CDN 加载,实现完全离线
  loader.config({ monaco });
}
```

**作用**: 
- 通过 `loader.config({ monaco })` 告诉 `@monaco-editor/react` 使用本地安装的 `monaco-editor` 包
- 避免默认从 CDN (jsdelivr) 加载 Monaco Editor 文件

### 2. 应用入口配置
**文件**: `src/main.tsx`

在应用启动时调用配置函数:
```typescript
import { configureMonacoOffline } from './config/monaco-config'

// 配置 Monaco Editor 使用离线模式
configureMonacoOffline()
```

**作用**: 确保在 Monaco Editor 组件渲染前完成配置

### 3. Vite 构建配置
**文件**: `vite.config.ts`

添加了以下配置:

#### 3.1 代码分割优化
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        // Monaco Editor 核心文件
        if (id.includes('monaco-editor')) {
          return 'monaco-editor';
        }
        // Monaco Editor 语言支持文件
        if (id.includes('monaco-editor') && id.includes('/esm/vs/language/')) {
          return 'monaco-languages';
        }
        // Monaco Editor worker 文件
        if (id.includes('monaco-editor') && id.includes('/esm/vs/editor/')) {
          return 'monaco-editor-core';
        }
      }
    }
  },
  assetsInlineLimit: 0, // 确保 worker 文件不被内联
}
```

#### 3.2 依赖预构建
```typescript
optimizeDeps: {
  include: [
    'monaco-editor',
    '@monaco-editor/react',
    'monaco-vim'
  ],
}
```

#### 3.3 Worker 配置
```typescript
worker: {
  format: 'es',
  plugins: () => []
}
```

#### 3.4 PDF.js 静态资源配置
```typescript
VitePWA({
  includeAssets: ['icon.svg', 'vite.svg', 'pdfjs-dist/**/*'],
  // ...
})
```

### 4. PDF.js 配置
**文件**: `src/components/sftp/pdf-viewer-modal.tsx`

```typescript
<Worker workerUrl="/pdfjs-dist/build/pdf.worker.min.js">
  <Viewer fileUrl={fileUrl} />
</Worker>
```

**作用**: 使用本地的 PDF.js worker 文件而不是从 unpkg CDN 加载

### 5. PDF.js Worker 文件部署
**位置**: `public/pdfjs-dist/build/pdf.worker.min.js`

此文件从 `node_modules/pdfjs-dist/build/pdf.worker.min.js` 复制而来,在构建时会自动复制到 `dist/` 目录。


## 打包产物

构建后,`dist/assets/` 目录包含以下 Monaco Editor 相关文件:

### Worker 文件
<ul>
  <li>`json.worker-*.js` - JSON 语言支持 Worker</li>
  <li>`html.worker-*.js` - HTML 语言支持 Worker</li>
  <li>`css.worker-*.js` - CSS 语言支持 Worker</li>
  <li>`ts.worker-*.js` - TypeScript/JavaScript 语言支持 Worker</li>
</ul>

### 语言支持文件
<ul>
  <li>100+ 种编程语言的语法高亮支持文件</li>
  <li>包括: Python, Rust, Java, JavaScript, TypeScript, Go, C++, Shell, SQL 等</li>
</ul>

### 核心文件
<ul>
  <li>`monaco-editor-*.css` - Monaco Editor 样式文件</li>
  <li>`monaco-editor-*.js` - Monaco Editor 核心逻辑</li>
  <li>`codicon-*.ttf` - Monaco Editor 图标字体</li>
</ul>

### PDF.js 文件
<ul>
  <li>`pdfjs-dist/build/pdf.worker.min.js` - PDF.js Worker 文件 (~1MB)</li>
  <li>`pdf-viewer-*.js` - PDF 查看器组件</li>
  <li>`pdf-viewer-*.css` - PDF 查看器样式</li>
</ul>

## 验证离线功能

### 方法 1: 网络检查
1. 打开浏览器开发者工具 (F12)
2. 切换到 Network (网络) 标签
3. 打开 SFTP 文件编辑器
4. 检查是否有任何对外部 CDN 的请求 (如 jsdelivr.net, unpkg.com 等)

### 方法 2: 离线测试
1. 构建项目: `pnpm run build`
2. 启动本地服务器: `pnpm run preview`
3. 断开网络连接
4. 访问应用并打开文件编辑器
5. 验证 Monaco Editor 是否正常工作

## 依赖包

### 生产依赖
- `@monaco-editor/react`: ^4.7.0 - Monaco Editor React 封装
- `monaco-vim`: ^0.4.4 - Vim 模式支持
- `@react-pdf-viewer/core`: ^3.12.0 - PDF 查看器核心
- `@react-pdf-viewer/default-layout`: ^3.12.0 - PDF 查看器默认布局
- `pdfjs-dist`: ^3.11.174 - PDF.js 核心库

### 开发依赖
- `monaco-editor`: 0.55.1 - Monaco Editor 核心库 (提供类型定义和本地文件)

## 注意事项

1. **不要删除 `monaco-editor` 开发依赖**: 虽然它在 `devDependencies` 中,但它提供了运行时需要的文件
2. **Worker 文件大小**: TypeScript Worker 文件较大 (~6.9MB),这是正常的
3. **首次加载**: Monaco Editor 首次加载时可能需要一些时间,建议使用代码分割和懒加载
4. **语言支持**: 所有语言支持都是按需加载的,只有用户打开对应类型的文件时才会加载相应的语言模块
5. **PDF.js Worker**: PDF.js worker 文件 (~1MB) 位于 `public/pdfjs-dist/build/` 目录,构建时会自动复制到 `dist/` 目录
6. **更新 PDF.js**: 如果更新 `pdfjs-dist` 版本,需要重新复制 worker 文件到 `public` 目录

## 相关文件

- 配置文件: `src/config/monaco-config.ts`
- 使用示例: `src/components/sftp/editor-modal.tsx`
- 构建配置: `vite.config.ts`
- 应用入口: `src/main.tsx`

## 参考文档

- [@monaco-editor/react 官方文档](https://github.com/suren-atoyan/monaco-react)
- [Monaco Editor 官方文档](https://microsoft.github.io/monaco-editor/)

---

**作者**: zhangyue  
**日期**: 2026-01-26

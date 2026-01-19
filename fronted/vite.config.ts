import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'vite.svg'],
      manifest: {
        // 默认使用中文,浏览器会根据用户语言自动选择
        // For English: name: 'Nexterm - Next Generation Terminal'
        name: 'Nexterm - 下一代终端管理平台',
        short_name: 'Nexterm',
        description: '强大的 SSH/SFTP 服务器管理和部署平台',
        lang: 'zh-CN',
        theme_color: '#0ea5e9',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        categories: ['utilities', 'productivity', 'developer tools'],
        shortcuts: [
          {
            name: '服务器列表',
            short_name: '服务器',
            description: '查看和管理服务器',
            url: '/servers',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'SSH终端',
            short_name: 'SSH',
            description: '打开SSH终端',
            url: '/ssh',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'SFTP管理器',
            short_name: 'SFTP',
            description: '文件传输管理',
            url: '/sftp',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        disableDevLogs: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // Increase limit to 10MB
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false, // 禁用开发模式的 Service Worker 和日志
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('monaco-editor')) {
            return 'monaco-editor';
          }
          if (id.includes('pdfjs-dist') || id.includes('pdf-viewer')) {
            return 'pdf-viewer';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})

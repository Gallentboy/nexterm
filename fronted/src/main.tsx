import { StrictMode } from 'react'
import '@fontsource-variable/inter'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './i18n'
import { configureMonacoOffline } from './config/monaco-config'

// 配置 Monaco Editor 使用离线模式
configureMonacoOffline()


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

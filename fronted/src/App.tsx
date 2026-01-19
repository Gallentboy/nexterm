import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { SSHProvider } from '@/contexts/ssh-context';
import { ThemeProvider } from '@/contexts/theme-context';
import ProtectedRoute from '@/components/layout/protected-route';
import MainLayout from '@/components/layout/main-layout';
import LoginPage from '@/pages/login';
import RegisterPage from '@/pages/register';
import DashboardPage from '@/pages/dashboard';
import ServersPage from '@/pages/servers';
import ServerFormPage from '@/pages/server-form';
import GroupsPage from '@/pages/groups';
import SSHPage from '@/pages/ssh';
import SFTPPage from '@/pages/sftp';
import DeploymentPage from '@/pages/deployment';
import { SFTPProvider } from '@/contexts/sftp-context';
import { DeploymentProvider } from '@/contexts/deployment-context';
import { Toaster } from '@/components/ui/sonner';
import PWAUpdatePrompt from '@/components/pwa-update-prompt';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

// 路由记忆组件
function RouteMemory() {
  const location = useLocation();

  useEffect(() => {
    // 只保存受保护的路由，不保存登录/注册页面
    if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/register')) {
      localStorage.setItem('lastRoute', location.pathname);
    }
  }, [location.pathname]);

  return null;
}

function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.title = t('common.appTitle');
  }, [i18n.language, t]);

  // 禁用右键菜单
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="system" storageKey="nexterm-theme">
        <AuthProvider>
          <SFTPProvider>
            <SSHProvider>
              <DeploymentProvider>
                <RouteMemory />
                <Routes>
                  {/* 公开路由 */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* 受保护路由组 - 使用 MainLayout */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <MainLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/servers" element={<ServersPage />} />
                    <Route path="/groups" element={<GroupsPage />} />
                    <Route path="/ssh" element={<SSHPage />} />
                    <Route path="/sftp" element={<SFTPPage />} />
                    <Route path="/deployment" element={<DeploymentPage />} />
                    <Route path="/servers/new" element={<ServerFormPage />} />
                    <Route path="/servers/:id/edit" element={<ServerFormPage />} />
                  </Route>

                  {/* 默认重定向 - 优先跳转到上次访问的路由 */}
                  <Route
                    path="/"
                    element={
                      <Navigate
                        to={localStorage.getItem('lastRoute') || '/dashboard'}
                        replace
                      />
                    }
                  />

                  {/* 404 页面 */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
                <Toaster position="top-right" />
                <PWAUpdatePrompt />
              </DeploymentProvider>
            </SSHProvider>
          </SFTPProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;

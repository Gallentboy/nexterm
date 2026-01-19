import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">加载中...</div>
            </div>
        );
    }

    if (!user) {
        // 保存当前路径,登录后返回
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    return <>{children}</>;
}

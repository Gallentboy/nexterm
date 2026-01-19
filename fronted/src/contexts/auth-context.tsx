import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { debug } from '@/utils/debug';
import type { User } from '@/api/auth';
import { getCurrentUser, login as apiLogin, logout as apiLogout } from '@/api/auth';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // 初始化时获取当前用户
    useEffect(() => {
        const initAuth = async () => {
            try {
                debug.log('[AuthContext] 开始获取当前用户...');
                const currentUser = await getCurrentUser();
                debug.log('[AuthContext] 获取到用户信息:', currentUser);
                setUser(currentUser);
            } catch (error) {
                // 未登录或 token 过期
                debug.log('[AuthContext] 获取用户失败:', error);
                setUser(null);
            } finally {
                setLoading(false);
                debug.log('[AuthContext] 加载完成');
            }
        };

        initAuth();
    }, []);

    const login = async (username: string, password: string) => {
        const userData = await apiLogin({ username, password });
        setUser(userData);
    };

    const logout = async () => {
        try {
            debug.log('[AuthContext] 开始登出...');
            await apiLogout();
            debug.log('[AuthContext] 后端登出成功');
        } catch (error) {
            debug.error('[AuthContext] 后端登出失败:', error);
            // 即使后端登出失败,也要清除本地状态
        } finally {
            // 清除用户状态
            setUser(null);
            debug.log('[AuthContext] 本地用户状态已清除');
        }
    };

    const refreshUser = async () => {
        try {
            const currentUser = await getCurrentUser();
            setUser(currentUser);
        } catch (error) {
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

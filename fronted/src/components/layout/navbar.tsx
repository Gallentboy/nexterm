import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    Server,
    FolderEdit,
    Terminal as TerminalIcon,
    LogOut,
    User,
    Rocket,
    HardDrive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { LanguageToggle } from './language-toggle';
import { useTranslation } from 'react-i18next';
import { debug } from '@/utils/debug';

export default function Navbar() {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        {
            label: t('nav.dashboard'),
            icon: LayoutDashboard,
            path: '/dashboard',
        },
        {
            label: t('nav.servers'),
            icon: Server,
            path: '/servers',
        },
        {
            label: t('nav.groups'),
            icon: FolderEdit,
            path: '/groups',
        },
        {
            label: t('nav.ssh'),
            icon: TerminalIcon,
            path: '/ssh',
        },
        {
            label: "SFTP",
            icon: HardDrive,
            path: '/sftp',
        },
        {
            label: t('nav.deployment'),
            icon: Rocket,
            path: '/deployment',
        },
    ];

    const isActive = (path: string) => location.pathname.startsWith(path);

    const handleLogout = async () => {
        try {
            debug.log('[Navbar] 开始登出...');
            await logout();
            debug.log('[Navbar] 登出成功,跳转到登录页');
            navigate('/login', { replace: true });
        } catch (error) {
            debug.error('[Navbar] 登出失败:', error);
            // 即使登出失败,也清除本地状态并跳转
            navigate('/login', { replace: true });
        }
    };

    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-8">
                    <div
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => navigate('/dashboard')}
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-110">
                            <Server className="h-5 w-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">{t('common.appTitle')}</span>
                    </div>

                    <div className="hidden md:flex items-center gap-1">
                        {menuItems.map((item) => (
                            <Button
                                key={item.path}
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    "flex items-center gap-2 px-4 transition-colors",
                                    isActive(item.path)
                                        ? "bg-secondary text-secondary-foreground font-medium"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <LanguageToggle />
                    <ThemeToggle />
                    <div className="flex items-center gap-3 px-3 py-1.5 rounded-full border bg-muted/50">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-sm font-medium hidden sm:inline-block">
                            {user?.display_name || user?.username}
                        </span>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleLogout}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </nav>
    );
}

import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard,
    User,
    Server,
    Plus,
    Terminal,
    FolderOpen,
    Mail,
    Clock,
    Zap
} from 'lucide-react';

export default function DashboardPage() {
    const { t } = useTranslation();
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="text-lg animate-pulse text-muted-foreground">{t('common.loading')}</div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="container mx-auto p-6">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <LayoutDashboard className="h-5 w-5 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
                </div>
                <p className="text-muted-foreground mt-1 ml-[52px]">{t('dashboard.subtitle')}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="shadow-sm border-none bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                            </div>
                            <CardTitle>{t('dashboard.welcome')}</CardTitle>
                        </div>
                        <CardDescription>{t('dashboard.userInfo')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">{t('common.username')}</span>
                            </div>
                            <span className="font-semibold">{user.display_name || user.username}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">{t('common.email')}</span>
                            </div>
                            <span className="font-semibold">{user.email || t('common.emailNotSet')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">{t('dashboard.lastLogin')}</span>
                            </div>
                            <span className="font-semibold text-xs">{user.last_login_at || t('common.firstLogin')}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-none bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Server className="h-4 w-4 text-primary" />
                            </div>
                            <CardTitle>{t('dashboard.serverManagement')}</CardTitle>
                        </div>
                        <CardDescription>{t('dashboard.manageSsh')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            {t('dashboard.manageDesc')}
                        </p>
                        <Button className="w-full gap-2" onClick={() => navigate('/servers')}>
                            <Server className="h-4 w-4" />
                            {t('dashboard.viewServers')}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-none bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Zap className="h-4 w-4 text-primary" />
                            </div>
                            <CardTitle>{t('dashboard.quickActions')}</CardTitle>
                        </div>
                        <CardDescription>{t('dashboard.quickActionsTitle')}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                        <Button className="w-full justify-start gap-2" variant="outline" onClick={() => navigate('/servers/new')}>
                            <Plus className="h-4 w-4" />
                            {t('dashboard.addServer')}
                        </Button>
                        <Button className="w-full justify-start gap-2" variant="outline" onClick={() => navigate('/ssh')}>
                            <Terminal className="h-4 w-4" />
                            {t('dashboard.sshTerminal')}
                        </Button>
                        <Button className="w-full justify-start gap-2" variant="outline" onClick={() => navigate('/sftp')}>
                            <FolderOpen className="h-4 w-4" />
                            {t('dashboard.fileExplorer')}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

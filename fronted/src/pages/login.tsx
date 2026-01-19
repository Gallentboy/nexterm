import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
    const { t } = useTranslation();

    const loginSchema = z.object({
        username: z.string().min(3, t('auth.usernameMinLength')),
        password: z.string().min(6, t('auth.passwordMinLength')),
    });

    type LoginFormData = z.infer<typeof loginSchema>;

    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    // 获取登录前的页面路径,如果没有则默认跳转到dashboard
    const from = (location.state as any)?.from || '/dashboard';

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        try {
            setIsLoading(true);
            setError('');
            await login(data.username, data.password);
            // 登录成功后跳转到之前的页面
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err.response?.data?.error || t('auth.loginFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-xl font-bold text-center">{t('auth.loginTitle')}</CardTitle>
                    <CardDescription className="text-center">
                        {t('auth.loginSubtitle')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">{t('auth.username')}</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder={t('auth.usernamePlaceholder')}
                                {...register('username')}
                                disabled={isLoading}
                            />
                            {errors.username && (
                                <p className="text-sm text-destructive">{errors.username.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">{t('auth.password')}</Label>
                                <Link
                                    to="/forgot-password"
                                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                >
                                    {t('auth.forgotPassword')}
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                placeholder={t('auth.passwordPlaceholder')}
                                {...register('password')}
                                disabled={isLoading}
                            />
                            {errors.password && (
                                <p className="text-sm text-destructive">{errors.password.message}</p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? t('auth.loggingIn') : t('auth.login')}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                    <div className="text-sm text-muted-foreground text-center">
                        {t('auth.noAccount')}{' '}
                        <Link to="/register" className="text-primary hover:underline font-medium">
                            {t('auth.registerNow')}
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

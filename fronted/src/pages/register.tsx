import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { register as apiRegister } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const registerSchema = z.object({
    username: z.string().min(3, '用户名至少 3 个字符').max(50, '用户名最多 50 个字符'),
    email: z.string().email('请输入有效的邮箱地址'),
    password: z.string().min(6, '密码至少 6 个字符'),
    confirmPassword: z.string(),
    display_name: z.string().min(1, '请输入显示名称'),
}).refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
    const navigate = useNavigate();
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (data: RegisterFormData) => {
        try {
            setIsLoading(true);
            setError('');
            await apiRegister({
                username: data.username,
                email: data.email,
                password: data.password,
                display_name: data.display_name,
            });
            // 注册成功后跳转到登录页
            navigate('/login', { state: { message: '注册成功,请登录' } });
        } catch (err: any) {
            setError(err.response?.data?.error || '注册失败,请稍后重试');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-xl font-bold text-center">创建账户</CardTitle>
                    <CardDescription className="text-center">
                        填写以下信息以创建新账户
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">用户名</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="请输入用户名"
                                {...register('username')}
                                disabled={isLoading}
                            />
                            {errors.username && (
                                <p className="text-sm text-destructive">{errors.username.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">邮箱</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="请输入邮箱地址"
                                {...register('email')}
                                disabled={isLoading}
                            />
                            {errors.email && (
                                <p className="text-sm text-destructive">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="display_name">显示名称</Label>
                            <Input
                                id="display_name"
                                type="text"
                                placeholder="请输入显示名称"
                                {...register('display_name')}
                                disabled={isLoading}
                            />
                            {errors.display_name && (
                                <p className="text-sm text-destructive">{errors.display_name.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">密码</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="请输入密码"
                                {...register('password')}
                                disabled={isLoading}
                            />
                            {errors.password && (
                                <p className="text-sm text-destructive">{errors.password.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">确认密码</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="请再次输入密码"
                                {...register('confirmPassword')}
                                disabled={isLoading}
                            />
                            {errors.confirmPassword && (
                                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? '注册中...' : '注册'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                    <div className="text-sm text-muted-foreground text-center">
                        已有账户?{' '}
                        <Link to="/login" className="text-primary hover:underline font-medium">
                            立即登录
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

import { Moon, Sun, Monitor, Palette } from "lucide-react"
import { useTheme, type Color } from "@/contexts/theme-context"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
    const { theme, setTheme, color, setColor } = useTheme()

    const colors: { name: Color; label: string; class: string }[] = [
        { name: 'zinc', label: '极简银', class: 'bg-zinc-500' },
        { name: 'blue', label: '深空蓝', class: 'bg-blue-500' },
        { name: 'green', label: '翡翠绿', class: 'bg-green-500' },
        { name: 'rose', label: '珊瑚红', class: 'bg-rose-500' },
        { name: 'orange', label: '琥珀橙', class: 'bg-orange-500' },
    ]

    const toggleTheme = () => {
        // 阻止冒泡,防止触发 Dropdown 菜单的操作(如果我们在 Trigger 里用这个)
        // 但这里我们会有专门的按钮,所以直接写逻辑
        if (theme === 'light') setTheme('dark')
        else if (theme === 'dark') setTheme('system')
        else setTheme('light')
    }

    return (
        <div className="flex items-center gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">主题色系</DropdownMenuLabel>
                    {colors.map((c) => (
                        <DropdownMenuItem
                            key={c.name}
                            onClick={() => setColor(c.name)}
                            className="flex items-center justify-between cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <div className={`h-3 w-3 rounded-full ${c.class}`} />
                                <span className="text-xs">{c.label}</span>
                            </div>
                            {color === c.name && <div className="h-1 w-1 rounded-full bg-primary" />}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">外观模式</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setTheme('light')} className="cursor-pointer">
                        <Sun className="mr-2 h-4 w-4" />
                        <span className="text-xs">明亮模式</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer">
                        <Moon className="mr-2 h-4 w-4" />
                        <span className="text-xs">暗黑模式</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('system')} className="cursor-pointer">
                        <Monitor className="mr-2 h-4 w-4" />
                        <span className="text-xs">跟随系统</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="w-9 h-9 p-0 rounded-full hover:bg-accent/50 transition-all duration-300"
                title="快速切换模式"
            >
                <div className="relative h-5 w-5 flex items-center justify-center">
                    <Sun className={`h-5 w-5 text-orange-500 absolute transition-all duration-500 ${theme === 'light' ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0'}`} />
                    <Moon className={`h-5 w-5 text-indigo-400 absolute transition-all duration-500 ${theme === 'dark' ? 'scale-100 rotate-0 opacity-100' : 'scale-0 rotate-90 opacity-0'}`} />
                    <Monitor className={`h-5 w-5 text-slate-400 absolute transition-all duration-500 ${theme === 'system' ? 'scale-100 rotate-0 opacity-100' : 'scale-0 rotate-180 opacity-0'}`} />
                </div>
                <span className="sr-only">切换模式</span>
            </Button>
        </div>
    )
}

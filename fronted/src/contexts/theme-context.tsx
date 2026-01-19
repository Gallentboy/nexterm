import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light" | "system"
export type Color = "zinc" | "blue" | "green" | "rose" | "orange"

interface ThemeProviderProps {
    children: React.ReactNode
    defaultTheme?: Theme
    defaultColor?: Color
    storageKey?: string
    colorStorageKey?: string
}

interface ThemeProviderState {
    theme: Theme
    color: Color
    setTheme: (theme: Theme) => void
    setColor: (color: Color) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    color: "zinc",
    setTheme: () => null,
    setColor: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = "system",
    defaultColor = "zinc",
    storageKey = "nexterm-theme",
    colorStorageKey = "ssh-manager-color",
    ...props
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    )
    const [color, setColor] = useState<Color>(
        () => (localStorage.getItem(colorStorageKey) as Color) || defaultColor
    )

    useEffect(() => {
        const root = window.document.documentElement

        root.classList.remove("light", "dark")
        root.setAttribute("data-color", color)

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light"

            root.classList.add(systemTheme)
            return
        }

        root.classList.add(theme)
    }, [theme, color])

    const value = {
        theme,
        color,
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme)
            setTheme(theme)
        },
        setColor: (color: Color) => {
            localStorage.setItem(colorStorageKey, color)
            setColor(color)
        }
    }

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")

    return context
}

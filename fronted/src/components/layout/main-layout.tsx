import { Outlet } from 'react-router-dom';
import Navbar from './navbar';

export default function MainLayout() {
    return (
        <div className="relative min-h-screen flex flex-col bg-background transition-colors duration-300">
            <Navbar />
            <main className="flex-1 flex flex-col">
                <Outlet />
            </main>
            <footer className="border-t py-4 md:px-8 md:py-0">
                <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-12 md:flex-row">
                    <p className="text-center text-xs leading-loose text-muted-foreground md:text-left">
                        Built by Antigravity. Powered by Rust & React.
                    </p>
                </div>
            </footer>
        </div>
    );
}

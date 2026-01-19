import { useState, useEffect, useRef } from 'react';
import { debug } from '@/utils/debug';
import { Input } from '@/components/ui/input';
import { Folder, File, Loader2 } from 'lucide-react';
import { getPathAutocomplete, type PathSuggestion } from '@/api/deployment';

interface PathInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function PathInput({ value, onChange, placeholder, className }: PathInputProps) {
    const [suggestions, setSuggestions] = useState<PathSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // 防抖获取建议
    useEffect(() => {
        if (value.length === 0) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const results = await getPathAutocomplete(value);
                setSuggestions(results);
                setShowSuggestions(results.length > 0);
                setSelectedIndex(0);
            } catch (error) {
                debug.error('[PathInput] Failed to fetch path suggestions:', error);
                setSuggestions([]);
                setShowSuggestions(false);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            setLoading(false);
        };
    }, [value]);

    // 键盘导航
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (suggestions[selectedIndex]) {
                    selectSuggestion(suggestions[selectedIndex]);
                }
                break;
            case 'Tab':
                e.preventDefault();
                if (suggestions[selectedIndex]) {
                    selectSuggestion(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setShowSuggestions(false);
                break;
        }
    };

    const selectSuggestion = (suggestion: PathSuggestion) => {
        onChange(suggestion.path);
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    return (
        <div className="relative">
            <div className="relative">
                <Input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className={className}
                    onFocus={() => {
                        if (suggestions.length > 0) {
                            setShowSuggestions(true);
                        }
                    }}
                    onBlur={() => {
                        // 延迟关闭,允许点击建议项
                        setTimeout(() => setShowSuggestions(false), 200);
                    }}
                />
                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                        <div
                            key={suggestion.path}
                            className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${index === selectedIndex
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-accent/50'
                                }`}
                            onClick={() => selectSuggestion(suggestion)}
                            onMouseEnter={() => setSelectedIndex(index)}
                        >
                            {suggestion.type === 'directory' ? (
                                <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                            ) : (
                                <File className="h-4 w-4 text-gray-500 shrink-0" />
                            )}
                            <span className="flex-1 font-mono text-sm truncate">
                                {suggestion.path}
                            </span>
                            {suggestion.size !== undefined && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                    {formatSize(suggestion.size)}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

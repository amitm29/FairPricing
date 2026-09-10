'use client';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
export function ThemeToggle() {
 const {setTheme,resolvedTheme}=useTheme();
 return <button type="button" aria-label="Toggle light and dark mode" title="Toggle light and dark mode" className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground" onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}><Sun className="hidden h-4 w-4 dark:block"/><Moon className="h-4 w-4 dark:hidden"/></button>;
}

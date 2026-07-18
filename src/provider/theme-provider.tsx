"use client";

import { Moon, Sun } from "lucide-react";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
  useTheme,
} from "next-themes";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

/** Compact icon-only toggle for headers/toolbars. */
export function ThemeToggleIcon() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 rounded-full md:size-9"
      aria-label="Toggle light/dark theme"
      title="Toggle light/dark theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* CSS-swapped icons keep server and client markup identical (no hydration flicker) */}
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <Button
      variant="outline"
      className="flex w-full items-center justify-between gap-2 text-primary"
      onClick={toggleTheme}
    >
      <span>Change Theme</span>
      <div className="flex items-center">
        <Sun className="h-4 w-4 rotate-0 transition-all dark:hidden" />
        <Moon className="hidden h-4 w-4 rotate-0 transition-all dark:block" />
        <Switch
          checked={theme === "dark"}
          onCheckedChange={toggleTheme}
          className="ml-2"
        />
      </div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

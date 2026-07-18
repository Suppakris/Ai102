"use client";

import { useTheme as useGlobalTheme } from "next-themes";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Theme = "light" | "dark";

interface PresentationThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: Theme;
}

const PresentationThemeContext = createContext<
  PresentationThemeContextValue | undefined
>(undefined);

/**
 * Custom hook to access the presentation theme context.
 * This is a drop-in replacement for next-themes' useTheme within the presentation route.
 *
 * If used outside of a PresentationThemeProvider (e.g., globally under RootLayout),
 * it seamlessly falls back to using the global next-themes system, avoiding runtime errors.
 */
export function usePresentationTheme() {
  const context = useContext(PresentationThemeContext);
  const globalTheme = useGlobalTheme();

  if (context === undefined) {
    const theme = (globalTheme.theme === "dark" ? "dark" : "light") as Theme;
    const resolvedTheme = (
      globalTheme.resolvedTheme === "dark" ? "dark" : "light"
    ) as Theme;

    return {
      theme,
      setTheme: (newTheme: Theme) => {
        globalTheme.setTheme(newTheme);
      },
      resolvedTheme,
    };
  }
  return context;
}

/**
 * A custom theme provider for the presentation section.
 * This creates a theme context scoped to a wrapper element instead of the
 * global <html> tag, so switching the editor's own light/dark state (or a
 * slide's color theme) never overrides the rest of the site's theme.
 * Radix portals (Sheet, Popover) that need to inherit this scope should
 * render into the `.sheet-container` element instead of the default body
 * portal (see PresentationLayout).
 */
export function PresentationThemeProvider({
  children,
  defaultTheme,
  storageKey: _storageKey, // kept for backward compatibility (ignored/unused now)
  syncWithDefaultTheme = false,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string | null;
  syncWithDefaultTheme?: boolean;
}) {
  const globalTheme = useGlobalTheme();
  // null = no scoped override: follow the site-wide theme (so the header's
  // light/dark toggle works on presentation routes). ThemeBackground sets an
  // override when a deck theme demands a specific mode.
  const [override, setOverride] = useState<Theme | null>(defaultTheme ?? null);

  // Sync state if syncWithDefaultTheme is true and defaultTheme changes
  useEffect(() => {
    if (syncWithDefaultTheme && defaultTheme) {
      setOverride(defaultTheme);
    }
  }, [defaultTheme, syncWithDefaultTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setOverride(newTheme);
  }, []);

  const resolvedTheme: Theme =
    override ?? (globalTheme.resolvedTheme === "dark" ? "dark" : "light");

  const value: PresentationThemeContextValue = {
    theme: resolvedTheme,
    setTheme,
    resolvedTheme,
  };

  return (
    <PresentationThemeContext.Provider value={value}>
      {/* No class while un-overridden: the html-level theme class cascades
          in, so Tailwind dark: variants and CSS variables follow the site
          theme. Only an explicit override pins the scope to dark. */}
      <div
        className={
          override === "dark"
            ? "dark bg-background text-foreground h-full w-full"
            : "bg-background text-foreground h-full w-full"
        }
      >
        {children}
      </div>
    </PresentationThemeContext.Provider>
  );
}

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
  defaultTheme = "dark",
  storageKey: _storageKey, // kept for backward compatibility (ignored/unused now)
  syncWithDefaultTheme = false,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string | null;
  syncWithDefaultTheme?: boolean;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  // Sync state if syncWithDefaultTheme is true and defaultTheme changes
  useEffect(() => {
    if (syncWithDefaultTheme) {
      setThemeState(defaultTheme);
    }
  }, [defaultTheme, syncWithDefaultTheme]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
    },
    [],
  );

  const value: PresentationThemeContextValue = {
    theme,
    setTheme,
    resolvedTheme: theme,
  };

  return (
    <PresentationThemeContext.Provider value={value}>
      <PresentationThemeWrapper>{children}</PresentationThemeWrapper>
    </PresentationThemeContext.Provider>
  );
}

/**
 * Inner wrapper that applies the theme class to a div element.
 * This ensures Tailwind's dark: variants work correctly within the presentation.
 */
function PresentationThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = usePresentationTheme();
  return (
    <div
      className={
        theme === "dark"
          ? "dark bg-background text-foreground h-full w-full"
          : "bg-background text-foreground h-full w-full"
      }
    >
      {children}
    </div>
  );
}

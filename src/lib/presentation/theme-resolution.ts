import {
  themes,
  type ThemeProperties,
  type Themes,
} from "@/lib/presentation/themes";
import {
  presentationAiThemePropertiesSchema,
  presentationThemePropertiesSchema,
  presentationThemeStyleDataSchema,
} from "./theme-schema";

export const PRESENTATION_AUTO_THEME_ID = "auto";

export type PresentationThemeSelectionSource = "auto" | "selected";

export function isPresentationAutoTheme(theme: string | null | undefined) {
  return theme === PRESENTATION_AUTO_THEME_ID;
}

export function isBuiltInPresentationTheme(
  theme: string | null | undefined,
): theme is Themes {
  return typeof theme === "string" && theme in themes;
}

function resolveCompleteCustomThemeData(
  customThemeData: unknown,
): ThemeProperties | null {
  const parsedTheme =
    presentationThemePropertiesSchema.safeParse(customThemeData);

  if (parsedTheme.success) {
    return parsedTheme.data;
  }

  const parsedThemeStyleData =
    presentationThemeStyleDataSchema.safeParse(customThemeData);

  if (parsedThemeStyleData.success) {
    const fallbackTheme = themes.mystique;

    return {
      ...parsedThemeStyleData.data,
      name: parsedThemeStyleData.data.name ?? `Custom ${fallbackTheme.name}`,
      description:
        parsedThemeStyleData.data.description ??
        `Custom theme based on ${fallbackTheme.name}`,
    };
  }

  const parsedPartialTheme =
    presentationAiThemePropertiesSchema.safeParse(customThemeData);

  if (!parsedPartialTheme.success) {
    return null;
  }

  const fallbackTheme = themes.mystique;
  const completedTheme: ThemeProperties = {
    ...fallbackTheme,
    name: parsedPartialTheme.data.name ?? `Custom ${fallbackTheme.name}`,
    description:
      parsedPartialTheme.data.description ??
      `Custom theme based on ${fallbackTheme.name}`,
    colors: {
      ...fallbackTheme.colors,
      ...parsedPartialTheme.data.colors,
    },
    fonts: {
      ...fallbackTheme.fonts,
      ...parsedPartialTheme.data.fonts,
    },
    background: parsedPartialTheme.data.background ?? fallbackTheme.background,
  };
  const parsedCompletedTheme =
    presentationThemePropertiesSchema.safeParse(completedTheme);

  return parsedCompletedTheme.success ? parsedCompletedTheme.data : null;
}

// Every mounted slide calls this with the *same* `customThemeData`/`theme`
// references (they come from the same store selection) whenever a theme
// changes, which used to mean N slides each re-running the Zod validation
// chain synchronously in one commit — the visible freeze on theme change.
// A single-entry, reference-equality cache collapses that back down to one
// real computation per distinct theme selection.
let lastResolveArgs: {
  customThemeData: unknown;
  theme: string | null | undefined;
} | null = null;
let lastResolveResult: ThemeProperties | null = null;

export function resolvePresentationThemeData({
  customThemeData,
  theme,
}: {
  customThemeData: unknown;
  theme: string | null | undefined;
}): ThemeProperties | null {
  if (
    lastResolveArgs &&
    lastResolveArgs.customThemeData === customThemeData &&
    lastResolveArgs.theme === theme
  ) {
    return lastResolveResult;
  }

  let result: ThemeProperties | null = null;
  if (customThemeData) {
    result = resolveCompleteCustomThemeData(customThemeData);
    // Custom data failed validation — fall through to built-in lookup
  }

  if (!result && isBuiltInPresentationTheme(theme)) {
    result = themes[theme];
  }

  lastResolveArgs = { customThemeData, theme };
  lastResolveResult = result;
  return result;
}

export function getPersistablePresentationTheme({
  fallbackTheme,
  theme,
}: {
  fallbackTheme: Themes;
  theme: string | null | undefined;
}): Themes | string {
  return isPresentationAutoTheme(theme)
    ? fallbackTheme
    : (theme ?? fallbackTheme);
}

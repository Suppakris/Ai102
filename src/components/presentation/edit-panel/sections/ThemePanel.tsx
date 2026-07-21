"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useMemo } from "react";

import {
  getSystemPresentationThemes,
  getUserCustomThemes,
} from "@/app/_actions/presentation/theme-actions";
import { getUserFavoriteThemes } from "@/app/_actions/presentation/theme-favorite-actions";
import { type CustomTheme } from "@/components/notebook/presentation/components/theme/types";
import { PRESENTATION_AUTO_THEME_ID } from "@/lib/presentation/theme-resolution";
import { themes as builtInThemes } from "@/lib/presentation/themes";
import { usePresentationState } from "@/states/presentation-state";
import { FontsSection } from "../../controls/global-settings/sections/FontsSection";
import { ThemeFilter } from "./theme/Filter";
import { useThemePanelState } from "./theme/theme-panel-state";
import { ThemePanelHeader } from "./theme/ThemeHeader";
import { ThemeSelector, type ThemeListItem } from "./theme/ThemeSelector";
import { ThemeTabs } from "./theme/ThemeTabs";

export function ThemePanel() {
  const { generatedThemeData, theme: activeTheme } = usePresentationState();
  const { tab, showFavorites, showFont } = useThemePanelState();
  const { data: session } = useSession();
  const canEditSystemThemes = session?.user?.isAdmin === true;

  const systemThemesQuery = useQuery({
    queryKey: ["presentation", "themes", "system"],
    queryFn: async () => {
      const result = await getSystemPresentationThemes();
      return result.success ? (result.themes as CustomTheme[]) : [];
    },
    enabled: tab === "standard",
  });

  const userThemesQuery = useQuery({
    queryKey: ["presentation", "themes", "user"],
    queryFn: async () => {
      const result = await getUserCustomThemes();
      return result.success ? (result.themes as CustomTheme[]) : [];
    },
    enabled: tab === "public",
  });

  const favoriteThemesQuery = useQuery({
    queryKey: ["presentation", "themes", "favorites"],
    queryFn: async () => {
      const result = await getUserFavoriteThemes();
      return result.success ? (result.themes as CustomTheme[]) : [];
    },
    enabled: showFavorites,
  });

  const userThemes = userThemesQuery.data ?? [];
  const favoriteThemes = favoriteThemesQuery.data ?? [];
  const systemThemes = systemThemesQuery.data ?? [];

  const standardThemeItems = useMemo<ThemeListItem[]>(() => {
    const systemThemesById = new Map(
      systemThemes.map((item) => [item.id, item]),
    );

    const automaticThemeItem: ThemeListItem[] = generatedThemeData
      ? [
          {
            themeId: PRESENTATION_AUTO_THEME_ID,
            theme: {
              ...generatedThemeData,
              name: generatedThemeData.name || "Custom Theme",
              description:
                generatedThemeData.description ||
                "Generated presentation theme",
            },
            canLike: false,
            showFavoriteButton: false,
          },
        ]
      : [];

    const builtInThemeItems = Object.entries(builtInThemes).map(
      ([key, value]) => {
        const systemTheme = systemThemesById.get(key);
        const themeData = systemTheme
          ? {
              ...value,
              ...systemTheme.themeData,
              name: systemTheme.name,
              description: systemTheme.description ?? value.description,
            }
          : value;

        return {
          themeId: key,
          theme: themeData,
          canLike: false,
          showFavoriteButton: false,
          isAdminTheme: true,
          canEditSystemTheme: canEditSystemThemes,
        };
      },
    );

    return [...automaticThemeItem, ...builtInThemeItems];
  }, [canEditSystemThemes, generatedThemeData, systemThemes]);

  const userThemeItems = useMemo<ThemeListItem[]>(
    () =>
      userThemes.map((item) => ({
        key: item.id,
        themeId: item.id,
        theme: { ...item.themeData, name: item.name },
        isFavorite: item.isFavorite ?? false,
        likeCount: item.likeCount ?? 0,
        isLiked: item.isLiked ?? false,
        canLike: false,
        showFavoriteButton: true,
        isUserTheme: true,
      })),
    [userThemes],
  );

  const favoriteThemeItems = useMemo<ThemeListItem[]>(
    () =>
      favoriteThemes.map((item) => ({
        key: item.id,
        themeId: item.id,
        theme: { ...item.themeData, name: item.name },
        isFavorite: item.isFavorite ?? true,
        likeCount: item.likeCount ?? 0,
        isLiked: item.isLiked ?? false,
        canLike: false,
        showFavoriteButton: true,
        isUserTheme: item.userId === session?.user?.id,
      })),
    [favoriteThemes, session?.user?.id],
  );

  let themesForSelector: ThemeListItem[] = [];
  if (showFavorites) {
    themesForSelector = favoriteThemeItems;
  } else if (tab === "public") {
    themesForSelector = userThemeItems;
  } else {
    themesForSelector = standardThemeItems;
  }

  const isLoadingThemes = showFavorites
    ? favoriteThemesQuery.isPending
    : tab === "public" && userThemesQuery.isPending;

  return (
    <div className="flex h-full flex-col gap-2 bg-background">
      <ThemePanelHeader />
      <ThemeTabs />
      <ThemeFilter />

      {showFont ? (
        <div className="scrollbar-thin max-h-[calc(100vh-4rem-4rem-4rem)] overflow-y-auto px-4 pt-2 pb-4 scrollbar-thumb-accent">
          <FontsSection />
        </div>
      ) : (
        <ThemeSelector
          themes={themesForSelector}
          activeKey={String(activeTheme)}
          isLoading={isLoadingThemes && !themesForSelector.length}
          emptyMessage={
            showFavorites
              ? "You have not favorited any themes yet."
              : tab === "public"
                ? "You have not created any themes yet."
                : "No themes available right now."
          }
        />
      )}
    </div>
  );
}

"use server";

import { auth } from "@/backend/auth";
import { db } from "@/backend/db";

// Toggle favorite status for a theme
export async function toggleFavoriteTheme(themeId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        message: "You must be signed in to favorite themes",
        isFavorite: false,
      };
    }

    // Check if theme exists
    const theme = await db.presentationTheme.findUnique({
      where: { id: themeId },
    });

    if (!theme) {
      return { success: false, message: "Theme not found", isFavorite: false };
    }

    // Check if already favorited
    const existingFavorite = await db.favoritePresentationTheme.findUnique({
      where: {
        userId_themeId: {
          userId: session.user.id,
          themeId,
        },
      },
    });

    if (existingFavorite) {
      // Remove favorite
      await db.favoritePresentationTheme.delete({
        where: {
          userId_themeId: {
            userId: session.user.id,
            themeId,
          },
        },
      });
      return {
        success: true,
        isFavorite: false,
        message: "Theme removed from favorites",
      };
    } else {
      // Add favorite
      await db.favoritePresentationTheme.create({
        data: {
          userId: session.user.id,
          themeId,
        },
      });
      return {
        success: true,
        isFavorite: true,
        message: "Theme added to favorites",
      };
    }
  } catch (error) {
    console.error("Failed to toggle favorite:", error);
    return {
      success: false,
      message: "Something went wrong. Please try again later.",
      isFavorite: false,
    };
  }
}

const FAVORITE_THEMES_PER_PAGE = 50;

// Get favorite themes for the current user, including like counts and user liked flag
export async function getUserFavoriteThemes(
  page = 1,
  limit = FAVORITE_THEMES_PER_PAGE,
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        message: "You must be signed in to view favorite themes",
        themes: [],
        hasMore: false,
      };
    }

    const rows = await db.favoritePresentationTheme.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        theme: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
            _count: {
              select: {
                presentationThemeLikes: true,
              },
            },
            presentationThemeLikes: {
              where: {
                userId: session.user.id,
              },
              select: {
                id: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: Math.max(page - 1, 0) * limit,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const favorites = hasMore ? rows.slice(0, limit) : rows;

    const themes = favorites.map((fav) => ({
      ...fav.theme,
      likeCount: fav.theme._count.presentationThemeLikes,
      isLiked: !!fav.theme.presentationThemeLikes?.length,
      isFavorite: true,
    }));

    return {
      success: true,
      themes,
      hasMore,
    };
  } catch (error) {
    console.error("Failed to fetch favorite themes:", error);
    return {
      success: false,
      message: "Unable to load favorite themes. Please try again later.",
      themes: [],
      hasMore: false,
    };
  }
}

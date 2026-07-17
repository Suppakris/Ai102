"use server";

import { auth } from "@/backend/auth";
import { db } from "@/backend/db";

// Toggle like status for a theme
export async function toggleLikeTheme(themeId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        message: "You must be signed in to like themes",
        isLiked: false,
        likeCount: 0,
      };
    }

    // Check if theme exists
    const theme = await db.presentationTheme.findUnique({
      where: { id: themeId },
    });

    if (!theme) {
      return {
        success: false,
        message: "Theme not found",
        isLiked: false,
        likeCount: 0,
      };
    }

    // Check if already liked
    const existingLike = await db.presentationThemeLike.findUnique({
      where: {
        userId_themeId: {
          userId: session.user.id,
          themeId,
        },
      },
    });

    if (existingLike) {
      // Remove like
      await db.presentationThemeLike.delete({
        where: {
          userId_themeId: {
            userId: session.user.id,
            themeId,
          },
        },
      });
    } else {
      // Add like
      await db.presentationThemeLike.create({
        data: {
          userId: session.user.id,
          themeId,
        },
      });
    }

    // Get updated like count
    const likeCount = await db.presentationThemeLike.count({
      where: { themeId },
    });

    // Check if user still likes it
    const isLiked = !existingLike;

    return {
      success: true,
      isLiked,
      likeCount,
      message: isLiked ? "Theme liked" : "Theme unliked",
    };
  } catch (error) {
    console.error("Failed to toggle like:", error);
    return {
      success: false,
      message: "Something went wrong. Please try again later.",
      isLiked: false,
      likeCount: 0,
    };
  }
}

"use server";

import * as z from "zod";

import { presentationThemeStyleDataSchema } from "@/lib/presentation/theme-schema";
import { auth } from "@/backend/auth";
import { db } from "@/backend/db";
import { getOrCreatePersonalTenant } from "@/backend/tenant";

// Schema for creating/updating a theme
const themeSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  themeData: presentationThemeStyleDataSchema,
  logoUrl: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
});

export type ThemeFormData = z.infer<typeof themeSchema>;

// Create a new custom theme
export async function createCustomTheme(formData: ThemeFormData) {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        message: "You must be signed in to create a theme",
      };
    }

    const validatedData = themeSchema.parse(formData);
    const tenantId = await getOrCreatePersonalTenant(session.user.id);

    const newTheme = await db.presentationTheme.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        themeData: validatedData.themeData,
        logoUrl: validatedData.logoUrl,
        isPublic: false,
        userId: session.user.id,
        tenantId,
      },
    });

    return {
      success: true,
      themeId: newTheme.id,
      message: "Theme created successfully",
    };
  } catch (error) {
    console.error("Failed to create custom theme:", error);

    // Log the actual error but return a generic message
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Invalid theme data. Please check your inputs and try again.",
      };
    } else if (error instanceof Error && error.message.includes("Prisma")) {
      return {
        success: false,
        message: "Database error. Please try again later.",
      };
    } else {
      return {
        success: false,
        message: "Something went wrong. Please try again later.",
      };
    }
  }
}

// Update an existing custom theme
export async function updateCustomTheme(
  themeId: string,
  formData: ThemeFormData,
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        message: "You must be signed in to update a theme",
      };
    }

    const validatedData = themeSchema.parse(formData);

    // Verify ownership
    const existingTheme = await db.presentationTheme.findUnique({
      where: { id: themeId },
    });

    if (!existingTheme) {
      return { success: false, message: "Theme not found" };
    }

    if (existingTheme.userId !== session.user.id) {
      return { success: false, message: "Not authorized to update this theme" };
    }

    await db.presentationTheme.update({
      where: { id: themeId },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        themeData: validatedData.themeData,
        logoUrl: validatedData.logoUrl,
        isPublic: false,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: "Theme updated successfully",
    };
  } catch (error) {
    console.error("Failed to update custom theme:", error);

    // Log the actual error but return a generic message
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Invalid theme data. Please check your inputs and try again.",
      };
    } else if (error instanceof Error && error.message.includes("Prisma")) {
      return {
        success: false,
        message: "Database error. Please try again later.",
      };
    } else {
      return {
        success: false,
        message: "Something went wrong. Please try again later.",
      };
    }
  }
}

// Update a system theme in place. Only application admins can change seeded themes.
export async function updateAdminPresentationTheme(
  themeId: string,
  formData: ThemeFormData,
) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return {
        success: false,
        message: "Not authorized to update system themes",
      };
    }

    const validatedData = themeSchema.parse(formData);

    const existingTheme = await db.presentationTheme.findUnique({
      where: { id: themeId },
      select: { isAdmin: true },
    });

    if (!existingTheme) {
      return { success: false, message: "Theme not found" };
    }

    if (!existingTheme.isAdmin) {
      return {
        success: false,
        message: "This action can only update system themes",
      };
    }

    await db.presentationTheme.update({
      where: { id: themeId },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        themeData: validatedData.themeData,
        logoUrl: validatedData.logoUrl,
        isPublic: false,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: "System theme updated successfully",
    };
  } catch (error) {
    console.error("Failed to update system theme:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Invalid theme data. Please check your inputs and try again.",
      };
    } else if (error instanceof Error && error.message.includes("Prisma")) {
      return {
        success: false,
        message: "Database error. Please try again later.",
      };
    } else {
      return {
        success: false,
        message: "Something went wrong. Please try again later.",
      };
    }
  }
}

// Get system themes that are stored in the database
export async function getSystemPresentationThemes() {
  try {
    const themes = await db.presentationTheme.findMany({
      where: {
        isAdmin: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return {
      success: true,
      themes,
    };
  } catch (error) {
    console.error("Failed to fetch system themes:", error);
    return {
      success: false,
      message:
        "Unable to load system themes at this time. Please try again later.",
      themes: [],
    };
  }
}

const THEMES_PER_PAGE = 50;

// Get all custom themes for the current user
export async function getUserCustomThemes(page = 1, limit = THEMES_PER_PAGE) {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        message: "You must be signed in to view your themes",
        themes: [],
        hasMore: false,
      };
    }

    const rows = await db.presentationTheme.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: Math.max(page - 1, 0) * limit,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;

    return {
      success: true,
      themes: hasMore ? rows.slice(0, limit) : rows,
      hasMore,
    };
  } catch (error) {
    console.error("Failed to fetch custom themes:", error);
    return {
      success: false,
      message: "Unable to load themes at this time. Please try again later.",
      themes: [],
      hasMore: false,
    };
  }
}

// Get all public themes, including like counts and user engagement flags
export async function getPublicCustomThemes(page = 1, limit = THEMES_PER_PAGE) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const rows = await db.presentationTheme.findMany({
      where: {
        isPublic: true,
        isAdmin: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: Math.max(page - 1, 0) * limit,
      take: limit + 1,
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
        presentationThemeLikes: userId
          ? {
              where: {
                userId,
              },
            }
          : undefined,
        favoritePresentationThemes: userId
          ? {
              where: {
                userId,
              },
            }
          : undefined,
      },
    });

    const hasMore = rows.length > limit;
    const themes = hasMore ? rows.slice(0, limit) : rows;

    const shapedThemes = themes.map((theme) => ({
      ...theme,
      name: theme.name,
      likeCount: theme._count.presentationThemeLikes,
      isLiked: !!theme.presentationThemeLikes?.length,
      isFavorite: !!theme.favoritePresentationThemes?.length,
    }));

    return {
      success: true,
      themes: shapedThemes,
      hasMore,
    };
  } catch (error) {
    console.error("Failed to fetch public themes:", error);
    return {
      success: false,
      message:
        "Unable to load public themes at this time. Please try again later.",
      themes: [],
      hasMore: false,
    };
  }
}

// Get a single theme by ID
export async function getCustomThemeById(themeId: string) {
  try {
    const theme = await db.presentationTheme.findUnique({
      where: { id: themeId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!theme) {
      return { success: false, message: "Theme not found" };
    }

    return {
      success: true,
      theme,
    };
  } catch (error) {
    console.error("Failed to fetch theme:", error);
    return {
      success: false,
      message: "Unable to load the theme at this time. Please try again later.",
    };
  }
}

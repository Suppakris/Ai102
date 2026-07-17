"use server";

import "server-only";

import { logger } from "@/lib/observability/server/logger";
import { DocumentType, type Prisma } from "@/prisma/client";
import { auth } from "@/backend/auth";
import { db } from "@/backend/db";

const ITEMS_PER_PAGE = 10;
const PRESENTATION_DOCUMENT_TYPES = [DocumentType.PRESENTATION] as const;
export type PresentationDocumentTypeFilter =
  (typeof PRESENTATION_DOCUMENT_TYPES)[number];

type PresentationContentShape = {
  slides?: unknown;
};

function hasSlideContent(value: Prisma.JsonValue): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const content = value as PresentationContentShape;
  return Array.isArray(content.slides) && content.slides.length > 0;
}

export async function fetchPresentations(
  page = 0,
  type?: PresentationDocumentTypeFilter,
  options?: {
    favoritesOnly?: boolean;
  },
) {
  const actionName = "presentation.fetchPresentations.fetchPresentations";
  const span = logger.startSpan(`notebook.server_action.${actionName}`, {
    attributes: {
      "allweone.scope": "notebook",
      "allweone.action.type": "server_action",
      "allweone.action.name": actionName,
    },
  });

  try {
    const session = await auth();
    const userId = session?.user.id;

    if (!userId) {
      return {
        items: [],
        hasMore: false,
      };
    }

    const skip = page * ITEMS_PER_PAGE;
    const documentType = type ?? PRESENTATION_DOCUMENT_TYPES[0];

    const rows = await db.baseDocument.findMany({
      where: {
        userId,
        type: documentType,
        ...(options?.favoritesOnly
          ? {
              favorites: {
                some: { userId },
              },
            }
          : {}),
      },
      orderBy: {
        updatedAt: "desc",
      },
      skip,
      take: ITEMS_PER_PAGE + 1,
      include: {
        favorites: {
          where: { userId },
          select: { id: true },
          take: 1,
        },
        presentation: {
          select: {
            content: true,
          },
        },
      },
    });

    const hasMore = rows.length > ITEMS_PER_PAGE;
    const items = hasMore ? rows.slice(0, ITEMS_PER_PAGE) : rows;

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        thumbnailUrl: item.thumbnailUrl,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        isOwnedByCurrentUser: true,
        favorites: item.favorites,
        hasSlides: hasSlideContent(item.presentation?.content ?? null),
        hasContent: hasSlideContent(item.presentation?.content ?? null),
      })),
      hasMore,
    };
  } catch (error) {
    span.error(error);
    throw error;
  } finally {
    span.end();
  }
}

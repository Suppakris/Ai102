"use server";

import { auth } from "@/backend/auth";
import { db } from "@/backend/db";
import { DocumentType } from "@/prisma/client";

type PresentationFavoriteResult = {
  success: boolean;
  message: string;
  isFavorite?: boolean;
};

async function canFavoritePresentation(documentId: string, userId: string) {
  const document = await db.baseDocument.findUnique({
    where: { id: documentId },
    select: {
      isPublic: true,
      type: true,
      userId: true,
    },
  });

  return (
    document?.type === DocumentType.PRESENTATION &&
    (document.isPublic || document.userId === userId)
  );
}

export async function addPresentationToFavorites(
  documentId: string,
): Promise<PresentationFavoriteResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, message: "Unauthorized", isFavorite: false };
  }

  const canFavorite = await canFavoritePresentation(
    documentId,
    session.user.id,
  );
  if (!canFavorite) {
    return {
      success: false,
      message: "Presentation not found",
      isFavorite: false,
    };
  }

  await db.favoriteDocument.upsert({
    where: {
      userId_documentId: {
        userId: session.user.id,
        documentId,
      },
    },
    update: {},
    create: {
      userId: session.user.id,
      documentId,
    },
  });

  return {
    success: true,
    message: "Presentation added to favorites",
    isFavorite: true,
  };
}

export async function removePresentationFromFavorites(
  documentId: string,
): Promise<PresentationFavoriteResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, message: "Unauthorized", isFavorite: false };
  }

  const canFavorite = await canFavoritePresentation(
    documentId,
    session.user.id,
  );
  if (!canFavorite) {
    return {
      success: false,
      message: "Presentation not found",
      isFavorite: false,
    };
  }

  await db.favoriteDocument.deleteMany({
    where: {
      userId: session.user.id,
      documentId,
    },
  });

  return {
    success: true,
    message: "Presentation removed from favorites",
    isFavorite: false,
  };
}

export async function togglePresentationFavorite(
  documentId: string,
): Promise<PresentationFavoriteResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, message: "Unauthorized", isFavorite: false };
  }

  const canFavorite = await canFavoritePresentation(
    documentId,
    session.user.id,
  );
  if (!canFavorite) {
    return {
      success: false,
      message: "Presentation not found",
      isFavorite: false,
    };
  }

  const favorite = await db.favoriteDocument.findUnique({
    where: {
      userId_documentId: {
        userId: session.user.id,
        documentId,
      },
    },
    select: { id: true },
  });

  if (favorite) {
    await db.favoriteDocument.delete({
      where: { id: favorite.id },
    });

    return {
      success: true,
      message: "Presentation removed from favorites",
      isFavorite: false,
    };
  }

  await db.favoriteDocument.create({
    data: {
      userId: session.user.id,
      documentId,
    },
  });

  return {
    success: true,
    message: "Presentation added to favorites",
    isFavorite: true,
  };
}

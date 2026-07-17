"use server";

import { logger } from "@/lib/observability/server/logger";
import { auth } from "@/backend/auth";
import { db } from "@/backend/db";
import { canEditDocument } from "@/backend/share/authorization";
import { normalizeShareEmail } from "@/backend/share/utils";

type UpdatePresentationThumbnailUrlParams = {
  id: string;
  thumbnailUrl: string | null;
  onlyIfMissing?: boolean;
};

export async function updatePresentationThumbnailUrl({
  id,
  thumbnailUrl,
  onlyIfMissing = false,
}: UpdatePresentationThumbnailUrlParams) {
  const actionName =
    "presentation.presentationThumbnailActions.updatePresentationThumbnailUrl";
  const span = logger.startSpan(`presentation.server_action.${actionName}`, {
    attributes: {
      "allweone.scope": "presentation",
      "allweone.action.type": "server_action",
      "allweone.action.name": actionName,
    },
  });

  try {
    const session = await auth();

    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const canEdit = await canEditDocument(id, {
      userId: session.user.id,
      userEmail: session.user.email
        ? normalizeShareEmail(session.user.email)
        : null,
    });

    if (!canEdit) {
      return {
        success: false,
        message: "You do not have permission to edit this presentation",
      };
    }

    try {
      const updateResult = onlyIfMissing
        ? await db.baseDocument.updateMany({
            where: {
              id,
              thumbnailUrl: null,
            },
            data: {
              thumbnailUrl,
            },
          })
        : await db.baseDocument.update({
            where: { id },
            data: {
              thumbnailUrl,
            },
          });

      return {
        success: true,
        message: "Presentation thumbnail updated successfully",
        thumbnailUrl,
        updated: "count" in updateResult ? updateResult.count > 0 : true,
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        message: "Failed to update presentation thumbnail",
      };
    }
  } catch (error) {
    span.error(error);
    throw error;
  } finally {
    span.end();
  }
}

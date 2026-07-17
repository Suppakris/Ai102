"use server";

import { logger } from "@/lib/observability/server/logger";
import { auth } from "@/backend/auth";

export async function clearPresentationChat(presentationId: string) {
  const actionName = "presentation.clearPresentationChat.clearPresentationChat";
  const span = logger.startSpan(`notebook.server_action.${actionName}`, {
    attributes: {
      "allweone.scope": "notebook",
      "allweone.action.type": "server_action",
      "allweone.action.name": actionName,
    },
  });

  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    void presentationId;
    return { success: true };
  } catch (error) {
    span.error(error);
    throw error;
  } finally {
    span.end();
  }
}

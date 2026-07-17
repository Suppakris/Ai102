import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { type HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import {
  consumeStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

import { createPresentationGraph } from "@/backend/agent/agents/presentation/createAgent";
import { recordAgentThreadActivity } from "@/backend/agent/lib/prune-checkpoints";
import { getLatestUserMessage } from "@/lib/ai/uiMessageParts";
import { logger } from "@/lib/observability/server/logger";
import { auth } from "@/backend/auth";
import { checkRateLimit, rateLimitResponse } from "@/backend/rate-limit";

type PresentationStreamOptions = Parameters<
  ReturnType<typeof createPresentationGraph>["stream"]
>[1] & {
  interruptBefore?: string[];
};

export async function POST(req: Request) {
  let endSpanOnReturn = true;
  const actionName = "agent.presentation.post";
  const span = logger.startSpan(`allweone.api.${actionName}`, {
    attributes: {
      "allweone.scope": "api",
      "allweone.action.type": "api_route",
      "allweone.action.name": actionName,
      "http.method": "POST",
      "http.route": "/api/agent/presentation",
    },
  });

  try {
    const { id, messages, resumeData } = (await req.json()) as {
      id?: string;
      messages?: UIMessage[];
      resumeData?: Record<string, unknown>;
    };

    if (!id) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "missing_presentation_id",
      });
      return new Response("Missing presentation id", { status: 400 });
    }

    const session = await auth();

    if (!session?.user) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "unauthorized",
      });
      return new Response("Unauthorized", { status: 401 });
    }

    const rateLimit = await checkRateLimit(`agent-presentation:${session.user.id}`, {
      max: 30,
      windowSeconds: 300,
    });
    if (!rateLimit.allowed) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "rate_limited",
      });
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    span.annotate({
      "allweone.thread.id": `presentation:${id}`,
      "allweone.thread.type": "presentation",
      "allweone.presentation.thread_id": id,
      "allweone.presentation.message.count": Array.isArray(messages)
        ? messages.length
        : 0,
      "allweone.presentation.resume.present": Boolean(resumeData),
    });

    // Not awaited: this just marks the thread as active for the pruning
    // job (see prune-checkpoints.ts) and shouldn't add latency to the
    // agent response.
    void recordAgentThreadActivity(id).catch((error) => span.error(error));

    const graph = createPresentationGraph();
    const streamOptions: PresentationStreamOptions = {
      streamMode: ["values", "messages"],
      interruptBefore: ["tools"],
      configurable: {
        thread_id: id,
      },
    };
    const stream = await (resumeData
      ? graph.stream(
          new Command({ resume: resumeData }),
          streamOptions as Parameters<typeof graph.stream>[1],
        )
      : (async () => {
          const latestUserMessage = getLatestUserMessage(
            Array.isArray(messages) ? messages : [],
          );

          const [lastUserMessage] = latestUserMessage
            ? await toBaseMessages([latestUserMessage])
            : [];

          if (!lastUserMessage) {
            throw new Error("No user message found in request");
          }

          return graph.stream(
            {
              messages: [lastUserMessage as HumanMessage],
            },
            streamOptions as Parameters<typeof graph.stream>[1],
          );
        })());
    span.event("allweone.api.response_stream_created");
    endSpanOnReturn = false;

    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),
      consumeSseStream: ({ stream: sseStream }) => {
        void consumeStream({
          stream: sseStream,
          onError: (error) => {
            span.error(error);
          },
        }).finally(() => {
          span.end();
        });
      },
    });
  } catch (error) {
    span.error(error);
    return new Response("Internal Server Error", { status: 500 });
  } finally {
    if (endSpanOnReturn) {
      span.end();
    }
  }
}

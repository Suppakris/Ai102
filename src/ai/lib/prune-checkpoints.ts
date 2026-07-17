import { checkpointer } from "@/ai/lib/postgres";
import { db } from "@/server/db";

// LangGraph checkpoints one full state snapshot per graph step, keyed by
// thread_id (== BaseDocument.id — see createAgent.ts), with no built-in cap
// or TTL: a presentation that gets edited a lot via the agent accumulates
// checkpoint/blob/write rows in Postgres forever. This is the storage-side
// capacity limit for that — NOT prompt/context-window trimming, which
// createAgent.ts's trimMessages middleware already handles.
//
// We only ever delete a thread's checkpoint history in full, via
// PostgresSaver's own deleteThread — that's the one operation LangGraph
// documents/supports. Partially trimming older checkpoints within an active
// thread isn't safe to do by hand: later checkpoints can still reference
// earlier checkpoint_blobs rows for channels that haven't changed since, so
// there's no well-defined "delete everything before the last N" query
// without re-deriving that reference set from each checkpoint's contents.
export async function recordAgentThreadActivity(threadId: string): Promise<void> {
  await db.agentThread.upsert({
    where: { threadId },
    update: { lastActiveAt: new Date() },
    create: { threadId },
  });
}

export type PruneResult = {
  threadsChecked: number;
  threadsPruned: string[];
};

// Wipes checkpoint history for threads that haven't been touched in
// `retentionDays`. Meant to run on a schedule (see worker.ts), not on the
// request path — deleting an active thread's history out from under an
// in-flight interrupt/resume would break that flow.
export async function pruneStaleAgentThreads(
  retentionDays = 30,
): Promise<PruneResult> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const staleThreads = await db.agentThread.findMany({
    where: { lastActiveAt: { lt: cutoff } },
    select: { threadId: true },
  });

  const threadsPruned: string[] = [];
  for (const { threadId } of staleThreads) {
    await checkpointer.deleteThread(threadId);
    await db.agentThread.delete({ where: { threadId } }).catch(() => {
      // Already removed by a concurrent run — fine.
    });
    threadsPruned.push(threadId);
  }

  return { threadsChecked: staleThreads.length, threadsPruned };
}

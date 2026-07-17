// Standalone entry point for the worker process — run via `pnpm queue:worker`
// (or the `worker` service in docker-compose.yml). Not imported by the
// Next.js app itself. Runs two things, both decoupled from the web server:
//   1. the BullMQ image-generation consumer (requires REDIS_URL)
//   2. the periodic LangGraph checkpoint-pruning job (Postgres only)
import { pruneStaleAgentThreads } from "@/backend/agent/lib/prune-checkpoints";
import { env } from "@/env";
import { Worker } from "bullmq";
import {
  IMAGE_GENERATION_QUEUE_NAME,
  processImageGenerationJob,
} from "./image-generation";
import { getRedisConnection } from "./redis";

const connection = getRedisConnection();

if (connection) {
  // Rate control: caps how many image-generation jobs this worker starts
  // per second, independent of how many client requests are enqueuing
  // them, so a burst of decks generating images at once can't blow through
  // the image provider's own rate limit. Retries/backoff are configured
  // per-job in image-generation.ts (DEFAULT_JOB_OPTIONS).
  const CONCURRENCY = 3;
  const RATE_LIMIT_MAX = 5;
  const RATE_LIMIT_DURATION_MS = 1000;

  const worker = new Worker(
    IMAGE_GENERATION_QUEUE_NAME,
    async (job) => processImageGenerationJob(job.data),
    {
      connection,
      concurrency: CONCURRENCY,
      limiter: { max: RATE_LIMIT_MAX, duration: RATE_LIMIT_DURATION_MS },
    },
  );

  worker.on("completed", (job) => {
    console.log(`[queue:worker] ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[queue:worker] ${job?.id} failed:`, err);
  });

  console.log(
    `[queue:worker] listening on "${IMAGE_GENERATION_QUEUE_NAME}" (concurrency=${CONCURRENCY}, env=${env.NODE_ENV})`,
  );

  process.on("SIGTERM", () => void worker.close().then(() => process.exit(0)));
  process.on("SIGINT", () => void worker.close().then(() => process.exit(0)));
} else {
  console.warn(
    "[queue:worker] REDIS_URL not set — image-generation queue consumer not started (jobs run inline in the web process instead).",
  );
}

// Checkpoint pruning: doesn't need Redis, only Postgres, so it runs
// regardless of whether the queue half of this process is active.
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 30;

async function runPruneJob() {
  try {
    const result = await pruneStaleAgentThreads(RETENTION_DAYS);
    if (result.threadsPruned.length > 0) {
      console.log(
        `[prune:agent-threads] pruned ${result.threadsPruned.length}/${result.threadsChecked} stale thread(s)`,
      );
    }
  } catch (error) {
    console.error("[prune:agent-threads] failed:", error);
  }
}

void runPruneJob();
setInterval(runPruneJob, PRUNE_INTERVAL_MS);

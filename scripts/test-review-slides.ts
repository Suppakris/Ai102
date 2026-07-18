/**
 * Standalone Day-1 test harness for reviewSlides() — no backend needed.
 *
 * Run with:  pnpm review:test
 * Needs a reachable LLM: either local Ollama, OLLAMA_BASE_URL, or
 * OPENROUTER_API_KEY (then pass --openrouter).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local manually (Next.js normally does this; tsx does not) and
// skip full env validation — this script only needs the model vars.
process.env.SKIP_ENV_VALIDATION = "1";
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const match = /^([A-Z0-9_]+)="?([^"\r]*)"?/.exec(line.trim());
    if (match?.[1] && match[2] && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
} catch {
  // no .env.local — rely on shell env / defaults (localhost Ollama)
}

const useOpenRouter = process.argv.includes("--openrouter");

const sampleDecks = [
  {
    name: "GOOD deck (expect: pass, no revision)",
    input: {
      user_id: "test-user",
      document_id: "deck-good",
      source_context:
        "Q2 2026 company report: revenue grew 18% quarter-over-quarter to $2.4M. Customer churn dropped from 5.1% to 3.8% after the March onboarding redesign. Headcount is 42, with 6 open engineering roles.",
      slides: [
        {
          slide_number: 1,
          content:
            "Q2 2026 Results\nRevenue up 18% QoQ to $2.4M\nChurn down: 5.1% → 3.8%",
        },
        {
          slide_number: 2,
          content:
            "What drove the churn drop\n• March onboarding redesign\n• Faster time-to-first-value\n• Proactive support outreach",
        },
        {
          slide_number: 3,
          content:
            "Team\n42 people today\nHiring: 6 engineering roles open\nFocus: ship, retain, grow",
        },
      ],
    },
  },
  {
    name: "WEAK deck with invented stats (expect: needs_revision, UNSUPPORTED claims)",
    input: {
      user_id: "test-user",
      document_id: "deck-weak",
      source_context:
        "Q2 2026 company report: revenue grew 18% quarter-over-quarter to $2.4M.",
      slides: [
        {
          slide_number: 1,
          content:
            "Amazing Quarter!!! Revenue grew 45% and we signed 300 enterprise customers including Google and NASA. Our AI is 10x better than all competitors. Churn is basically zero now. Also we are opening offices in 12 countries and everyone is very excited about many things that are happening across all departments and teams worldwide.",
        },
      ],
    },
  },
  {
    name: "THAI deck with one fake stat (expect: Thai feedback, fake claim caught)",
    input: {
      user_id: "test-user",
      document_id: "deck-thai",
      source_context:
        "รายงานโครงงาน Ai102: ระบบสร้างสไลด์อัตโนมัติด้วย AI ทำงานบน Ollama โดยไม่มีค่าใช้จ่าย รองรับผู้ใช้พร้อมกันได้ 4-10 คน สร้างงานนำเสนอเสร็จภายในประมาณ 2 นาทีต่อชุด",
      slides: [
        {
          slide_number: 1,
          content:
            "Ai102: ระบบสร้างสไลด์อัตโนมัติ\n• ใช้ AI สร้างงานนำเสนอจากหัวข้อเดียว\n• ทำงานบน Ollama ไม่มีค่าใช้จ่าย",
        },
        {
          slide_number: 2,
          content:
            "ประสิทธิภาพ\n• รองรับผู้ใช้พร้อมกัน 4-10 คน\n• สร้างเสร็จใน 2 นาทีต่อชุด\n• มีผู้ใช้งานแล้วกว่า 50,000 คนทั่วประเทศ",
        },
      ],
    },
  },
  {
    name: "SPARSE deck (expect: clarifying_questions, no LLM guessing)",
    input: {
      user_id: "test-user",
      document_id: "deck-sparse",
      slides: [
        { slide_number: 1, content: "Intro" },
        { slide_number: 2, content: "Stuff" },
        { slide_number: 3, content: "Thanks!" },
      ],
    },
  },
];

async function main() {
  const { reviewSlides, reviewAndRevise } = await import(
    "@/backend/ai/reviewSlides"
  );
  const opts = useOpenRouter
    ? ({ modelProvider: "openrouter" } as const)
    : undefined;

  for (const deck of sampleDecks) {
    console.log(`\n=== ${deck.name} ===`);
    const started = Date.now();
    try {
      const result = await reviewSlides(deck.input, opts);
      console.log(JSON.stringify(result, null, 2));
      console.log(`(took ${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (error) {
      console.error("REVIEW FAILED:", error);
      process.exitCode = 1;
    }
  }

  // Day 2: the weak deck should trigger exactly one corrective pass and the
  // revised deck should score higher than the original.
  const weakDeck = sampleDecks[1]!;
  console.log("\n=== REVISION LOOP on weak deck (expect: one pass, improved score) ===");
  const started = Date.now();
  try {
    const result = await reviewAndRevise(weakDeck.input, opts);
    console.log(JSON.stringify(result, null, 2));
    if (result.revision.applied && result.revision.initial_review) {
      const before = result.revision.initial_review.score;
      const after = result.score;
      const avg = (s: typeof before) =>
        (s.clarity + s.design + s.content_accuracy) / 3;
      console.log(
        `\nAverage score: ${avg(before).toFixed(1)} → ${avg(after).toFixed(1)} | still needs_revision: ${result.needs_revision}`,
      );
    }
    console.log(`(took ${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (error) {
    console.error("REVISION LOOP FAILED:", error);
    process.exitCode = 1;
  }
}

void main();

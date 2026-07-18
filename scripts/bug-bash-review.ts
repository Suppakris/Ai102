/**
 * Day-3 bug bash: throw realistic and adversarial decks at reviewSlides()
 * and log every failure or weird output. Run with: pnpm review:bash
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
  // rely on shell env
}

interface BashCase {
  name: string;
  expect: string;
  input: {
    user_id: string;
    document_id: string;
    slides: Array<{ slide_number: number; content: string }>;
    source_context?: string;
  };
}

const cases: BashCase[] = [
  {
    name: "XML slides (what production actually sends)",
    expect: "reviews normally; XML tags not treated as content problems",
    input: {
      user_id: "bash",
      document_id: "xml-deck",
      source_context:
        "Ai102 course project: an AI presentation generator running on Ollama. Supports 4-10 concurrent users. Generation takes about 2 minutes per deck.",
      slides: [
        {
          slide_number: 1,
          content:
            '<SECTION layout="left">\n  <H1>Ai102: AI Presentation Generator</H1>\n  <BULLETS>\n    <DIV><H3>Free to run</H3><P>Runs on Ollama with no cloud costs</P></DIV>\n    <DIV><H3>Fast</H3><P>About 2 minutes per deck</P></DIV>\n  </BULLETS>\n  <IMG query="AI generating presentation slides" />\n</SECTION>',
        },
        {
          slide_number: 2,
          content:
            '<SECTION layout="vertical">\n  <H1>Capacity</H1>\n  <P>Supports 4-10 concurrent users</P>\n  <P>Deployed on Vercel with 99.999% uptime SLA</P>\n</SECTION>',
        },
      ],
    },
  },
  {
    name: "Subtly wrong number (source says 18%, slide says 17%)",
    expect: "17% NOT marked SUPPORTED",
    input: {
      user_id: "bash",
      document_id: "off-by-one",
      source_context:
        "Q2 report: revenue grew 18% quarter-over-quarter to $2.4M.",
      slides: [
        {
          slide_number: 1,
          content:
            "Q2 2026 Financial Results\nRevenue grew 17% quarter-over-quarter, reaching $2.4M\nStrong momentum heading into the second half of the year",
        },
        {
          slide_number: 2,
          content:
            "What drove the quarter\n• Expansion revenue from existing accounts\n• Two new enterprise logos closed in June",
        },
      ],
    },
  },
  {
    name: "Mixed Thai/English deck",
    expect: "coherent feedback in one of the deck's languages, not a third",
    input: {
      user_id: "bash",
      document_id: "mixed-lang",
      slides: [
        {
          slide_number: 1,
          content:
            "Roadmap Q3\n• เพิ่มระบบรีวิวสไลด์ด้วย AI (AI slide review)\n• Improve onboarding flow",
        },
        {
          slide_number: 2,
          content:
            "Team Goals\n• ลดเวลา generation ลง 30%\n• Ship review feature to production",
        },
      ],
    },
  },
  {
    name: "JSON-breaking characters (quotes, braces, backticks)",
    expect: "valid structured output, no parse failure",
    input: {
      user_id: "bash",
      document_id: "json-breakers",
      slides: [
        {
          slide_number: 1,
          content:
            'Config Tips\n• Set {"debug": true} in config.json\n• Use `npm run dev` — don\'t use "npm start"\n• Escape \\n and \\" in strings\n• 100% of devs love JSON... right?',
        },
      ],
    },
  },
  {
    name: "Long deck (12 slides, context window stress)",
    expect: "completes without truncation errors; audit covers late slides",
    input: {
      user_id: "bash",
      document_id: "long-deck",
      source_context:
        "Annual report 2026: revenue $12M (up 22%), 85 employees across 3 offices (Bangkok, Singapore, Tokyo), NPS score 61, churn 2.9%, series B raised $30M led by Alpha Ventures.",
      slides: Array.from({ length: 12 }, (_, i) => ({
        slide_number: i + 1,
        content: [
          "2026 Overview\nRevenue $12M, up 22% year over year",
          "Team\n85 employees across 3 offices",
          "Offices\nBangkok, Singapore, Tokyo",
          "Customer love\nNPS score of 61",
          "Retention\nChurn at 2.9%",
          "Funding\nSeries B: $30M led by Alpha Ventures",
          "Product\nShipped 14 major features this year",
          "Roadmap\nDouble down on AI-assisted workflows",
          "Culture\nRemote-first with quarterly onsites",
          "Community\nHosted 6 meetups and 2 conferences",
          "Open source\nMaintaining 3 public libraries",
          "Thank you\nQuestions welcome",
        ][i]!,
      })),
    },
  },
  {
    name: "Image-only slides (IMG tags, almost no text)",
    expect: "sparse guard OR clarifying questions, no invented review",
    input: {
      user_id: "bash",
      document_id: "image-only",
      slides: [
        {
          slide_number: 1,
          content: '<SECTION layout="background"><IMG query="mountain sunrise" /></SECTION>',
        },
        {
          slide_number: 2,
          content: '<SECTION layout="background"><IMG query="team photo" /></SECTION>',
        },
      ],
    },
  },
  {
    name: "Duplicate slides (same content twice)",
    expect: "duplication called out in feedback, design dinged",
    input: {
      user_id: "bash",
      document_id: "dupes",
      slides: [
        {
          slide_number: 1,
          content:
            "Building a Resilient Decision-Making Process\n• Emphasize flexibility and adaptability\n• Foster continuous learning",
        },
        {
          slide_number: 2,
          content:
            "Building a Resilient Decision-Making Process\n• Emphasize flexibility and adaptability\n• Foster continuous learning",
        },
        {
          slide_number: 3,
          content: "Summary\n• Structured thinking wins\n• Stay adaptable",
        },
      ],
    },
  },
  {
    name: "No source_context, facts-heavy deck",
    expect: "claims INSUFFICIENT_CONTEXT (not UNSUPPORTED spam), gate not failed on that alone",
    input: {
      user_id: "bash",
      document_id: "no-context",
      slides: [
        {
          slide_number: 1,
          content:
            "The Solar System\n• Jupiter is the largest planet\n• Light from the Sun reaches Earth in about 8 minutes",
        },
        {
          slide_number: 2,
          content:
            "Mars Facts\n• Mars has two moons: Phobos and Deimos\n• A Mars day is about 24.6 hours",
        },
      ],
    },
  },
];

async function main() {
  const { reviewSlides } = await import("@/backend/ai/reviewSlides");
  const failures: string[] = [];

  for (const testCase of cases) {
    console.log(`\n=== ${testCase.name} ===`);
    console.log(`expect: ${testCase.expect}`);
    const started = Date.now();
    try {
      const result = await reviewSlides(testCase.input);
      const compact = {
        score: result.score,
        needs_revision: result.needs_revision,
        claim_statuses: result.claim_audit.map(
          (c) => `s${c.slide_number}:${c.status}`,
        ),
        clarifying_questions: result.clarifying_questions,
        feedback: result.feedback,
      };
      console.log(JSON.stringify(compact, null, 2));
      console.log(`(took ${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (error) {
      console.error("CASE THREW:", error);
      failures.push(testCase.name);
    }
  }

  console.log(
    `\n${"=".repeat(60)}\nHard failures: ${failures.length ? failures.join("; ") : "none"}`,
  );
  if (failures.length) process.exitCode = 1;
}

void main();

import {
  ArrowRight,
  ClipboardCheck,
  Palette,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/backend/auth";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: WandSparkles,
    title: "AI generation",
    description:
      "Describe a topic — or drop in a PDF — and get a fully designed, themed deck in about two minutes.",
  },
  {
    icon: ClipboardCheck,
    title: "AI deck review",
    description:
      "An AI auditor scores clarity, design, and accuracy, and fact-checks every claim against your source material.",
  },
  {
    icon: ShieldCheck,
    title: "One-click Auto-fix",
    description:
      "Failing review? One click rewrites the flagged slides — unsupported claims removed, never invented. Undo included.",
  },
  {
    icon: Palette,
    title: "Themes & export",
    description:
      "Switch visual themes, generate images, present full-screen, or export your finished deck.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Describe",
    description: "Type your topic and pick slide count, language, and style.",
  },
  {
    step: "2",
    title: "Generate",
    description: "AI drafts the outline, writes the slides, and designs them.",
  },
  {
    step: "3",
    title: "Review & fix",
    description:
      "Run the AI review, auto-fix weak slides, and present with confidence.",
  },
];

export default async function Home() {
  const session = await auth();
  if (session) redirect("/presentation");

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient brand glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 h-[34rem] w-[54rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[38rem] -left-40 h-[24rem] w-[24rem] rounded-full bg-cyan-500/10 blur-[110px]"
      />

      {/* Top nav */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="brand-gradient-text text-lg font-bold tracking-tight">
          Presentation AI
        </span>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href="/auth/signin">Sign in</Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-16 pb-20 text-center sm:pt-24">
        <span className="mb-6 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          Local-first · Free to run · Powered by open models
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          Presentations that write —{" "}
          <span className="brand-gradient-text">and review — themselves</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Generate a full deck from a single prompt, then let an AI auditor
          score it, fact-check its claims, and rewrite the weak slides — all
          before you ever present it.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="brand-gradient rounded-full border-0 px-7 text-white shadow-lg shadow-primary/30 hover:brightness-110"
          >
            <Link href="/auth/signin">
              Get started free
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full px-7"
          >
            <Link href="#features">See what it does</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-8 px-6 pb-20"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border/60 bg-card/60 p-6 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="brand-gradient mb-4 flex size-10 items-center justify-center rounded-xl shadow-md shadow-primary/25">
                <feature.icon className="size-5 text-white" />
              </div>
              <h3 className="mb-2 font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-24">
        <h2 className="mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          How it <span className="brand-gradient-text">works</span>
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((item) => (
            <div key={item.step} className="flex flex-col items-center text-center">
              <div className="mb-3 flex size-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-sm font-bold text-primary">
                {item.step}
              </div>
              <h3 className="mb-1.5 font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 flex justify-center">
          <Button
            asChild
            size="lg"
            className="brand-gradient rounded-full border-0 px-7 text-white shadow-lg shadow-primary/30 hover:brightness-110"
          >
            <Link href="/auth/signin">
              Create your first deck
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground">
          <span className="brand-gradient-text font-semibold">
            Presentation AI
          </span>
          <span>Local-first AI presentations · Built with Next.js & Ollama</span>
        </div>
      </footer>
    </div>
  );
}

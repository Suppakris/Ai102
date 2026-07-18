"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProviders, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FaDiscord, FaGithub, FaGoogle } from "react-icons/fa";
import { type IconType } from "react-icons";

const PROVIDER_ICONS: Record<string, IconType> = {
  github: FaGithub,
  google: FaGoogle,
  discord: FaDiscord,
};

export default function SignIn() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const error = searchParams.get("error");
  const [providers, setProviders] = useState<Awaited<
    ReturnType<typeof getProviders>
  > | null>(null);

  useEffect(() => {
    void getProviders().then(setProviders);
  }, []);

  const handleSignIn = async (provider: string) => {
    await signIn(provider, { callbackUrl });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Ambient brand glows behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[46rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -right-24 h-[26rem] w-[26rem] rounded-full bg-cyan-500/15 blur-[110px]"
      />

      <Card className="glass-panel relative w-full max-w-md rounded-2xl border-border/60 shadow-xl shadow-primary/10">
        <CardHeader className="space-y-2 text-center">
          <p className="brand-gradient-text text-sm font-semibold tracking-widest uppercase">
            Presentation AI
          </p>
          <CardTitle className="text-3xl font-bold tracking-tight">
            Welcome back
          </CardTitle>
          <CardDescription>
            Sign in to create and review AI-powered presentations
          </CardDescription>
          {error && (
            <div
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              Authentication error. Please try again.
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
          {Object.values(providers ?? {}).map((provider) => {
            const Icon = PROVIDER_ICONS[provider.id];
            return (
              <Button
                key={provider.id}
                variant="outline"
                size="lg"
                className="flex items-center justify-center gap-2.5 rounded-xl bg-background/60 transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/10"
                onClick={() => handleSignIn(provider.id)}
              >
                {Icon && <Icon className="h-4 w-4" />}
                Sign in with {provider.name}
              </Button>
            );
          })}
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center gap-2">
          <p className="text-center text-xs text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

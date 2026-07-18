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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
          {error && (
            <div
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
              role="alert"
            >
              <span className="block sm:inline">
                Authentication error. Please try again.
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          {Object.values(providers ?? {}).map((provider) => {
            const Icon = PROVIDER_ICONS[provider.id];
            return (
              <Button
                key={provider.id}
                variant="outline"
                className="flex items-center justify-center gap-2"
                onClick={() => handleSignIn(provider.id)}
              >
                {Icon && <Icon className="h-4 w-4" />}
                Sign in with {provider.name}
              </Button>
            );
          })}
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

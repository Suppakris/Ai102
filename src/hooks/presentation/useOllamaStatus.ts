"use client";

import { useQuery } from "@tanstack/react-query";

const OLLAMA_STATUS_API_URL = "/api/presentation/ollama-status";
const STATUS_POLL_INTERVAL_MS = 30_000;

interface OllamaStatusApiResponse {
  online: boolean;
  checkedAt: string;
  error?: string;
}

async function fetchOllamaStatus(): Promise<OllamaStatusApiResponse> {
  const response = await fetch(OLLAMA_STATUS_API_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Ollama status API responded with ${response.status}`);
  }

  return (await response.json()) as OllamaStatusApiResponse;
}

export function useOllamaStatus() {
  const query = useQuery({
    queryKey: ["ollama-status"],
    queryFn: fetchOllamaStatus,
    staleTime: 0,
    retry: 0,
    refetchInterval: STATUS_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  return {
    online: query.data?.online ?? null,
    checkedAt: query.data?.checkedAt ?? null,
    error: query.data?.error,
    isChecking: query.isFetching,
    refetch: query.refetch,
  };
}

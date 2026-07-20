"use client";

import { useQuery } from "@tanstack/react-query";

const SYSTEM_STATUS_API_URL = "/api/presentation/system-status";
const STATUS_POLL_INTERVAL_MS = 30_000;

interface ServiceStatus {
  online: boolean;
  error?: string;
}

interface IntegrationConfigStatus {
  pollinationsImages: boolean;
  falImages: boolean;
  openrouterText: boolean;
  togetherAiImages: boolean;
  tavilySearch: boolean;
  unsplashImages: boolean;
  googleImageSearch: boolean;
}

interface SystemStatusApiResponse {
  checkedAt: string;
  ollama: ServiceStatus;
  database: ServiceStatus;
  integrations: IntegrationConfigStatus;
}

async function fetchSystemStatus(): Promise<SystemStatusApiResponse> {
  const response = await fetch(SYSTEM_STATUS_API_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`System status API responded with ${response.status}`);
  }

  return (await response.json()) as SystemStatusApiResponse;
}

export function useSystemStatus() {
  const query = useQuery({
    queryKey: ["system-status"],
    queryFn: fetchSystemStatus,
    staleTime: 0,
    retry: 0,
    refetchInterval: STATUS_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  return {
    checkedAt: query.data?.checkedAt ?? null,
    ollama: query.data?.ollama ?? null,
    database: query.data?.database ?? null,
    integrations: query.data?.integrations ?? null,
    isChecking: query.isFetching,
    refetch: query.refetch,
  };
}

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";

export interface AccessInfo {
  authenticated: boolean;
  allowed: boolean;
  email: string | null;
  name?: string | null;
}

export function useAccess() {
  const { isSignedIn, isLoaded } = useAuth();

  return useQuery<AccessInfo>({
    queryKey: ["access", isSignedIn],
    enabled: isLoaded && !!isSignedIn,
    queryFn: async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    },
    staleTime: 10_000,
    retry: 1,
    // Auto-poll while the user is on a "not allowed yet" state so the page
    // unlocks as soon as the Hotmart webhook arrives — without manual refresh.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.authenticated && !data?.allowed) return 8_000;
      return false;
    },
    refetchOnWindowFocus: true,
  });
}

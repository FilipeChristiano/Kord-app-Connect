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
    staleTime: 60_000,
    retry: 1,
  });
}

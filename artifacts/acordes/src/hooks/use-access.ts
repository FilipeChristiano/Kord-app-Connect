import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";

export interface AccessInfo {
  authenticated: boolean;
  allowed: boolean;
  accessSource?: "stripe" | "hotmart" | "manual" | null;
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
    // Auto-poll enquanto o usuário está em "ainda não liberado" (libera assim
    // que o webhook chega, sem precisar recarregar) OU quando a última
    // tentativa falhou (ex.: backend reiniciando durante um deploy) — sem
    // isso, uma falha passageira deixava a aba travada em erro para sempre,
    // só saindo desse estado com um reload manual.
    refetchInterval: (query) => {
      if (query.state.status === "error") return 5_000;
      const data = query.state.data;
      if (data?.authenticated && !data?.allowed) return 8_000;
      return false;
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

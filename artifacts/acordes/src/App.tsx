import { useEffect, useRef } from "react";
import {
  Switch,
  Route,
  Router as WouterRouter,
  Redirect,
  useLocation,
} from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  ClerkProvider,
  Show,
  useClerk,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { useAccess } from "@/hooks/use-access";
import { clerkAppearance, clerkLocalization } from "@/lib/clerk-appearance";

import Home from "@/pages/home";
import Dictionary from "@/pages/dictionary";
import ChordDetail from "@/pages/chord-detail";
import StudyMode from "@/pages/study";
import Favorites from "@/pages/favorites";
import Applications from "@/pages/applications";
import ChordSubstitutor from "@/pages/chord-substitutor";
import Metronome from "@/pages/metronome";
import PadContinuous from "@/pages/pad-continuous";
import NotFound from "@/pages/not-found";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import NoAccessPage from "@/pages/no-access";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment");
}

function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-white/60">
        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-primary animate-spin" />
        {message && <p className="text-sm">{message}</p>}
      </div>
    </div>
  );
}

function ProtectedAppRoutes() {
  const { data, isLoading, isError } = useAccess();

  if (isLoading) {
    return <LoadingScreen message="Verificando seu acesso..." />;
  }

  if (isError) {
    return <LoadingScreen message="Não foi possível verificar o acesso. Tente recarregar." />;
  }

  if (!data?.allowed) {
    return <NoAccessPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dicionario" component={Dictionary} />
        <Route path="/acorde/:id" component={ChordDetail} />
        <Route path="/aplicacoes" component={Applications} />
        <Route path="/sofisticador" component={ChordSubstitutor} />
        <Route path="/metronomo" component={Metronome} />
        <Route path="/pad" component={PadContinuous} />
        <Route path="/estudo" component={StudyMode} />
        <Route path="/favoritos" component={Favorites} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route>
        <Show when="signed-in">
          <ProtectedAppRoutes />
        </Show>
        <Show when="signed-out">
          <Redirect to="/sign-up" />
        </Show>
      </Route>
    </Switch>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={clerkLocalization}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;

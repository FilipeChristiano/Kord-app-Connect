import { lazy, Suspense, useEffect, useRef } from "react";
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
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/toaster";
import { isIosApp } from "@/lib/native-app";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { KeepAlive } from "@/components/KeepAlive";
import { useAccess } from "@/hooks/use-access";
import { clerkAppearance, clerkLocalization } from "@/lib/clerk-appearance";
import { getAudio } from "@/lib/piano";

// Páginas carregadas sob demanda (code-splitting): o app abre com um bundle
// inicial pequeno e cada tela baixa seu código só quando visitada.
const Home = lazy(() => import("@/pages/home"));
const Dictionary = lazy(() => import("@/pages/dictionary"));
const ChordDetail = lazy(() => import("@/pages/chord-detail"));
const StudyMode = lazy(() => import("@/pages/study"));
const Favorites = lazy(() => import("@/pages/favorites"));
const Applications = lazy(() => import("@/pages/applications"));
const ChordSubstitutor = lazy(() => import("@/pages/chord-substitutor"));
const AudioLab = lazy(() => import("@/pages/audio-lab"));
const Metronome = lazy(() => import("@/pages/metronome"));
const PadContinuous = lazy(() => import("@/pages/pad-continuous"));
const NotFound = lazy(() => import("@/pages/not-found"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const SignUpPage = lazy(() => import("@/pages/sign-up"));
const LandingPage = lazy(() => import("@/pages/landing"));
const NoAccessPage = lazy(() => import("@/pages/no-access"));
const PrivacidadePage = lazy(() => import("@/pages/privacidade"));
const InstaArtPage = lazy(() => import("@/pages/insta-art"));

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Preview de desenvolvimento: permite ver o app dentro do quadro de prévia
// embutido, onde os cookies de login (Clerk) são bloqueados por serem de
// "terceiros". NUNCA fica ativo em produção, pois import.meta.env.DEV é false
// no app publicado (build de produção).
const PREVIEW_MODE = import.meta.env.DEV;

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
      <div className="flex flex-col items-center gap-4 text-foreground/60">
        <div className="w-10 h-10 rounded-full border-2 border-foreground/20 border-t-primary animate-spin" />
        {message && <p className="text-sm">{message}</p>}
      </div>
    </div>
  );
}

// Rota vazia: usada para os módulos "keep-alive" (renderizados fora do Switch).
// Evita que o Switch caia no NotFound quando o caminho é de um desses módulos.
const EmptyRoute = () => null;

function ProtectedAppRoutes() {
  const { data, isLoading, isError } = useAccess();
  const [location] = useLocation();

  if (!PREVIEW_MODE) {
    if (isLoading) {
      return <LoadingScreen message="Verificando seu acesso..." />;
    }

    if (isError) {
      return <LoadingScreen message="Não foi possível verificar o acesso. Tente recarregar." />;
    }

    if (!data?.allowed) {
      return <NoAccessPage />;
    }
  }

  // Módulos interativos ficam montados depois da primeira visita (apenas
  // escondidos quando inativos), para preservar o estado ao trocar de tela
  // durante o uso do app. As demais páginas (estáticas ou baseadas em dados
  // já cacheados) continuam no Switch normal.
  return (
    <Layout>
      <Suspense fallback={<LoadingScreen />}>
      <KeepAlive active={location === "/sofisticador"}>
        <ChordSubstitutor />
      </KeepAlive>
      <KeepAlive active={location === "/audio-lab"}>
        <AudioLab />
      </KeepAlive>
      <KeepAlive active={location === "/metronomo"}>
        <Metronome />
      </KeepAlive>
      <KeepAlive active={location === "/pad"}>
        <PadContinuous />
      </KeepAlive>
      <KeepAlive active={location === "/estudo"}>
        <StudyMode />
      </KeepAlive>

      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dicionario" component={Dictionary} />
        <Route path="/acorde/:id" component={ChordDetail} />
        <Route path="/aplicacoes" component={Applications} />
        <Route path="/favoritos" component={Favorites} />
        {/* Módulos keep-alive: renderizados acima; aqui apenas evitam o NotFound. */}
        <Route path="/sofisticador" component={EmptyRoute} />
        <Route path="/audio-lab" component={EmptyRoute} />
        <Route path="/metronomo" component={EmptyRoute} />
        <Route path="/pad" component={EmptyRoute} />
        <Route path="/estudo" component={EmptyRoute} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      {/* No app iOS o cadastro fica indisponível (fluxo somente-login, regra 3.1.1) */}
      <Route path="/sign-up/*?">
        {isIosApp() ? <Redirect to="/sign-in" /> : <SignUpPage />}
      </Route>
      {/* Páginas públicas, acessíveis sem login */}
      <Route path="/privacidade" component={PrivacidadePage} />
      {/* TEMPORÁRIO: páginas de exportação das artes de Instagram */}
      <Route path="/arte/:n" component={InstaArtPage} />
      <Route path="/assinar" component={LandingPage} />
      <Route>
        {PREVIEW_MODE ? (
          <ProtectedAppRoutes />
        ) : (
          <>
            <Show when="signed-in">
              <ProtectedAppRoutes />
            </Show>
            <Show when="signed-out">
              {/* No app iOS (App Store) o fluxo é somente-login: deslogado
                  cai na tela de entrar, não na página de venda (a regra
                  3.1.1 da Apple proíbe preço/compra dentro do app). Nos
                  demais casos, deslogado vê a página pública de venda. */}
              {isIosApp() ? <Redirect to="/sign-in" /> : <LandingPage />}
            </Show>
          </>
        )}
      </Route>
    </Switch>
    </Suspense>
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

function PreviewBadge() {
  const [location] = useLocation();
  if (location.startsWith("/arte/")) return null;
  return (
    <div className="fixed bottom-3 left-3 z-[60] pointer-events-none select-none rounded-full bg-primary/15 border border-primary/30 text-primary text-[10px] font-semibold px-2.5 py-1 backdrop-blur-sm">
      Prévia (dev) — sem login
    </div>
  );
}

function App() {
  // Registra os liberadores de áudio já na abertura: no primeiro toque do
  // usuário o contexto destrava e os samples de piano são pré-carregados,
  // para o primeiro "ouvir acorde" tocar sem espera.
  useEffect(() => {
    getAudio();
  }, []);

  // storageKey v2: força o novo padrão claro mesmo para quem já tinha
  // "dark" salvo do padrão antigo; a escolha manual segue sendo lembrada
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="kordi-theme-v2">
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
        {PREVIEW_MODE && <PreviewBadge />}
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Contexto que informa a cada módulo se ele está ativo (visível) no momento.
// Padrão "true" para que páginas usadas fora do KeepAlive funcionem normalmente.
const ActiveContext = createContext(true);

// Hook para um módulo saber se está ativo. Útil para pausar áudio quando o
// usuário troca de tela mas o módulo continua montado (estado preservado).
export function useIsActive(): boolean {
  return useContext(ActiveContext);
}

// Mantém um módulo montado depois da primeira visita, apenas escondendo-o quando
// não está ativo. Assim o estado (cifra, mixagem, configurações, etc.) continua
// "lá" ao voltar. A montagem é preguiçosa: o módulo só é criado na primeira vez
// que fica ativo, evitando carregar tudo logo na abertura do app.
export function KeepAlive({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasBeenActive, setHasBeenActive] = useState(active);

  useEffect(() => {
    if (active) setHasBeenActive(true);
  }, [active]);

  // Ao ficar inativo, pausa qualquer mídia em reprodução dentro do módulo para
  // não deixar áudio tocando em segundo plano (player de faixas, vídeo do
  // YouTube embutido, etc.). O estado em si é preservado.
  useEffect(() => {
    if (active) return;
    const el = containerRef.current;
    if (!el) return;
    el.querySelectorAll("audio, video").forEach((m) => {
      try {
        (m as HTMLMediaElement).pause();
      } catch {
        // ignora
      }
    });
    el.querySelectorAll("iframe").forEach((f) => {
      try {
        f.contentWindow?.postMessage(
          '{"event":"command","func":"pauseVideo","args":""}',
          "*",
        );
      } catch {
        // ignora
      }
    });
  }, [active]);

  return (
    <div ref={containerRef} style={{ display: active ? undefined : "none" }}>
      {hasBeenActive ? (
        <ActiveContext.Provider value={active}>{children}</ActiveContext.Provider>
      ) : null}
    </div>
  );
}

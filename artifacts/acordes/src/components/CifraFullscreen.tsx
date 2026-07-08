import { useEffect, useRef, useState, ReactNode } from "react";
import { motion } from "framer-motion";
import { X, Minus, Plus } from "lucide-react";

const FONT_KEY = "kordi_cifra_fullscreen_font_v1";
const FONT_MIN = 12;
const FONT_MAX = 26;
const FONT_DEFAULT = 15;

function loadFontSize(): number {
  try {
    const v = Number(localStorage.getItem(FONT_KEY));
    if (Number.isFinite(v) && v >= FONT_MIN && v <= FONT_MAX) return v;
  } catch {
    // localStorage indisponível — usa padrão
  }
  return FONT_DEFAULT;
}

/**
 * Overlay de leitura de cifra em tela cheia, reutilizável em qualquer página.
 *
 * - Tenta a Fullscreen API quando disponível; em navegadores sem suporte
 *   (ex.: iOS Safari) funciona como overlay fixo cobrindo a viewport (100dvh).
 * - Fecha por X, tecla Esc e botão voltar do Android (history state próprio),
 *   sem tirar o usuário da página atual.
 * - Controle de tamanho da letra (A− / A+) persistido em localStorage.
 *
 * O conteúdo (children) é a cifra já renderizada pela página chamadora —
 * este componente não duplica a lógica de renderização.
 */
export function CifraFullscreen({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [fontSize, setFontSize] = useState(loadFontSize);

  const changeFont = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(FONT_MAX, Math.max(FONT_MIN, prev + delta));
      try {
        localStorage.setItem(FONT_KEY, String(next));
      } catch {
        // ignora
      }
      return next;
    });
  };

  // Fecha o overlay uma única vez, desfazendo o history state se ele for nosso.
  const requestClose = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (window.history.state?.kordiCifraFullscreen) {
      // Dispara popstate → onClose (mantém a pilha de navegação limpa).
      window.history.back();
    } else {
      onCloseRef.current();
    }
  };

  // History state próprio: o botão voltar (Android/navegador) fecha o overlay
  // em vez de sair da página.
  useEffect(() => {
    window.history.pushState({ kordiCifraFullscreen: true }, "");
    const onPop = () => {
      closedRef.current = true;
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      // Desmontagem sem fechamento explícito (ex.: página trocou o estado por
      // fora): se o nosso history state ainda é o atual, remove para não
      // deixar uma entrada fantasma na pilha de navegação.
      if (!closedRef.current && window.history.state?.kordiCifraFullscreen) {
        closedRef.current = true;
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fullscreen API quando suportada (desktop/Android). iOS Safari cai no
  // fallback de overlay fixo sem erro.
  useEffect(() => {
    const el = rootRef.current;
    el?.requestFullscreen?.().catch(() => {
      // sem suporte ou bloqueado — overlay fixo já cobre a tela
    });
    const onFsChange = () => {
      // Usuário saiu do fullscreen nativo (ex.: Esc do navegador) → fecha.
      if (!document.fullscreenElement) requestClose();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Cifra em tela cheia: ${title}` : "Cifra em tela cheia"}
      className="fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-[#0b0e17] overscroll-contain"
    >
      {/* Barra superior */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 border-b border-white/10 bg-[#0b0e17] shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-[#9673FF] uppercase tracking-widest leading-none mb-0.5">
            Tela cheia
          </p>
          {title && (
            <h2 className="font-display font-bold text-white text-sm sm:text-base leading-tight truncate">
              {title}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => changeFont(-1)}
            disabled={fontSize <= FONT_MIN}
            aria-label="Diminuir tamanho da letra"
            className="flex items-center gap-0.5 min-h-[44px] px-3 rounded-lg border border-white/15 text-white/70 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus className="w-3.5 h-3.5" aria-hidden />
            <span className="text-xs font-bold" aria-hidden>A</span>
          </button>
          <button
            onClick={() => changeFont(1)}
            disabled={fontSize >= FONT_MAX}
            aria-label="Aumentar tamanho da letra"
            className="flex items-center gap-0.5 min-h-[44px] px-3 rounded-lg border border-white/15 text-white/70 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden />
            <span className="text-sm font-bold" aria-hidden>A</span>
          </button>
          <button
            onClick={requestClose}
            aria-label="Sair da tela cheia"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg bg-gradient-to-br from-[#C24BF7] to-[#4B45E8] text-white shadow-lg shadow-violet-500/25 hover:brightness-110 transition-all"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Folha da cifra */}
      <div className="flex-1 overflow-auto bg-[#fdfcf9]">
        <div
          translate="no"
          className="notranslate w-max min-w-full px-5 py-6 sm:px-8 sm:py-8 font-mono text-zinc-800"
          style={{ fontSize: `${fontSize}px` }}
        >
          {children}
        </div>
      </div>
    </motion.div>
  );
}

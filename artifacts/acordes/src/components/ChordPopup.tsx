import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { getChordById, CHORDS } from "@/data/chords";
import {
  getChordVariationImages,
  getChordOverviewImage,
  CHORD_SVG_OVERRIDES,
} from "@/data/chord-images";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { splitHands } from "@/lib/notes";
import { playChordVoicing } from "@/lib/piano";
import { cn } from "@/lib/utils";

/**
 * Popup minimalista com a formação de um acorde, espelhando EXATAMENTE o
 * módulo Dicionário de Acordes: tríades usam o diagrama SVG; os demais
 * acordes usam as mesmas imagens de variações/posição do dicionário.
 * Funciona também por cima da cifra em tela cheia (deve ser renderizado
 * DENTRO do elemento em fullscreen nativo).
 */
// Grafia enarmônica: mesma tecla, outro nome (Db = C#). Usada para mostrar as
// notas com sustenidos quando o acorde clicado na cifra foi escrito com "#".
const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
};

// Busca um acorde pelo ID ou pelo nome (para exibir acordes relacionados)
function findRelatedChord(variation: string) {
  return CHORDS.find((c) => c.id === variation || c.name === variation);
}

export function ChordPopup({
  chordId,
  onClose,
  label,
}: {
  chordId: string;
  onClose: () => void;
  /** Nome do acorde como está escrito na cifra (ex: "C#7M(9)"). Quando
   *  informado, é exibido no lugar do nome do dicionário (ex: "Db7M(9)"),
   *  pois o dicionário guarda apenas uma grafia enarmônica de cada acorde. */
  label?: string;
}) {
  const chord = getChordById(chordId);
  const [active, setActive] = useState(0);

  // Volta para a 1ª variação quando o popup passa a mostrar outro acorde.
  useEffect(() => {
    setActive(0);
  }, [chordId]);

  // Esc fecha só o popup (capture + stopPropagation para não fechar
  // também a tela cheia, que escuta Esc em bubble no window).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  if (!chord) return null;

  // ── Mesma lógica de exibição do Dicionário de Acordes ──────────────────────
  const isSvgChord = CHORD_SVG_OVERRIDES.has(chord.id);
  const variationImages = isSvgChord ? null : getChordVariationImages(chord.id);
  const overviewImage =
    !isSvgChord && !variationImages ? getChordOverviewImage(chord.id) : null;

  const { leftHand, rightHand } = splitHands(chord.notes, chord.category);
  const isFechado = chord.category === "Mão Esquerda — Fechado";
  const baseOctave = isFechado ? 1 : 0;

  const tocar = () => {
    playChordVoicing(leftHand, rightHand, { leftBaseOctave: baseOctave });
  };

  // Nome exibido: o que está escrito na cifra, quando fornecido.
  const displayName = label ?? chord.name;
  // Se a cifra usa sustenido (C#…), mostramos as notas também em sustenidos.
  const useSharps = /^[A-G]#/.test(displayName);
  const displayNotes = useSharps
    ? chord.notes.map((n) => FLAT_TO_SHARP[n] ?? n)
    : chord.notes;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Formação do acorde ${displayName}`}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm font-sans whitespace-normal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 12 }}
        className="bg-modal border border-foreground/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
          <div className="flex items-baseline gap-3 min-w-0">
            <h2 className="font-display font-bold text-foreground text-2xl leading-none">
              {displayName}
            </h2>
            <span className="text-xs font-mono text-[#9673FF] bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-2.5 py-0.5 whitespace-nowrap">
              {chord.formula}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={tocar}
              aria-label="Ouvir acorde"
              title="Ouvir acorde"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-[#C24BF7] to-[#4B45E8] text-white shadow-lg shadow-violet-500/25 hover:brightness-110 transition-all"
            >
              <Play className="w-4 h-4 fill-current" aria-hidden />
            </button>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-foreground/10 text-foreground/40 hover:bg-foreground/5 hover:text-foreground transition-all"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* ── Variações do dicionário (imagens reais) ── */}
        {variationImages && (
          <>
            <div className="px-5 pb-3">
              <div className="flex items-center justify-between bg-black/30 rounded-xl px-3 py-2 border border-foreground/5">
                <button
                  onClick={() =>
                    setActive((a) => (a - 1 + variationImages.length) % variationImages.length)
                  }
                  className="p-1 text-foreground/40 hover:text-foreground transition-colors"
                  aria-label="Variação anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  Variação {Math.min(active, variationImages.length - 1) + 1}
                  <span className="text-foreground/40 font-normal"> / {variationImages.length}</span>
                </p>
                <button
                  onClick={() => setActive((a) => (a + 1) % variationImages.length)}
                  className="p-1 text-foreground/40 hover:text-foreground transition-colors"
                  aria-label="Próxima variação"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="px-5">
              <div className="bg-black/30 rounded-xl p-2 border border-foreground/5 flex justify-center">
                <img
                  key={active}
                  src={variationImages[Math.min(active, variationImages.length - 1)]}
                  alt={`Variação ${Math.min(active, variationImages.length - 1) + 1} do acorde ${displayName}`}
                  className="max-w-full rounded-lg object-contain"
                  style={{ maxHeight: 240 }}
                />
              </div>
            </div>
            <div className="flex justify-center gap-1.5 pt-3">
              {variationImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    i === Math.min(active, variationImages.length - 1)
                      ? "bg-[#8B5CF6] w-4"
                      : "bg-foreground/20 w-1.5 hover:bg-foreground/40",
                  )}
                  aria-label={`Variação ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Posição única do dicionário (imagem real) ── */}
        {overviewImage && (
          <div className="px-5">
            <div className="bg-black/30 rounded-xl p-2 border border-foreground/5 flex justify-center">
              <img
                src={overviewImage}
                alt={`Posição no teclado do acorde ${displayName}`}
                className="max-w-full rounded-lg object-contain"
                style={{ maxHeight: 240 }}
              />
            </div>
          </div>
        )}

        {/* ── Diagrama SVG (tríades, igual ao dicionário) ── */}
        {!variationImages && !overviewImage && (
          <div className="px-5">
            <PianoKeyboard
              leftHandNotes={leftHand}
              rightHandNotes={rightHand}
              leftHandBaseOctave={baseOctave}
              className="w-full"
            />
          </div>
        )}

        {/* Notas */}
        <div className="px-5 pt-4">
          <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest mb-2">
            Notas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {displayNotes.map((nota, i) => (
              <span
                key={i}
                className="font-mono text-sm font-bold text-foreground bg-foreground/[0.06] border border-foreground/10 rounded-lg px-3 py-1"
              >
                {nota}
              </span>
            ))}
          </div>
        </div>

        {/* Acordes relacionados */}
        {chord.variations && chord.variations.length > 0 && (
          <div className="px-5 pt-4 pb-5">
            <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest mb-2">
              Acordes relacionados
            </p>
            <div className="flex flex-wrap gap-1.5">
              {chord.variations.map((v, i) => (
                <span
                  key={i}
                  className="font-mono text-xs text-[#9673FF] bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 rounded-lg px-2.5 py-1"
                >
                  {findRelatedChord(v)?.name ?? v}
                </span>
              ))}
            </div>
          </div>
        )}
        {(!chord.variations || chord.variations.length === 0) && <div className="pb-5" />}
      </motion.div>
    </motion.div>
  );
}

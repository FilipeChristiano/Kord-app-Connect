import { useEffect } from "react";
import { motion } from "framer-motion";
import { X, Play } from "lucide-react";
import { getChordById } from "@/data/chords";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { splitHands } from "@/lib/notes";
import { playChordVoicing } from "@/lib/piano";

/**
 * Popup minimalista com a formação de um acorde: nome, fórmula, notas no
 * piano e variações. Funciona também por cima da cifra em tela cheia
 * (deve ser renderizado DENTRO do elemento em fullscreen nativo).
 */
export function ChordPopup({
  chordId,
  onClose,
}: {
  chordId: string;
  onClose: () => void;
}) {
  const chord = getChordById(chordId);

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

  const { leftHand, rightHand } = splitHands(chord.notes, chord.category);
  const isFechado = chord.category === "Mão Esquerda — Fechado";

  const tocar = () => {
    playChordVoicing(leftHand, rightHand, { leftBaseOctave: isFechado ? 1 : 0 });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Formação do acorde ${chord.name}`}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm font-sans whitespace-normal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 12 }}
        className="bg-[#12121f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
          <div className="flex items-baseline gap-3 min-w-0">
            <h2 className="font-display font-bold text-white text-2xl leading-none">
              {chord.name}
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
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-white/10 text-white/40 hover:bg-white/5 hover:text-white transition-all"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Piano com as notas */}
        <div className="px-5">
          <PianoKeyboard
            leftHandNotes={leftHand}
            rightHandNotes={rightHand}
            leftHandBaseOctave={isFechado ? 1 : 0}
            className="w-full"
          />
        </div>

        {/* Notas */}
        <div className="px-5 pt-4">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">
            Notas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {chord.notes.map((nota, i) => (
              <span
                key={i}
                className="font-mono text-sm font-bold text-white bg-white/[0.06] border border-white/10 rounded-lg px-3 py-1"
              >
                {nota}
              </span>
            ))}
          </div>
        </div>

        {/* Variações */}
        {chord.variations && chord.variations.length > 0 && (
          <div className="px-5 pt-4 pb-5">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">
              Variações
            </p>
            <div className="flex flex-wrap gap-1.5">
              {chord.variations.map((v, i) => (
                <span
                  key={i}
                  className="font-mono text-xs text-[#9673FF] bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 rounded-lg px-2.5 py-1"
                >
                  {v}
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

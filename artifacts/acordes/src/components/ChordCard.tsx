import { Link } from "wouter";
import { Heart, Play } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Chord } from "@/data/chords";
import { useFavorites } from "@/hooks/use-favorites";
import { splitHands } from "@/lib/notes";
import { playChordVoicing } from "@/lib/piano";
import { CategoryBadge } from "./CategoryBadge";

interface ChordCardProps {
  chord: Chord;
  index?: number;
}

export function ChordCard({ chord, index = 0 }: ChordCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(chord.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group relative h-full"
    >
      <Link href={`/acorde/${chord.id}`} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
        <div className="glass-card h-full rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.02] hover:border-primary/25 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <CategoryBadge category={chord.category} />
            <div className="flex items-center gap-1 -m-2">
              <button
                onClick={(e) => {
                  e.preventDefault(); // Prevent navigating
                  const { leftHand, rightHand } = splitHands(chord.notes, chord.category);
                  const isFechado = chord.category === "Mão Esquerda — Fechado";
                  playChordVoicing(leftHand, rightHand, { leftBaseOctave: isFechado ? 1 : 0 });
                }}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors active:scale-90"
                aria-label={`Ouvir o acorde ${chord.name}`}
              >
                <Play className="w-5 h-5 fill-current" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault(); // Prevent navigating
                  toggleFavorite(chord.id);
                }}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              >
                <Heart 
                  className={cn("w-5 h-5 transition-all duration-300", favorite ? "fill-primary text-primary scale-110" : "")} 
                />
              </button>
            </div>
          </div>
          
          <h3 className="font-display text-3xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors notranslate" translate="no">
            {chord.name}
          </h3>
          
          <div className="flex flex-wrap gap-1.5 mb-4">
            {chord.notes.map((note, i) => (
              <span key={i} className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground border border-white/5 flex items-center justify-center text-xs font-semibold notranslate" translate="no">
                {note}
              </span>
            ))}
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2 mt-auto">
            {chord.description}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

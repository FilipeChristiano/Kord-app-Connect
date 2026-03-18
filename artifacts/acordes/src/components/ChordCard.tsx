import { Link } from "wouter";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Chord } from "@/data/chords";
import { useFavorites } from "@/hooks/use-favorites";
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
        <div className="glass-card h-full rounded-2xl p-6 transition-all duration-300 hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <CategoryBadge category={chord.category} />
            <button
              onClick={(e) => {
                e.preventDefault(); // Prevent navigating
                toggleFavorite(chord.id);
              }}
              className="p-2 -m-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Heart 
                className={cn("w-5 h-5 transition-all duration-300", favorite ? "fill-primary text-primary scale-110" : "")} 
              />
            </button>
          </div>
          
          <h3 className="font-display text-3xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
            {chord.name}
          </h3>
          
          <div className="flex flex-wrap gap-1.5 mb-4">
            {chord.notes.map((note, i) => (
              <span key={i} className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground border border-white/5 flex items-center justify-center text-xs font-semibold">
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

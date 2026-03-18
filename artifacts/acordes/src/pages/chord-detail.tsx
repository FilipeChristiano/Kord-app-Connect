import { useParams, Link } from "wouter";
import { ArrowLeft, Heart, Tag, Info, Lightbulb, Music } from "lucide-react";
import { getChordById } from "@/data/chords";
import { CategoryBadge } from "@/components/CategoryBadge";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import NotFound from "./not-found";

export default function ChordDetail() {
  const params = useParams<{ id: string }>();
  const chord = params.id ? getChordById(params.id) : undefined;
  const { isFavorite, toggleFavorite } = useFavorites();

  if (!chord) return <NotFound />;

  const favorite = isFavorite(chord.id);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      <Link href="/dicionario" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar ao dicionário
      </Link>

      <div className="glass-card rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        
        {/* Header Header */}
        <div className="p-6 md:p-10 border-b border-white/5 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <CategoryBadge category={chord.category} className="mb-4" />
              <h1 className="font-display text-5xl md:text-7xl font-bold text-white tracking-tight">
                {chord.name}
              </h1>
            </div>
            
            <button
              onClick={() => toggleFavorite(chord.id)}
              className={cn(
                "flex items-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg",
                favorite 
                  ? "bg-primary text-primary-foreground shadow-primary/20 hover:bg-amber-400" 
                  : "bg-secondary text-white hover:bg-secondary/80 border border-white/10"
              )}
            >
              <Heart className={cn("w-5 h-5", favorite ? "fill-current" : "")} />
              {favorite ? "Salvo nos Favoritos" : "Favoritar Acorde"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-10 grid md:grid-cols-2 gap-10 lg:gap-16 relative z-10">
          
          {/* Left Col */}
          <div className="space-y-10">
            {/* Notes Visual */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Music className="w-4 h-4" /> Notas do Acorde
              </h3>
              <div className="flex flex-wrap gap-3">
                {chord.notes.map((note, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-14 h-16 bg-gradient-to-b from-white to-gray-200 text-black rounded-lg shadow-md flex items-end justify-center pb-2 font-bold text-xl border-b-4 border-gray-300">
                      {note}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Formula */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Info className="w-4 h-4" /> Fórmula
              </h3>
              <div className="bg-secondary/50 rounded-xl p-4 border border-white/5">
                <code className="text-xl font-mono text-primary font-bold">{chord.formula}</code>
              </div>
            </section>

            {/* Tags */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {chord.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-white/5 text-muted-foreground rounded-full text-sm border border-white/5">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* Right Col */}
          <div className="space-y-10">
            {/* Description */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Sonoridade
              </h3>
              <p className="text-lg text-white/90 leading-relaxed">
                {chord.description}
              </p>
            </section>

            {/* Application */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" /> Como Aplicar na Prática
              </h3>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                <p className="text-white/90 leading-relaxed relative z-10">
                  {chord.application}
                </p>
              </div>
            </section>

            {/* Variations */}
            {chord.variations && chord.variations.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Variações Sugeridas
                </h3>
                <div className="flex flex-wrap gap-3">
                  {chord.variations.map(variation => (
                    <span key={variation} className="px-4 py-2 bg-secondary text-white rounded-lg font-medium border border-white/5">
                      {variation}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

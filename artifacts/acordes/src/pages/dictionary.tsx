import { useState, useMemo } from "react";
import { Search, Music } from "lucide-react";
import { CHORDS, CATEGORIES, searchChords } from "@/data/chords";
import { ChordCard } from "@/components/ChordCard";
import { cn } from "@/lib/utils";

export default function Dictionary() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");

  const filteredChords = useMemo(() => {
    return searchChords(query, activeCategory);
  }, [query, activeCategory]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="mb-10 text-center lg:text-left">
        <h1 className="font-display text-4xl font-bold text-white mb-4">Dicionário de Acordes</h1>
        <p className="text-muted-foreground max-w-2xl lg:mx-0 mx-auto">Explore, busque e filtre acordes sofisticados. Encontre a harmonia perfeita para o seu arranjo.</p>
      </div>

      <div className="mb-8 space-y-6">
        {/* Search */}
        <div className="relative max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="text"
            className="w-full bg-secondary/50 border-2 border-white/5 rounded-xl pl-12 pr-4 py-4 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all text-lg"
            placeholder="Buscar por nome (ex: C, C7M, Cm7, sus4) ou categoria..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Categories (Horizontal Scroll on Mobile) */}
        <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 gap-2 hide-scrollbar">
          <button
            onClick={() => setActiveCategory("Todos")}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
              activeCategory === "Todos" 
                ? "bg-primary text-primary-foreground border-primary" 
                : "bg-secondary text-muted-foreground border-white/5 hover:border-white/20 hover:text-white"
            )}
          >
            Todos
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
                  : "bg-secondary text-muted-foreground border-white/5 hover:border-white/20 hover:text-white"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="mb-4 text-sm text-muted-foreground font-medium flex items-center justify-between">
        <span>Mostrando {filteredChords.length} {filteredChords.length === 1 ? 'acorde' : 'acordes'}</span>
      </div>

      {filteredChords.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredChords.map((chord, idx) => (
            <ChordCard key={chord.id} chord={chord} index={idx} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center glass-card rounded-2xl border-dashed">
          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Nenhum acorde encontrado</h3>
          <p className="text-muted-foreground">Tente buscar por outro nome ou limpe os filtros.</p>
          <button 
            onClick={() => { setQuery(""); setActiveCategory("Todos"); }}
            className="mt-6 text-primary hover:text-orange-400 font-medium hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}

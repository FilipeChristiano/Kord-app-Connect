import { Heart, Search } from "lucide-react";
import { Link } from "wouter";
import { CHORDS } from "@/data/chords";
import { ChordCard } from "@/components/ChordCard";
import { useFavorites } from "@/hooks/use-favorites";

export default function Favorites() {
  const { favorites, favoritesCount } = useFavorites();
  
  const favoriteChords = CHORDS.filter(chord => favorites.includes(chord.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Heart className="w-8 h-8 text-primary fill-primary" /> 
            Meus Favoritos
          </h1>
          <p className="text-muted-foreground">
            Sua coleção pessoal de acordes para estudo rápido.
          </p>
        </div>
        <div className="bg-secondary/50 border border-white/5 px-4 py-2 rounded-lg text-sm font-medium text-white inline-flex w-max">
          {favoritesCount} {favoritesCount === 1 ? 'acorde salvo' : 'acordes salvos'}
        </div>
      </div>

      {favoriteChords.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favoriteChords.map((chord, idx) => (
            <ChordCard key={chord.id} chord={chord} index={idx} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center glass-card rounded-2xl border-dashed max-w-2xl mx-auto mt-10">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6 text-muted-foreground">
            <Heart className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-display font-bold text-white mb-3">Nenhum acorde salvo</h3>
          <p className="text-muted-foreground mb-8 text-lg">
            Você ainda não adicionou nenhum acorde aos favoritos. Navegue pelo dicionário e clique no coração para salvar.
          </p>
          <Link 
            href="/dicionario"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-amber-400 transition-colors shadow-lg shadow-primary/20"
          >
            <Search className="w-5 h-5" /> Explorar Dicionário
          </Link>
        </div>
      )}
    </div>
  );
}

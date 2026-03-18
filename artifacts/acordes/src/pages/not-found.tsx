import { Link } from "wouter";
import { Music } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center glass-card p-12 rounded-3xl max-w-md w-full border-t border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
        <Music className="w-16 h-16 text-primary mx-auto mb-6 opacity-80" />
        <h1 className="font-display text-4xl font-bold text-white mb-4">404</h1>
        <p className="text-lg text-muted-foreground mb-8">Essa nota está fora do tom. A página que você procura não foi encontrada.</p>
        <Link 
          href="/" 
          className="inline-flex px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all border border-white/5"
        >
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
}

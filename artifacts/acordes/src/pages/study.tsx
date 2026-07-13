import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, RefreshCw, Layers } from "lucide-react";
import { CHORDS, CATEGORIES, Chord } from "@/data/chords";
import { CategoryBadge } from "@/components/CategoryBadge";

export default function StudyMode() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const studyChords = useMemo(() => {
    let filtered = CHORDS;
    if (selectedCategory !== "Todos") {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }
    // Shuffle the array for study mode (simple deterministic shuffle based on length so it doesn't infinite loop re-renders)
    return [...filtered].sort(() => Math.random() - 0.5);
  }, [selectedCategory]);

  const currentChord = studyChords[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % studyChords.length);
    }, 200);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + studyChords.length) % studyChords.length);
    }, 200);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  if (!studyChords.length) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 lg:py-12 flex flex-col min-h-[calc(100vh-140px)]">
      
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-3 flex items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-primary" /> Modo <span className="text-gradient-primary">Estudo</span>
        </h1>
        <p className="text-muted-foreground">Teste sua memória com flashcards interativos.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 bg-secondary/50 p-4 rounded-xl border border-foreground/5">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Layers className="w-5 h-5 text-muted-foreground hidden sm:block" />
          <select 
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="w-full sm:w-auto bg-background border border-foreground/10 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
          >
            <option value="Todos">Todas as Categorias</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        <div className="text-sm font-medium text-muted-foreground bg-black/30 px-4 py-2 rounded-lg">
          Card {currentIndex + 1} de {studyChords.length}
        </div>
      </div>

      {/* Flashcard Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative perspective-1000">
        <AnimatePresence mode="wait">
          {currentChord && (
            <motion.div
              key={currentChord.id}
              className="w-full max-w-xl aspect-[4/3] sm:aspect-[3/2] relative transform-style-3d cursor-pointer"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Front of card */}
              <div className="absolute inset-0 backface-hidden w-full h-full">
                <div className="relative w-full h-full glass-card rounded-3xl px-6 py-16 sm:px-10 sm:py-20 flex flex-col items-center justify-between text-center shadow-2xl border-2 border-foreground/5 hover:border-primary/30 transition-colors">
                  <div className="flex justify-center">
                    <CategoryBadge category={currentChord.category} />
                  </div>
                  <h2
                    className={`font-display font-bold text-foreground leading-tight whitespace-nowrap max-w-full notranslate ${
                      currentChord.name.length > 13
                        ? "text-3xl sm:text-5xl"
                        : currentChord.name.length > 9
                          ? "text-4xl sm:text-6xl"
                          : "text-5xl sm:text-7xl"
                    }`}
                    translate="no"
                  >
                    {currentChord.name}
                  </h2>
                  <p className="text-muted-foreground text-sm font-medium animate-pulse">
                    Clique para revelar detalhes
                  </p>
                </div>
              </div>

              {/* Back of card */}
              <div className="absolute inset-0 backface-hidden w-full h-full rotate-y-180">
                <div className="w-full h-full bg-primary/10 backdrop-blur-xl border-2 border-primary/40 rounded-3xl p-6 sm:p-10 flex flex-col justify-center shadow-2xl shadow-primary/20">
                  <h3 className="font-display text-4xl font-bold text-primary mb-6 text-center notranslate" translate="no">
                    {currentChord.name}
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs text-primary/70 uppercase tracking-widest font-bold mb-2">Notas</div>
                      <div className="flex flex-wrap gap-2">
                        {currentChord.notes.map((n, i) => (
                          <span key={i} className="bg-foreground/10 text-foreground font-bold px-4 py-2 rounded-lg border border-foreground/20 notranslate" translate="no">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-primary/70 uppercase tracking-widest font-bold mb-2">Fórmula</div>
                      <code className="text-lg text-foreground font-mono notranslate" translate="no">{currentChord.formula}</code>
                    </div>

                    <div>
                      <div className="text-xs text-primary/70 uppercase tracking-widest font-bold mb-2">Resumo</div>
                      <p className="text-foreground/80 text-sm leading-relaxed">{currentChord.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-center items-center gap-6 mt-12">
        <button 
          onClick={handlePrev}
          className="p-4 rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-all shadow-lg focus:ring-2 focus:ring-primary outline-none"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setIsFlipped(!isFlipped)}
          className="px-8 py-3 rounded-xl bg-foreground/10 hover:bg-foreground/20 text-foreground font-medium transition-all"
        >
          {isFlipped ? "Esconder" : "Revelar"}
        </button>
        <button 
          onClick={handleNext}
          className="p-4 rounded-full btn-kordi focus:ring-2 focus:ring-white outline-none"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>

    </div>
  );
}

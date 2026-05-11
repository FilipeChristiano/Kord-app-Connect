import { useState, useEffect, useCallback } from "react";

const CIFRAS_KEY = "cifras-sofisticadas-favoritas";

export interface CifraFavorita {
  id: string;
  titulo: string;
  textoOriginal: string;
  textoSofisticado: string;
  nivel: "suave" | "intermediario" | "avancado";
  salvoEm: number;
  mudancas: Array<{ original: string; substituted: string; category: string }>;
}

function loadCifras(): CifraFavorita[] {
  try {
    const stored = localStorage.getItem(CIFRAS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function useCifrasFavoritas() {
  const [cifras, setCifras] = useState<CifraFavorita[]>(loadCifras);

  useEffect(() => {
    try {
      localStorage.setItem(CIFRAS_KEY, JSON.stringify(cifras));
    } catch (error) {
      console.error("Erro ao salvar cifras", error);
    }
  }, [cifras]);

  useEffect(() => {
    const handle = (e: StorageEvent) => {
      if (e.key === CIFRAS_KEY) setCifras(loadCifras());
    };
    window.addEventListener("storage", handle);
    return () => window.removeEventListener("storage", handle);
  }, []);

  const salvarCifra = useCallback(
    (dados: Omit<CifraFavorita, "id" | "salvoEm">) => {
      const nova: CifraFavorita = {
        ...dados,
        id: Date.now().toString(),
        salvoEm: Date.now(),
      };
      setCifras((prev) => [nova, ...prev]);
      return nova.id;
    },
    []
  );

  const removerCifra = useCallback((id: string) => {
    setCifras((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const atualizarTitulo = useCallback((id: string, titulo: string) => {
    setCifras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, titulo } : c))
    );
  }, []);

  return {
    cifras,
    cifrasCount: cifras.length,
    salvarCifra,
    removerCifra,
    atualizarTitulo,
  };
}

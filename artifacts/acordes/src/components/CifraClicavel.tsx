import { useMemo } from "react";
import { tokenizeChordText } from "@/data/substitutions";

/**
 * Renderiza o texto de uma cifra salva (texto puro) com os acordes em roxo e
 * clicáveis — clicar abre o popup de formação do acorde (via onChordClick).
 * Preserva o alinhamento monoespaçado (whitespace-pre) das linhas.
 */
export function CifraClicavel({
  texto,
  onChordClick,
}: {
  texto: string;
  onChordClick: (chordId: string) => void;
}) {
  const linhas = useMemo(
    () => texto.split("\n").map((linha) => tokenizeChordText(linha)),
    [texto],
  );

  return (
    <>
      {linhas.map((tokens, i) => (
        <div key={i} className="whitespace-pre min-h-[1.5em]">
          {tokens.map((t, j) => {
            if (t.type === "chord") {
              return (
                <span
                  key={j}
                  onClick={() => t.chordId && onChordClick(t.chordId)}
                  title={t.chordId ? `Ver formação de ${t.value}` : t.value}
                  className={[
                    "font-bold text-[#7C3AED]",
                    t.chordId ? "cursor-pointer hover:text-[#6D28D9]" : "",
                  ].join(" ")}
                >
                  {t.value}
                </span>
              );
            }
            return <span key={j}>{t.value}</span>;
          })}
        </div>
      ))}
    </>
  );
}

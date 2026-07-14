/**
 * Páginas TEMPORÁRIAS de artes para Instagram (1080x1350).
 * Usadas apenas para exportar as imagens da Task de artes — remover depois.
 */

import { useParams } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden font-sans text-white"
      style={{ width: 1080, height: 1350, background: "#070A12" }}
    >
      {children}
    </div>
  );
}

// ─── Arte 5: Chamada geral ───────────────────────────────────────────────────

function Arte5() {
  const modules = [
    { label: "Cifras sofisticadas", desc: "como os grandes tecladistas tocam" },
    { label: "Dicionário vivo", desc: "cada acorde no piano, com som real" },
    { label: "Audio Lab", desc: "separe a voz do instrumental" },
    { label: "Metrônomo sincronizado", desc: "BPM direto do áudio" },
  ];

  return (
    <Frame>
      {/* Glows de fundo */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -260, right: -220, width: 720, height: 720, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(150,115,255,0.22) 0%, rgba(150,115,255,0) 65%)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: -300, left: -260, width: 800, height: 800, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(75,69,232,0.20) 0%, rgba(75,69,232,0) 65%)",
        }}
      />
      {/* Linhas de "pauta" sutis */}
      <div className="absolute inset-x-0 pointer-events-none" style={{ top: 0, bottom: 0, opacity: 0.05 }}>
        {[...Array(9)].map((_, i) => (
          <div key={i} className="absolute inset-x-0" style={{ top: 150 * (i + 1), height: 1, background: "#9673FF" }} />
        ))}
      </div>

      <div className="relative flex flex-col h-full" style={{ padding: "88px 92px 72px" }}>
        {/* Marca */}
        <div className="flex items-center gap-5">
          <img src={`${basePath}/logo.png`} alt="" style={{ height: 76 }} draggable={false} />
          <span className="font-display font-black tracking-tight" style={{ fontSize: 54 }}>
            Kordi
          </span>
        </div>

        {/* Headline */}
        <h1
          className="font-display font-black tracking-tight"
          style={{ fontSize: 73, lineHeight: 1.12, marginTop: 110, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}
        >
          O som que inspira.
          <br />
          <span className="text-gradient-kordi">A ferramenta que liberta.</span>
        </h1>

        <p style={{ fontSize: 34, lineHeight: 1.45, marginTop: 44, color: "#B9C2D6", maxWidth: 820, fontWeight: 500 }}>
          O parceiro que prepara o seu som no ensaio
          <br />e te acompanha no ao vivo.
        </p>

        {/* Módulos */}
        <div className="flex flex-col" style={{ gap: 44, marginTop: 110 }}>
          {modules.map((m) => (
            <div key={m.label} className="flex items-center" style={{ gap: 26 }}>
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "rgba(150,115,255,0.16)",
                  border: "2px solid rgba(150,115,255,0.6)",
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#9673FF" }} />
              </div>
              <p style={{ fontSize: 30, fontWeight: 500, color: "#8E99AF", whiteSpace: "nowrap" }}>
                <span style={{ fontWeight: 800, color: "#F8FAFC" }}>{m.label}</span>
                <span style={{ color: "#5E6A82", margin: "0 14px" }}>—</span>
                {m.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-auto flex items-center justify-between">
          <div
            className="bg-gradient-cta inline-flex items-center justify-center font-display font-black"
            style={{
              fontSize: 40, padding: "30px 64px", borderRadius: 999,
              boxShadow: "0 0 60px -12px rgba(194,75,247,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            kordi.app.br
          </div>
          <p style={{ fontSize: 26, fontWeight: 700, color: "#5E6A82", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Feito para tecladistas
          </p>
        </div>
      </div>
    </Frame>
  );
}

const ARTES: Record<string, () => JSX.Element> = {
  "5": Arte5,
};

export default function InstaArtPage() {
  const params = useParams<{ n: string }>();
  const Arte = ARTES[params.n ?? ""];
  if (!Arte) return <div className="p-10 text-white">Arte não encontrada.</div>;
  return <Arte />;
}

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

function PhoneMockup({
  src,
  width,
  screenHeight,
  offsetY = 0,
  style,
}: {
  src: string;
  width: number;
  /** Altura visível da "tela" do celular (janela de recorte) */
  screenHeight?: number;
  /** Quanto rolar a captura para cima dentro da janela (px na largura original de 402) */
  offsetY?: number;
  style?: React.CSSProperties;
}) {
  const bezel = Math.round(width * 0.045);
  const scale = (width - bezel * 2) / 402;
  return (
    <div
      style={{
        width,
        borderRadius: width * 0.16,
        padding: bezel,
        background: "linear-gradient(160deg, #2A3042 0%, #101420 60%)",
        border: "1px solid rgba(150,115,255,0.35)",
        boxShadow:
          "0 60px 120px -30px rgba(0,0,0,0.85), 0 0 90px -20px rgba(150,115,255,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
        ...style,
      }}
    >
      <div
        style={{
          borderRadius: width * 0.125,
          overflow: "hidden",
          background: "#070A12",
          position: "relative",
        }}
      >
        <div
          style={{
            height: screenHeight ? screenHeight * scale : undefined,
            overflow: "hidden",
          }}
        >
          <img
            src={src}
            alt=""
            style={{
              width: "100%",
              display: "block",
              transform: `translateY(-${offsetY * scale}px)`,
            }}
            draggable={false}
          />
        </div>
        {/* Notch */}
        <div
          style={{
            position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
            width: width * 0.32, height: width * 0.055, borderRadius: 999, background: "#000",
          }}
        />
      </div>
    </div>
  );
}

function Arte5() {
  return (
    <Frame>
      {/* Glow central atrás do mockup */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 420, left: "50%", transform: "translateX(-50%)",
          width: 1100, height: 1100, borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(150,115,255,0.30) 0%, rgba(194,75,247,0.14) 40%, rgba(7,10,18,0) 70%)",
        }}
      />
      {/* Glows laterais da marca */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -240, right: -240, width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(194,75,247,0.18) 0%, rgba(194,75,247,0) 65%)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: -320, left: -260, width: 820, height: 820, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(75,69,232,0.22) 0%, rgba(75,69,232,0) 65%)",
        }}
      />

      <div className="relative flex flex-col items-center h-full text-center" style={{ padding: "84px 80px 0" }}>
        {/* Marca */}
        <div className="flex items-center gap-4">
          <img src={`${basePath}/logo.png`} alt="" style={{ height: 64 }} draggable={false} />
          <span className="font-display font-black tracking-tight" style={{ fontSize: 46 }}>
            Kordi
          </span>
        </div>

        {/* Headline */}
        <h1
          className="font-display font-black tracking-tight"
          style={{ fontSize: 78, lineHeight: 1.1, marginTop: 66, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}
        >
          O som que inspira.
          <br />
          <span className="text-gradient-kordi">A ferramenta que liberta.</span>
        </h1>

        {/* Subhead */}
        <p style={{ fontSize: 33, lineHeight: 1.5, marginTop: 36, color: "#B9C2D6", fontWeight: 500 }}>
          O parceiro que prepara o seu som no ensaio
          <br />e te acompanha no ao vivo.
        </p>

        {/* Mockups do app — celular central grande + dois de apoio */}
        <div className="relative w-full flex justify-center" style={{ marginTop: 78, flex: 1 }}>
          <PhoneMockup
            src={`${basePath}/screenshots/insta-metronomo.jpg`}
            width={330}
            offsetY={330}
            screenHeight={620}
            style={{
              position: "absolute", left: 92, top: 66,
              transform: "rotate(-9deg)",
              opacity: 0.92,
            }}
          />
          <PhoneMockup
            src={`${basePath}/screenshots/insta-audiolab.jpg`}
            width={330}
            offsetY={80}
            screenHeight={620}
            style={{
              position: "absolute", right: 92, top: 66,
              transform: "rotate(9deg)",
              opacity: 0.92,
            }}
          />
          <PhoneMockup
            src={`${basePath}/screenshots/insta-acorde.jpg`}
            width={400}
            offsetY={160}
            screenHeight={620}
            style={{ position: "relative", zIndex: 10 }}
          />
        </div>

        {/* CTA fixo sobre a base */}
        <div
          className="absolute bg-gradient-cta inline-flex items-center justify-center font-display font-black"
          style={{
            bottom: 64, left: "50%", transform: "translateX(-50%)", zIndex: 20,
            fontSize: 38, padding: "28px 72px", borderRadius: 999, whiteSpace: "nowrap",
            boxShadow: "0 24px 70px -12px rgba(0,0,0,0.7), 0 0 60px -10px rgba(194,75,247,0.6), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        >
          kordi.app.br
        </div>
        {/* Fade da base para o CTA respirar */}
        <div
          className="absolute inset-x-0 pointer-events-none"
          style={{
            bottom: 0, height: 300, zIndex: 15,
            background: "linear-gradient(180deg, rgba(7,10,18,0) 0%, rgba(7,10,18,0.92) 75%)",
          }}
        />
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

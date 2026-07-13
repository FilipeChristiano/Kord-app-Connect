import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Redirect } from "wouter";
import {
  ArrowDown,
  Check,
  CreditCard,
  Loader2,
  Sparkles,
} from "lucide-react";

import { isIosApp, isAndroidTwa } from "@/lib/native-app";
import {
  AcordeDemo,
  AudioLabDemo,
  CifraDemo,
  MetronomoDemo,
  PadsDemo,
} from "@/components/landing-demos";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Plan {
  product_id: string;
  name: string;
  description: string | null;
  price_id: string;
  unit_amount: number;
  currency: string;
  interval: string;
}

const BENEFITS = [
  "Acesso completo a todas as ferramentas",
  "Funciona no celular, tablet e computador",
  "Atualizações incluídas, sem custo extra",
  "Sem fidelidade — cancele quando quiser",
];

const FAQ = [
  {
    q: "Preciso criar conta antes de assinar?",
    a: "Não. Você assina primeiro, direto no pagamento seguro da Stripe. Depois é só criar sua conta com o mesmo e-mail da compra e o acesso libera sozinho, em segundos.",
  },
  {
    q: "Funciona no meu celular?",
    a: "Sim. O Kordi funciona no navegador de qualquer celular, tablet ou computador — e você pode instalar como aplicativo na tela inicial.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Pode. Não tem fidelidade nem multa: você cancela a qualquer momento e continua com acesso até o fim do período já pago.",
  },
  {
    q: "O Audio Lab funciona com qualquer música?",
    a: "Sim. Você envia o arquivo de áudio de qualquer música sua e o Kordi separa a voz dos instrumentos para você estudar, ensaiar ou montar playback.",
  },
];

function formatPrice(unitAmount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100);
}

interface SectionProps {
  tag: string;
  title: React.ReactNode;
  description: string;
  children: React.ReactNode;
}

function FeatureSection({ tag, title, description, children }: SectionProps) {
  return (
    <section className="bg-card/50 border border-white/10 rounded-3xl p-6 sm:p-10 mb-6">
      <span className="inline-block text-[11px] font-bold tracking-[0.18em] uppercase text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-4">
        {tag}
      </span>
      <h2 className="font-display text-2xl sm:text-4xl font-bold leading-tight mb-3 max-w-2xl">
        {title}
      </h2>
      <p className="text-white/60 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl">
        {description}
      </p>
      {children}
    </section>
  );
}

/**
 * Página pública de venda: apresenta o Kordi com demonstrações interativas
 * reais e leva direto ao checkout da Stripe, SEM exigir conta antes. Depois
 * do pagamento a pessoa cria a conta com o mesmo e-mail e o acesso libera.
 *
 * Modos de loja (ver src/lib/native-app.ts):
 * - App iOS (App Store): esta página nunca aparece — redirect /sign-in
 *   (regra 3.1.1 da Apple: nenhum conteúdo de venda dentro do app).
 * - App Android (Play Store, TWA): sem botão de compra; apenas texto
 *   orientando a assinar pelo site.
 */
export default function LandingPage() {
  const [subscribing, setSubscribing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [iosApp] = useState(isIosApp);
  const [androidApp] = useState(() => !isIosApp() && isAndroidTwa());
  const showPurchase = !iosApp && !androidApp;

  const { data: plan } = useQuery<Plan | null>({
    queryKey: ["stripe-plan"],
    queryFn: async () => {
      const res = await fetch("/api/stripe/plan", { credentials: "include" });
      if (!res.ok) return null;
      const json = await res.json();
      return json.plan ?? null;
    },
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: !iosApp,
  });

  async function handleSubscribe() {
    setSubscribing(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("missing url");
    } catch {
      setCheckoutError(
        "Não foi possível abrir o pagamento agora. Tente novamente em instantes.",
      );
      setSubscribing(false);
    }
  }

  function scrollToPricing() {
    document
      .getElementById("assinatura")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // App iOS (App Store): a regra 3.1.1 da Apple proíbe QUALQUER conteúdo de
  // venda/assinatura dentro do app — inclusive nesta rota pública /assinar.
  if (iosApp) {
    return <Redirect to="/sign-in" />;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-white">
      {/* Cabeçalho fixo */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3 select-none" aria-hidden="true">
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt=""
              className="h-8 w-auto"
              draggable={false}
            />
            <img
              src={`${import.meta.env.BASE_URL}wordmark.svg`}
              alt="Kordi"
              className="h-5 w-auto"
              draggable={false}
            />
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              Entrar
            </Link>
            {showPurchase && (
              <button
                type="button"
                onClick={scrollToPricing}
                className="px-4 py-2 rounded-lg bg-gradient-to-br from-primary to-primary-700 text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
              >
                Assinar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-16">
        {/* Herói */}
        <section className="text-center pt-14 sm:pt-20 pb-14 max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 bg-white/5 border border-white/10 rounded-full px-3.5 py-1.5 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Feito para quem toca teclado e piano
          </span>
          <h1 className="font-display text-4xl sm:text-6xl font-bold leading-[1.08] mb-5">
            Tudo que a sua música precisa,{" "}
            <span className="bg-gradient-to-r from-primary to-[#C24BF7] bg-clip-text text-transparent">
              em um só lugar
            </span>
          </h1>
          <p className="text-white/70 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-8">
            Acordes com som real, cifras que se adaptam ao seu tom, separação
            de voz e instrumentos, metrônomo e pads. Experimente cada recurso
            aqui mesmo, antes de assinar.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {showPurchase && (
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={subscribing}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-br from-primary to-primary-700 text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-70"
              >
                {subscribing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CreditCard className="w-5 h-5" />
                )}
                {subscribing ? "Abrindo pagamento..." : "Assinar agora"}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("demos")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 border border-white/10 font-semibold hover:bg-white/10 transition-colors"
            >
              <ArrowDown className="w-5 h-5 text-primary" />
              Experimentar recursos
            </button>
          </div>
          {checkoutError && (
            <p className="text-red-400 text-sm mt-4">{checkoutError}</p>
          )}
        </section>

        {/* Demonstrações */}
        <div id="demos">
          <FeatureSection
            tag="Dicionário de acordes"
            title={
              <>
                Acordes sofisticados,{" "}
                <span className="text-primary">longe do óbvio</span>
              </>
            }
            description="Variações sofisticadas de cada acorde — voicings que fogem da forma comum que todo mundo copia da internet — com diagrama de mãos, aplicações práticas e som de piano de verdade. Toque nos acordes abaixo e ouça agora:"
          >
            <AcordeDemo />
          </FeatureSection>

          <FeatureSection
            tag="Cifras inteligentes"
            title={
              <>
                Cifras no seu tom —{" "}
                <span className="text-primary">e com acordes sofisticados</span>
              </>
            }
            description="Cole qualquer cifra no Kordi: mude o tom na hora (os acordes mudam, a letra fica no lugar) e deixe o Sofisticador trocar os acordes simples por versões sofisticadas, em três níveis — Suave, Intermediário e Avançado. Teste a mudança de tom no trecho abaixo:"
          >
            <CifraDemo />
          </FeatureSection>

          <FeatureSection
            tag="Audio Lab"
            title={
              <>
                Separe a voz dos instrumentos{" "}
                <span className="text-primary">de qualquer música</span>
              </>
            }
            description="Envie uma música e o Kordi separa a voz dos instrumentos: tire a voz para montar playback ou deixe só a voz para estudar o vocal. Mexa nos controles:"
          >
            <AudioLabDemo />
          </FeatureSection>

          <FeatureSection
            tag="Metrônomo e Pads"
            title={
              <>
                Ensaie com{" "}
                <span className="text-primary">tempo firme e clima</span>
              </>
            }
            description="Metrônomo preciso para estudar no andamento certo e pads contínuos para sustentar o som entre as músicas. Aperte o play:"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <MetronomoDemo />
              <PadsDemo />
            </div>
          </FeatureSection>
        </div>

        {/* Assinatura */}
        <section id="assinatura" className="max-w-lg mx-auto pt-10 scroll-mt-24">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-6">
            Comece hoje mesmo
          </h2>
          <div className="bg-card/60 border border-primary/25 rounded-3xl p-8 shadow-2xl shadow-black/40">
            <div className="flex items-baseline gap-2 mb-5">
              <span className="font-display text-4xl font-bold">
                {plan ? formatPrice(plan.unit_amount, plan.currency) : "R$ 49,90"}
              </span>
              <span className="text-white/60 text-sm">/mês no cartão</span>
            </div>
            <ul className="space-y-2.5 mb-6">
              {BENEFITS.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2.5 text-sm text-white/80"
                >
                  <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  {b}
                </li>
              ))}
            </ul>

            {showPurchase ? (
              <>
                {checkoutError && (
                  <p className="text-red-400 text-sm mb-4">{checkoutError}</p>
                )}
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-gradient-to-br from-primary to-primary-700 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20 hover:brightness-110 transition-all disabled:opacity-70"
                >
                  {subscribing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CreditCard className="w-5 h-5" />
                  )}
                  {subscribing ? "Abrindo pagamento..." : "Assinar agora"}
                </button>
                <p className="text-white/50 text-xs mt-3 text-center">
                  Pagamento seguro pela Stripe. Depois de pagar, crie sua conta
                  com o mesmo e-mail da compra e o acesso libera sozinho.
                </p>
              </>
            ) : (
              /* Apps das lojas: sem botão/link de compra (política das
                 lojas) — no Android, apenas orientação em texto. */
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/70 text-center">
                A assinatura é feita pelo site do Kordi. Abra{" "}
                <span className="text-white font-medium">kordi.app.br</span> no
                navegador do seu celular ou computador (por exemplo, Chrome)
                para assinar.
              </div>
            )}
          </div>

          <p className="text-center text-sm text-white/60 mt-6">
            Já assinou?{" "}
            <Link
              href="/sign-up"
              className="text-primary hover:underline font-medium"
            >
              Crie sua conta
            </Link>{" "}
            com o e-mail da compra ou{" "}
            <Link
              href="/sign-in"
              className="text-primary hover:underline font-medium"
            >
              entre
            </Link>
            .
          </p>
        </section>

        {/* Perguntas frequentes */}
        <section className="max-w-2xl mx-auto pt-14">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-6">
            Perguntas frequentes
          </h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <details
                key={q}
                className="group bg-card/50 border border-white/10 rounded-2xl px-5 py-4"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-medium text-sm sm:text-base">
                  {q}
                  <span className="text-primary transition-transform group-open:rotate-45 text-xl leading-none shrink-0">
                    +
                  </span>
                </summary>
                <p className="text-sm text-white/60 leading-relaxed mt-3">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-6">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between text-xs text-white/40">
          <span>Kordi — kordi.app.br</span>
          <a href={`${basePath}/privacidade`} className="hover:text-white/70">
            Política de Privacidade
          </a>
        </div>
      </footer>
    </div>
  );
}

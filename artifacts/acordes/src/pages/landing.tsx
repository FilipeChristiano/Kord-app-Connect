import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Link, Redirect } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Sparkles,
  Zap,
  Mic2,
  ListMusic,
  PlaySquare,
  BadgeCheck,
  Plus
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
  "Dicionário completo com som real de piano",
  "Transposição e Sofisticador inteligente",
  "Audio Lab: separe voz de instrumentos na hora",
  "Metrônomo preciso e Pads de worship infinitos",
  "Acesso total no celular, tablet e computador",
  "Sem fidelidade — cancele quando quiser",
];

const FAQ = [
  {
    q: "Preciso criar conta antes de assinar?",
    a: "Não. Você assina primeiro, direto no checkout seguro da Stripe. Depois, cria a conta com o mesmo e-mail e seu acesso é liberado instantaneamente.",
  },
  {
    q: "O Kordi funciona no meu celular?",
    a: "Com certeza! É 100% otimizado para celulares. Você pode acessar pelo navegador e até instalar na tela inicial como um aplicativo leve e rápido.",
  },
  {
    q: "Posso cancelar a assinatura quando quiser?",
    a: "Sim, sem burocracia e sem multas. Você cancela com um clique no painel e continua acessando até o fim do período que já foi pago.",
  },
  {
    q: "O Audio Lab separa qualquer música?",
    a: "Qualquer música que você enviar. Nossa inteligência processa o áudio, cria a cifra e isola a voz, o instrumental e extrai o metrônomo perfeito. E tudo isso no seu navegador.",
  },
];

function formatPrice(unitAmount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ badge, title, subtitle }: { badge: string; title: React.ReactNode; subtitle: string }) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-16 px-4">
      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6 shadow-sm">
        <Sparkles className="w-3.5 h-3.5" />
        {badge}
      </span>
      <h2 className="font-display text-3xl sm:text-5xl font-black leading-[1.1] text-slate-900 mb-6">
        {title}
      </h2>
      <p className="text-lg sm:text-xl text-slate-600 leading-relaxed font-medium">
        {subtitle}
      </p>
    </div>
  );
}

function ModuleScreenshots({
  shots,
}: {
  shots: { src: string; alt: string; label: string }[];
}) {
  return (
    <div className={`mt-10 grid gap-6 ${shots.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {shots.map((s) => (
        <figure key={s.src} className={shots.length === 1 ? "max-w-2xl mx-auto w-full" : ""}>
          <div className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-200/60 transition-transform duration-500 hover:-translate-y-1">
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            </div>
            <img
              src={`${basePath}/screenshots/${s.src}`}
              alt={s.alt}
              loading="lazy"
              className="w-full block max-h-[420px] object-cover object-top"
            />
          </div>
          <figcaption className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-3 text-center">
            {s.label}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function RevealOnScroll({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 transform ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
    >
      {children}
    </div>
  );
}

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
    enabled: showPurchase,
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("missing url");
    } catch {
      setCheckoutError("Ocorreu um erro ao abrir o pagamento. Tente novamente.");
      setSubscribing(false);
    }
  }

  function scrollToPricing() {
    document.getElementById("assinatura")?.scrollIntoView({ behavior: "smooth" });
  }

  if (iosApp) return <Redirect to="/sign-in" />;

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 font-sans selection:bg-primary/20 selection:text-primary">
      {/* Navbar Minimalista */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={`${basePath}/logo.png`} alt="" className="h-8 w-auto drop-shadow-sm" draggable={false} />
            <span className="font-display font-black text-xl tracking-tight text-slate-900 mt-1">Kordi</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm font-bold text-slate-600 hover:text-primary transition-colors hidden sm:block"
            >
              Já tenho conta
            </Link>
            {showPurchase && (
              <button
                type="button"
                onClick={scrollToPricing}
                className="group relative inline-flex items-center justify-center px-6 py-2.5 text-sm font-black text-white transition-all duration-200 bg-primary border border-transparent rounded-full shadow-lg shadow-primary/30 hover:shadow-xl hover:scale-105 hover:bg-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-95 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Assinar agora
                </span>
                <div className="absolute inset-0 h-full w-full bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* HERO SECTION - Claro, Brilhante, Impactante */}
        <section className="relative pt-24 pb-32 overflow-hidden">
          {/* Fundo abstrato leve */}
          <div className="absolute inset-0 pointer-events-none -z-10 bg-slate-50">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-white to-transparent opacity-80" />
            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl opacity-60 mix-blend-multiply" />
            <div className="absolute top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#8B5CF6]/5 blur-3xl opacity-60 mix-blend-multiply" />
          </div>

          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-8 animate-fade-in-up">
                  <BadgeCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">A revolução no seu louvor</span>
                </div>
                
                <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.05] tracking-tight mb-8">
                  O som que inspira.<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#8B5CF6] to-[#C24BF7] inline-block mt-2">
                    A ferramenta que liberta.
                  </span>
                </h1>
                
                <p className="text-lg sm:text-xl text-slate-600 leading-relaxed font-medium mb-10 max-w-2xl mx-auto lg:mx-0">
                  Esqueça apps escuros e confusos. O Kordi é claro, rápido e feito para músicos exigentes. Acordes reais, cifras que acompanham seu cantor, e separação de áudio no navegador.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                  {showPurchase && (
                    <button
                      type="button"
                      onClick={scrollToPricing}
                      className="w-full sm:w-auto group relative inline-flex items-center justify-center px-8 py-4 text-lg font-black text-white transition-all duration-300 bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:-translate-y-1 hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        Garantir meu acesso
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => document.getElementById("demos")?.scrollIntoView({ behavior: "smooth" })}
                    className="w-full sm:w-auto group inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-slate-700 transition-all duration-300 bg-white border-2 border-slate-200 rounded-2xl hover:border-slate-300 hover:bg-slate-50 focus:outline-none shadow-sm"
                  >
                    <ChevronDown className="w-5 h-5 text-primary mr-2 group-hover:translate-y-1 transition-transform" />
                    Experimente agora
                  </button>
                </div>
              </div>

              {/* Imagem de Hero Gerada */}
              <div className="relative mx-auto w-full max-w-[500px] lg:max-w-none">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-[#C24BF7]/20 rounded-[2.5rem] transform rotate-3 scale-105 blur-lg opacity-60 animate-pulse"></div>
                <div className="relative rounded-[2rem] overflow-hidden border-8 border-white shadow-2xl shadow-slate-900/10 transform transition-transform hover:scale-[1.02] duration-500">
                  <img 
                    src={`${basePath}/images/hero-light.png`} 
                    alt="Teclado moderno em estúdio claro" 
                    className="w-full h-auto object-cover aspect-video"
                  />
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md border border-white p-4 rounded-2xl shadow-lg flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <PlaySquare className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Som de piano real</p>
                      <p className="text-xs text-slate-500 font-medium">Gravado nota a nota em estúdio.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DEMOS INTERATIVAS - A prova social do produto */}
        <section id="demos" className="py-24 bg-white border-y border-slate-200/50">
          <div className="max-w-5xl mx-auto px-6">
            
            <RevealOnScroll>
              <div className="mb-32">
                <SectionHeader 
                  badge="Dicionário Vivo"
                  title="Saia do básico."
                  subtitle="Toque nos acordes abaixo e perceba a diferença na hora. Formas comuns soam quadradas. Nossas variações preenchem a sala."
                />
                <AcordeDemo />
                <ModuleScreenshots
                  shots={[
                    {
                      src: "screenshot-2-dicionario.jpg",
                      alt: "Tela do dicionário de acordes do Kordi",
                      label: "Tela real do app — Dicionário de acordes",
                    },
                  ]}
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll>
              <div className="mb-32">
                <SectionHeader 
                  badge="Cifra Adaptável"
                  title="O cantor mudou de tom?"
                  subtitle="Um clique e a cifra acompanha. Letra intacta, acordes reescritos."
                />
                <CifraDemo />
                <ModuleScreenshots
                  shots={[
                    {
                      src: "modulo-sofisticador.jpg",
                      alt: "Tela do Sofisticador de Cifra do Kordi",
                      label: "Tela real do app — Sofisticador de Cifra",
                    },
                  ]}
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll>
              <div className="mb-32">
                <SectionHeader 
                  badge="Audio Lab Nativo"
                  title="A mágica acontece aqui."
                  subtitle="Veja como o Kordi isola vocais e instrumentos direto no seu navegador. Nenhuma instalação necessária."
                />
                <AudioLabDemo />
                <ModuleScreenshots
                  shots={[
                    {
                      src: "modulo-audiolab.jpg",
                      alt: "Tela do Audio Lab do Kordi",
                      label: "Tela real do app — Audio Lab",
                    },
                  ]}
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll>
              <div className="mb-10">
                <SectionHeader 
                  badge="Essenciais"
                  title="Foco e Sustentação"
                  subtitle="Metrônomo que não falha e Pads contínuos para cobrir os silêncios. Teste você mesmo."
                />
                <div className="grid lg:grid-cols-2 gap-8">
                  <MetronomoDemo />
                  <PadsDemo />
                </div>
                <ModuleScreenshots
                  shots={[
                    {
                      src: "modulo-metronomo.jpg",
                      alt: "Tela do Metrônomo Inteligente do Kordi",
                      label: "Tela real do app — Metrônomo Inteligente",
                    },
                    {
                      src: "modulo-pads.jpg",
                      alt: "Tela do Pad Worship Contínuo do Kordi",
                      label: "Tela real do app — Pad Worship Contínuo",
                    },
                  ]}
                />
              </div>
            </RevealOnScroll>

          </div>
        </section>

        {/* PRICING SECTION - Limpo, Direto e Focado na Ação */}
        <section id="assinatura" className="py-32 bg-slate-50 relative overflow-hidden">
           <div className="absolute inset-0 pointer-events-none -z-10">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-3xl opacity-50 rounded-t-full" />
          </div>

          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="font-display text-4xl sm:text-5xl font-black text-slate-900 mb-4">Acesso Ilimitado</h2>
              <p className="text-lg text-slate-600 font-medium">Tudo que você testou acima, liberado no seu celular e computador.</p>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 sm:p-12 relative overflow-hidden transform hover:scale-[1.01] transition-transform duration-500 max-w-2xl mx-auto">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Zap className="w-32 h-32 text-primary" />
              </div>
              
              <div className="relative z-10 flex flex-col sm:flex-row gap-12 items-center">
                <div className="flex-1 space-y-4">
                  <h3 className="font-display text-2xl font-black text-slate-900">Plano Pro</h3>
                  {showPurchase && (
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-5xl font-black text-slate-900 tracking-tight">
                        {plan ? (
                          formatPrice(plan.unit_amount, plan.currency)
                        ) : (
                          <span className="inline-block w-40 h-10 rounded-xl bg-slate-100 animate-pulse align-middle" />
                        )}
                      </span>
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-sm">
                        / {plan?.interval === "year" ? "ano" : "mês"}
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-slate-500 font-medium">Cancele a qualquer momento. Sem burocracia.</p>
                </div>

                <div className="flex-1 w-full">
                  <ul className="space-y-4 mb-8">
                    {BENEFITS.map((b, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm font-bold text-slate-700">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>

                  {showPurchase ? (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleSubscribe}
                        disabled={subscribing}
                        className="w-full relative inline-flex items-center justify-center px-6 py-4 text-base font-black text-white transition-all duration-300 bg-gradient-to-r from-primary to-[#8B5CF6] rounded-2xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 disabled:hover:scale-100 overflow-hidden"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          {subscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                          {subscribing ? "Abrindo pagamento..." : "Assinar e Liberar Acesso"}
                        </span>
                      </button>
                      {checkoutError && (
                        <p className="text-rose-500 text-sm font-bold text-center bg-rose-50 p-2 rounded-lg">{checkoutError}</p>
                      )}
                      <p className="text-xs text-center text-slate-400 font-medium">Pagamento seguro pela Stripe. Acesso imediato após a compra.</p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm text-slate-700 text-center font-medium shadow-inner">
                      Assine pelo site oficial: <br/>
                      <span className="text-slate-900 font-black text-lg block mt-2">kordi.app.br</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-center text-sm text-slate-500 font-medium mt-8">
              Já assinou? <Link href="/sign-up" className="text-primary hover:underline font-bold">Crie sua conta</Link> com o e-mail da compra ou <Link href="/sign-in" className="text-primary hover:underline font-bold">entre aqui</Link>.
            </p>
          </div>
        </section>

        {/* FAQ - Limpo e Claro */}
        <section className="py-24 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="font-display text-3xl sm:text-4xl font-black text-center text-slate-900 mb-12">Dúvidas Frequentes</h2>
            <div className="space-y-4">
              {FAQ.map(({ q, a }, i) => (
                <details key={i} className="group bg-slate-50 border border-slate-200 rounded-2xl p-6 transition-all hover:bg-slate-100 cursor-pointer shadow-sm">
                  <summary className="list-none flex items-center justify-between font-bold text-slate-800 text-lg outline-none">
                    {q}
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-open:rotate-45 transition-transform duration-300">
                      <Plus className="w-4 h-4 text-primary" />
                    </div>
                  </summary>
                  <p className="text-slate-600 mt-4 leading-relaxed font-medium pr-10 animate-fade-in-up">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
             <img src={`${basePath}/logo.png`} alt="" className="h-6 w-auto grayscale opacity-50" draggable={false} />
             <span className="font-display font-bold text-slate-500">Kordi</span>
          </div>
          <div className="text-sm font-medium">
            © {new Date().getFullYear()} Kordi. Todos os direitos reservados.
          </div>
          <Link href="/privacidade" className="text-sm font-bold text-slate-500 hover:text-white transition-colors">
            Política de Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}

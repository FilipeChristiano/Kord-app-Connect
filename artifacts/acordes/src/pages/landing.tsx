import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Redirect } from "wouter";
import {
  Check,
  CreditCard,
  Loader2,
  Music,
  Scissors,
  BookOpen,
  Timer,
} from "lucide-react";

import { isIosApp, isAndroidTwa } from "@/lib/native-app";

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

const FEATURES = [
  {
    icon: BookOpen,
    title: "Dicionário de acordes",
    description:
      "Centenas de acordes de piano com diagrama, aplicações e áudio real.",
  },
  {
    icon: Music,
    title: "Cifras inteligentes",
    description:
      "Transponha o tom, sofistique os acordes e edite qualquer cifra.",
  },
  {
    icon: Scissors,
    title: "Audio Lab",
    description:
      "Separe a voz dos instrumentos de qualquer música para estudar e ensaiar.",
  },
  {
    icon: Timer,
    title: "Metrônomo, pads e estudo",
    description:
      "Metrônomo sincronizado, pads contínuos e modo de estudo gamificado.",
  },
];

const BENEFITS = [
  "Acesso completo a todas as ferramentas",
  "Funciona no celular, tablet e computador",
  "Atualizações incluídas, sem custo extra",
  "Sem fidelidade — cancele quando quiser",
];

function formatPrice(unitAmount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100);
}

/**
 * Página pública de venda: apresenta o Kordi e leva direto ao checkout da
 * Stripe, SEM exigir conta antes. Depois do pagamento a pessoa cria a conta
 * com o mesmo e-mail da compra e o acesso libera sozinho.
 *
 * Modos de loja (ver src/lib/native-app.ts):
 * - App iOS (App Store): esta página nunca aparece — deslogado vai para
 *   /sign-in (App.tsx) e o preço nunca é exibido (regra 3.1.1 da Apple).
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

  // App iOS (App Store): a regra 3.1.1 da Apple proíbe QUALQUER conteúdo de
  // venda/assinatura dentro do app — inclusive nesta rota pública /assinar.
  // Redireciona direto para a tela de entrar.
  if (iosApp) {
    return <Redirect to="/sign-in" />;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-white">
      {/* Cabeçalho */}
      <header className="max-w-5xl mx-auto flex items-center justify-between px-4 py-5">
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
        <Link
          href="/sign-in"
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
        >
          Entrar
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-16">
        {/* Herói */}
        <section className="text-center pt-10 pb-12 max-w-2xl mx-auto">
          <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight mb-4">
            Toque mais, trave menos:{" "}
            <span className="bg-gradient-to-r from-primary to-[#C24BF7] bg-clip-text text-transparent">
              seu piano evolui aqui
            </span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed">
            Dicionário de acordes com som real, cifras que se adaptam ao seu
            tom, separação de voz e instrumentos e ferramentas de estudo —
            tudo em um só lugar.
          </p>
        </section>

        {/* Recursos */}
        <section className="grid sm:grid-cols-2 gap-4 mb-12">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-card/60 border border-white/10 rounded-2xl p-5 flex items-start gap-4"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                <Icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold mb-1">{title}</h2>
                <p className="text-sm text-white/60 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Assinatura */}
        <section className="max-w-lg mx-auto">
          <div className="bg-card/60 border border-primary/25 rounded-2xl p-8 shadow-2xl shadow-black/40">
            {!iosApp && (
              <div className="flex items-baseline gap-2 mb-5">
                <span className="font-display text-4xl font-bold">
                  {plan
                    ? formatPrice(plan.unit_amount, plan.currency)
                    : "R$ 49,90"}
                </span>
                <span className="text-white/60 text-sm">/mês no cartão</span>
              </div>
            )}
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
                  Pagamento seguro pela Stripe. Depois de pagar, crie sua
                  conta com o mesmo e-mail da compra e o acesso libera
                  sozinho.
                </p>
              </>
            ) : (
              /* Apps das lojas: sem botão/link de compra (política das
                 lojas) — no Android, apenas orientação em texto. */
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/70 text-center">
                A assinatura é feita pelo site do Kordi. Abra{" "}
                <span className="text-white font-medium">kordi.app.br</span>{" "}
                no navegador do seu celular ou computador (por exemplo,
                Chrome) para assinar.
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

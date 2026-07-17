import { useClerk, useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LogOut,
  Mail,
  RefreshCw,
  CreditCard,
  Check,
  Loader2,
  Sparkles,
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

const BENEFITS = [
  "Dicionário completo de acordes com áudio real de piano",
  "Cifras inteligentes: transposição, sofisticador e edição",
  "Audio Lab: separe voz e instrumentos de qualquer música",
  "Metrônomo, pads contínuos e modo estudo gamificado",
];

function formatPrice(unitAmount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100);
}

export default function NoAccessPage() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [iosApp] = useState(isIosApp);
  const [isAndroidApp] = useState(() => !isIosApp() && isAndroidTwa());

  const email =
    user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

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
    // No app iOS o preço nunca é exibido — não busca o plano à toa.
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
      if (res.status === 409) {
        // Já tem assinatura ativa — força a rechecagem do acesso
        await queryClient.invalidateQueries({ queryKey: ["access"] });
        return;
      }
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
    } finally {
      setSubscribing(false);
    }
  }

  async function handleRecheck() {
    setChecking(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["access"] });
      await queryClient.refetchQueries({ queryKey: ["access"] });
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-12">
      <div className="max-w-lg w-full bg-card/60 border border-foreground/10 rounded-2xl p-8 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center shadow-lg shadow-primary/20 mb-6">
          <Sparkles className="w-7 h-7 text-primary-foreground" />
        </div>

        <h1 className="font-display text-3xl font-bold text-foreground mb-3">
          {iosApp ? "Conta sem acesso ativo" : "Assine o Kordi"}
        </h1>

        <p className="text-foreground/70 mb-6 leading-relaxed">
          {iosApp ? (
            email ? (
              <>
                Sua conta{" "}
                <span className="text-foreground font-medium">{email}</span> ainda
                não tem um acesso ativo. Assim que ele estiver ativo, o app
                libera automaticamente.
              </>
            ) : (
              "Sua conta ainda não tem um acesso ativo. Assim que ele estiver ativo, o app libera automaticamente."
            )
          ) : email ? (
            <>
              Sua conta{" "}
              <span className="text-foreground font-medium">{email}</span> foi
              criada. Para desbloquear tudo, ative sua assinatura mensal:
            </>
          ) : (
            "Sua conta foi criada. Para desbloquear tudo, ative sua assinatura mensal:"
          )}
        </p>

        {/* App iOS (App Store): a regra 3.1.1 da Apple proíbe mostrar preço,
            botão/link de compra ou orientar o usuário a assinar fora do app.
            Nada de painel de preço, benefícios de venda ou instruções. */}
        {!iosApp && (
          <div className="bg-foreground/5 border border-primary/25 rounded-xl p-5 mb-5">
            <div className="inline-flex items-center gap-1.5 bg-primary/15 text-primary font-semibold text-xs px-2.5 py-1 rounded-full mb-3">
              7 dias grátis para testar
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-display text-4xl font-bold text-foreground">
                {plan ? formatPrice(plan.unit_amount, plan.currency) : "R$ 39,90"}
              </span>
              <span className="text-foreground/60 text-sm">/mês após o teste</span>
            </div>
            <ul className="space-y-2.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/80">
                  <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
            <p className="text-foreground/50 text-xs mt-4">
              Sem fidelidade — cancele quando quiser. A primeira cobrança só
              acontece depois dos 7 dias grátis.
            </p>
          </div>
        )}

        {iosApp ? null : isAndroidApp ? (
          /* App Android (Play Store): sem botão nem link de compra dentro do
             app, conforme a política da loja — apenas orientação em texto. */
          <div className="bg-foreground/5 border border-foreground/10 rounded-xl p-4 mb-4 text-sm text-foreground/70 text-center">
            A assinatura é feita pelo site do Kordi. Abra{" "}
            <span className="text-foreground font-medium">kordi.app.br</span> no
            navegador do seu celular ou computador (por exemplo, Chrome) e
            entre com a mesma conta para assinar.
          </div>
        ) : (
          <>
            {checkoutError && (
              <p className="text-red-400 text-sm mb-4">{checkoutError}</p>
            )}

            <button
              type="button"
              onClick={handleSubscribe}
              disabled={subscribing}
              className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-gradient-to-br from-primary to-primary-700 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20 hover:brightness-110 transition-all disabled:opacity-70 mb-4"
            >
              {subscribing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CreditCard className="w-5 h-5" />
              )}
              {subscribing ? "Abrindo pagamento..." : "Começar 7 dias grátis"}
            </button>
          </>
        )}

        <div className="bg-foreground/5 border border-foreground/10 rounded-xl p-4 mb-4 text-sm text-foreground/70">
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            {iosApp ? (
              /* iOS: sem menção a compra/pagamento (regra 3.1.1 da Apple) */
              <div>
                <strong className="text-foreground">Já tem acesso?</strong>{" "}
                Entre exatamente com o mesmo e-mail da sua conta Kordi.
                Verificamos automaticamente a cada poucos segundos — assim que
                o acesso estiver ativo, esta página libera sozinha.
              </div>
            ) : (
              <div>
                <strong className="text-foreground">Já assinou ou comprou antes?</strong>{" "}
                Use exatamente o mesmo e-mail da compra. Verificamos
                automaticamente a cada poucos segundos — assim que o pagamento
                for confirmado, esta página libera sozinha.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleRecheck}
            disabled={checking}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground font-medium transition-colors disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Verificando..." : "Verificar agora"}
          </button>
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

import { useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut, ShoppingCart, Mail, RefreshCw } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function NoAccessPage() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);

  const email =
    user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

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
      <div className="max-w-lg w-full bg-card/60 border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-orange-700 flex items-center justify-center shadow-lg shadow-primary/20 mb-6">
          <ShoppingCart className="w-7 h-7 text-primary-foreground" />
        </div>

        <h1 className="font-display text-3xl font-bold text-white mb-3">
          Acesso ainda não liberado
        </h1>

        <p className="text-white/70 mb-6 leading-relaxed">
          Sua conta foi criada, mas o e-mail{" "}
          {email ? (
            <span className="text-white font-medium">{email}</span>
          ) : (
            "informado"
          )}{" "}
          ainda não consta como comprador. Para entrar, você precisa adquirir o
          curso na Hotmart usando esse mesmo e-mail.
        </p>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 text-sm text-white/70">
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div>
              <strong className="text-white">Já comprou?</strong> Use exatamente
              o mesmo e-mail da compra. Estamos verificando automaticamente a
              cada poucos segundos — assim que a Hotmart confirmar, esta página
              libera sozinha.
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleRecheck}
            disabled={checking}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-br from-primary to-orange-700 text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:brightness-110 transition-all disabled:opacity-70"
          >
            <RefreshCw
              className={`w-4 h-4 ${checking ? "animate-spin" : ""}`}
            />
            {checking ? "Verificando..." : "Verificar agora"}
          </button>
          <a
            href="https://hotmart.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Comprar
          </a>
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

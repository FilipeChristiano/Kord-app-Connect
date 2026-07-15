import { SignUp } from "@clerk/react";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  // Vindo do checkout da Stripe (?checkout=success): confirma o pagamento e
  // reforça que a conta deve usar o MESMO e-mail da compra.
  const [fromCheckout] = useState(
    () =>
      new URLSearchParams(window.location.search).get("checkout") ===
      "success",
  );

  return (
    // Fundo sempre escuro: o cartão do Clerk e a logo branca são escuros,
    // independentemente do tema claro/escuro escolhido no app.
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-4 py-8"
      style={{ backgroundColor: "#070A12" }}
    >
      {fromCheckout && (
        <div className="max-w-md w-full flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-sm text-emerald-100">
          <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-400 shrink-0" />
          <div>
            <strong className="text-emerald-300">Pagamento confirmado!</strong>{" "}
            Agora crie sua conta usando{" "}
            <strong className="text-white">
              o mesmo e-mail que você informou na compra
            </strong>{" "}
            — o acesso libera sozinho em segundos.
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 select-none" aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt=""
          className="h-10 w-auto"
          draggable={false}
        />
        <img
          src={`${import.meta.env.BASE_URL}wordmark.svg`}
          alt="Kordi"
          className="h-7 w-auto select-none"
          draggable={false}
        />
      </div>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={basePath || "/"}
      />
    </div>
  );
}

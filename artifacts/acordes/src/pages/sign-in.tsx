import { SignIn } from "@clerk/react";
import { isIosApp } from "@/lib/native-app";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  return (
    // Fundo sempre escuro: o cartão do Clerk e a logo branca são escuros,
    // independentemente do tema claro/escuro escolhido no app.
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-4 py-8"
      style={{ backgroundColor: "#070A12" }}
    >
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
      {/* No app iOS não há cadastro dentro do app (regra 3.1.1): esconde o
          rodapé "Criar conta" e não aponta para /sign-up */}
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        {...(isIosApp() ? {} : { signUpUrl: `${basePath}/sign-up` })}
        fallbackRedirectUrl={basePath || "/"}
        appearance={
          isIosApp()
            ? { elements: { footerAction: "!hidden", footer: "!hidden" } }
            : undefined
        }
      />
    </div>
  );
}

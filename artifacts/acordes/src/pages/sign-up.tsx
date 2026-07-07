import { SignUp } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-background px-4 py-8">
      <div className="flex items-center gap-3 select-none" aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt=""
          className="h-10 w-auto"
          draggable={false}
        />
        <span className="font-brand font-bold text-3xl tracking-tight text-foreground">Kordi</span>
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

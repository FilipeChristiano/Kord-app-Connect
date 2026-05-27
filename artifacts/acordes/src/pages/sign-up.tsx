import { useEffect, useState } from "react";
import { useSignUp } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Step = "email" | "code";

function deriveNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, "")
    .trim();
  if (!cleaned) return "Usuário";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function messageForCode(code: string | undefined, fallback: string): string {
  switch (code) {
    case "form_identifier_exists":
      return "Esse e-mail já tem conta. Vá para a tela de Entrar.";
    case "form_param_format_invalid":
      return "E-mail inválido. Confira a digitação.";
    case "form_code_incorrect":
    case "verification_failed":
      return "Código incorreto. Confira o e-mail e tente novamente.";
    case "verification_expired":
      return "O código expirou. Peça um novo.";
    case "too_many_requests":
      return "Muitas tentativas. Aguarde alguns minutos.";
    default:
      return fallback;
  }
}

export default function SignUpPage() {
  const { signUp } = useSignUp();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Prefill email if redirected from sign-in with ?email=... query param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("email");
    if (prefill) setEmail(prefill);
  }, []);

  async function handleSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp || loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const derivedName = deriveNameFromEmail(trimmedEmail);

      // Reset any stale sign-up state from previous attempts.
      try {
        signUp.reset?.();
      } catch {
        // ignore
      }

      const createRes = await signUp.create({
        emailAddress: trimmedEmail,
        firstName: derivedName,
        lastName: "Harmonic",
      } as Parameters<typeof signUp.create>[0]);

      if (createRes.error) {
        // If the account already exists, push them to sign-in seamlessly.
        if (createRes.error.code === "form_identifier_exists") {
          setLocation(
            `${basePath || ""}/sign-in?email=${encodeURIComponent(trimmedEmail)}`,
          );
          return;
        }
        setError(
          messageForCode(
            createRes.error.code,
            createRes.error.message || "Não foi possível iniciar o cadastro.",
          ),
        );
        return;
      }
      const sendRes = await signUp.verifications.sendEmailCode();
      if (sendRes.error) {
        setError(
          messageForCode(
            sendRes.error.code,
            sendRes.error.message || "Não foi possível enviar o código.",
          ),
        );
        return;
      }
      setStep("code");
      setInfo("Enviamos um código de 6 dígitos para o seu e-mail.");
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || "Algo deu errado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp || loading) return;
    setError(null);
    setLoading(true);
    try {
      const verifyRes = await signUp.verifications.verifyEmailCode({
        code: code.trim(),
      });
      const alreadyVerified =
        verifyRes.error?.code === "verification_already_verified" ||
        /already.*verified/i.test(verifyRes.error?.message || "");
      if (verifyRes.error && !alreadyVerified) {
        setError(
          messageForCode(
            verifyRes.error.code,
            verifyRes.error.message || "Código inválido.",
          ),
        );
        return;
      }

      // If Clerk reports missing requirements (e.g. name fields), backfill
      // them now so finalize() can produce a session.
      const status = (signUp as unknown as { status?: string }).status;
      if (status && status !== "complete") {
        const derivedName = deriveNameFromEmail(email.trim());
        try {
          await (signUp as unknown as {
            update: (p: { firstName: string; lastName: string }) => Promise<unknown>;
          }).update({
            firstName: derivedName,
            lastName: "Harmonic",
          });
        } catch {
          // best effort — finalize will surface the real error below
        }
      }

      const finalizeRes = await signUp.finalize();
      if (finalizeRes.error) {
        setError(
          messageForCode(
            finalizeRes.error.code,
            finalizeRes.error.message ||
              "Não foi possível concluir o cadastro.",
          ),
        );
        return;
      }
      setLocation(basePath || "/");
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || "Algo deu errado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!signUp || loading) return;
    setError(null);
    setLoading(true);
    try {
      const sendRes = await signUp.verifications.sendEmailCode();
      if (sendRes.error) {
        setError(
          messageForCode(
            sendRes.error.code,
            sendRes.error.message || "Não foi possível reenviar.",
          ),
        );
        return;
      }
      setInfo("Um novo código foi enviado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-[hsl(224,38%,9%)] p-8 shadow-2xl shadow-black/40">
        <div className="mb-6 flex justify-center">
          <img
            src={`${basePath}/logo.svg`}
            alt="Harmonic App"
            className="h-10 w-auto"
          />
        </div>

        {step === "email" ? (
          <>
            <h1 className="font-display text-2xl text-white text-center">
              Crie sua conta
            </h1>
            <p className="mt-1 text-center text-sm text-white/70">
              Use o mesmo e-mail da sua compra na Hotmart
            </p>

            <form onSubmit={handleSubmitEmail} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="bg-[hsl(224,35%,12%)] border-white/10 text-white"
                />
              </div>

              {error && (
                <p className="rounded-md border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-gradient-to-br from-[hsl(20, 100%, 55%)] to-[hsl(14,90%,42%)] text-white font-semibold shadow-lg shadow-[hsl(20, 100%, 55%)]/20 hover:brightness-110"
              >
                {loading ? "Enviando código..." : "Receber código por e-mail"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-white/70">
              Já tem conta?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-[hsl(20,100%,60%)] hover:text-[hsl(20,100%,70%)]"
              >
                Entrar
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl text-white text-center">
              Confirme seu e-mail
            </h1>
            <p className="mt-1 text-center text-sm text-white/70">
              Enviamos um código para{" "}
              <strong className="text-white">{email}</strong>
            </p>

            <form onSubmit={handleSubmitCode} className="mt-6 space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-12 w-12 text-lg text-white" />
                    <InputOTPSlot index={1} className="h-12 w-12 text-lg text-white" />
                    <InputOTPSlot index={2} className="h-12 w-12 text-lg text-white" />
                    <InputOTPSlot index={3} className="h-12 w-12 text-lg text-white" />
                    <InputOTPSlot index={4} className="h-12 w-12 text-lg text-white" />
                    <InputOTPSlot index={5} className="h-12 w-12 text-lg text-white" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {info && !error && (
                <p className="rounded-md border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200 text-center">
                  {info}
                </p>
              )}
              {error && (
                <p className="rounded-md border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full bg-gradient-to-br from-[hsl(20, 100%, 55%)] to-[hsl(14,90%,42%)] text-white font-semibold shadow-lg shadow-[hsl(20, 100%, 55%)]/20 hover:brightness-110"
              >
                {loading ? "Finalizando..." : "Finalizar cadastro"}
              </Button>

              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                    setInfo(null);
                    try {
                      signUp?.reset?.();
                    } catch {
                      // ignore
                    }
                  }}
                  className="text-white/70 hover:text-white"
                >
                  ← Trocar e-mail
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="font-medium text-[hsl(20,100%,60%)] hover:text-[hsl(20,100%,70%)] disabled:opacity-50"
                >
                  Reenviar código
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

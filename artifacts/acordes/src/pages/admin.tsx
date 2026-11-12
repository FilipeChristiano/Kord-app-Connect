import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, LogOut, RefreshCw, Trash2, Plus, ShieldCheck } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Painel administrativo do Kordi — /admin                             */
/* Login próprio (e-mail + senha), separado da conta Clerk dos usuários. */
/* ------------------------------------------------------------------ */

interface Admin {
  id: number;
  email: string;
  name: string | null;
  role: "owner" | "admin";
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const ERRORS: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  too_many_attempts: "Muitas tentativas. Aguarde 15 minutos.",
  code_exists: "Já existe um código com esse nome.",
  code_in_use: "Este código já foi resgatado. Desative-o em vez de excluir.",
  email_exists: "Já existe um administrador com esse e-mail.",
  invalid_email: "E-mail inválido.",
  invalid_code: "Código inválido (use 3–32 letras, números, - ou _).",
  invalid_numbers: "Informe números válidos.",
  last_owner: "Precisa existir ao menos um proprietário ativo.",
  cannot_deactivate: "Você não pode desativar a si mesmo nem o último proprietário.",
  cannot_delete_self: "Você não pode excluir a si mesmo.",
  wrong_password: "Senha atual incorreta.",
  forbidden: "Sem permissão para esta ação.",
};

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, json.error ?? "error", json.message);
  }
  return json as T;
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message !== e.code ? e.message : (ERRORS[e.code] ?? "Ocorreu um erro. Tente novamente.");
  return "Ocorreu um erro. Tente novamente.";
}

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function fmtDate(v: string | number | null | undefined, unix = false): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = unix ? Number(v) * 1000 : v;
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function daysLeft(v: string): number {
  return Math.ceil((new Date(v).getTime() - Date.now()) / 86_400_000);
}

/* ----------------------------- UI helpers ----------------------------- */

const inputCls =
  "w-full px-3 py-2.5 rounded-lg bg-foreground/5 border border-foreground/10 text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary/60 text-sm";
const btnCls =
  "inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60";
const btnPrimary = `${btnCls} bg-primary text-primary-foreground hover:brightness-110`;
const btnGhost = `${btnCls} bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground`;
const btnDanger = `${btnCls} bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500`;

function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="bg-card/60 border border-foreground/10 rounded-2xl p-5 mb-5">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Badge({ tone, children }: { tone: "green" | "yellow" | "red" | "gray" | "blue"; children: ReactNode }) {
  const tones = {
    green: "bg-emerald-500/15 text-emerald-600",
    yellow: "bg-amber-500/15 text-amber-600",
    red: "bg-red-500/15 text-red-500",
    gray: "bg-foreground/10 text-foreground/60",
    blue: "bg-primary/15 text-primary",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-left text-foreground/50 text-xs uppercase tracking-wide">
            {head.map((h) => (
              <th key={h} className="px-2 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/5 text-foreground/90">{children}</tbody>
      </table>
      {!hasRows && <p className="text-foreground/50 text-sm py-6 text-center">{empty ?? "Nada por aqui ainda."}</p>}
    </div>
  );
}
const Td = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <td className={`px-2 py-2.5 align-middle ${className}`}>{children}</td>
);

function Msg({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <p className="text-red-500 text-sm mt-2">{error}</p>;
  if (ok) return <p className="text-emerald-600 text-sm mt-2">{ok}</p>;
  return null;
}

/* ------------------------------- Login -------------------------------- */

function Login({ onDone }: { onDone: (a: Admin) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ admin: Admin }>("POST", "/login", { email, password });
      onDone(r.admin);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-card/60 border border-foreground/10 rounded-2xl p-7 shadow-2xl shadow-black/30">
        <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-5">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-1">Painel Kordi</h1>
        <p className="text-foreground/60 text-sm mb-5">Acesso restrito a administradores.</p>
        <label className="block text-xs text-foreground/60 mb-1">E-mail</label>
        <input className={`${inputCls} mb-3`} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="block text-xs text-foreground/60 mb-1">Senha</label>
        <input className={`${inputCls} mb-4`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className={`${btnPrimary} w-full py-3`} disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
        </button>
        <Msg error={error} />
      </form>
    </div>
  );
}

/* ----------------------------- Visão geral ---------------------------- */

interface Overview {
  plan: { amountCents: number; trialDays: number };
  stripe: { active: number; trialing: number; canceled: number; past_due: number };
  mrrCents: number;
  allowedBySource: Record<string, number>;
  codeRedemptions: { active: number; total: number };
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="bg-foreground/5 border border-foreground/10 rounded-xl p-4">
      <div className="text-foreground/50 text-xs uppercase tracking-wide mb-1">{label}</div>
      <div className="font-display text-2xl font-bold text-foreground">{value}</div>
      {hint && <div className="text-foreground/50 text-xs mt-1">{hint}</div>}
    </div>
  );
}

function OverviewTab() {
  const [d, setD] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Overview>("GET", "/overview").then(setD).catch((e) => setError(errMsg(e)));
  }, []);
  if (error) return <Msg error={error} />;
  if (!d) return <Loader2 className="w-5 h-5 animate-spin text-foreground/50" />;
  const manual = (d.allowedBySource.manual ?? 0) + (d.allowedBySource.stripe ?? 0);
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Assinantes ativos" value={d.stripe.active} hint={`${brl(d.plan.amountCents)}/mês cada`} />
        <Stat label="Receita mensal (MRR)" value={brl(d.mrrCents)} hint="estimativa" />
        <Stat label="Em teste grátis" value={d.stripe.trialing} hint={`${d.plan.trialDays} dias de teste`} />
        <Stat label="Inadimplentes" value={d.stripe.past_due} />
        <Stat label="Cancelados" value={d.stripe.canceled} />
        <Stat label="Acessos por código" value={d.codeRedemptions.active} hint={`${d.codeRedemptions.total} resgates no total`} />
        <Stat label="Hotmart (ativos)" value={d.allowedBySource.hotmart ?? 0} />
        <Stat label="Liberados manualmente" value={manual} />
      </div>
    </>
  );
}

/* ------------------------------ Assinantes ---------------------------- */

interface StripeSub {
  id: string;
  email: string | null;
  name: string | null;
  status: string;
  cancel_at_period_end: boolean | null;
  current_period_end: number | null;
  created: number | null;
  trial_end: string | null;
  amount_cents: number;
}
interface Allowed { email: string; source: string | null; status: string; updated_at: string }
interface Redemption { code: string; email: string; redeemed_at: string; expires_at: string; active: boolean }
interface Subscribers { stripe: StripeSub[]; allowed: Allowed[]; redemptions: Redemption[] }

const STATUS: Record<string, { label: string; tone: "green" | "yellow" | "red" | "gray" | "blue" }> = {
  active: { label: "Ativa", tone: "green" },
  trialing: { label: "Em teste", tone: "blue" },
  past_due: { label: "Em atraso", tone: "yellow" },
  unpaid: { label: "Não paga", tone: "red" },
  canceled: { label: "Cancelada", tone: "gray" },
  incomplete: { label: "Incompleta", tone: "gray" },
  incomplete_expired: { label: "Expirada", tone: "gray" },
  paused: { label: "Pausada", tone: "gray" },
};

function SubscribersTab() {
  const [d, setD] = useState<Subscribers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [grantEmail, setGrantEmail] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  const load = useCallback(() => {
    api<Subscribers>("GET", "/subscribers").then(setD).catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  async function grant(e: FormEvent) {
    e.preventDefault();
    setMsg({});
    try {
      await api("POST", "/allowed", { email: grantEmail });
      setGrantEmail("");
      setMsg({ ok: "Acesso liberado (sem prazo)." });
      load();
    } catch (err) {
      setMsg({ error: errMsg(err) });
    }
  }
  async function revoke(email: string) {
    if (!confirm(`Revogar o acesso de ${email}?`)) return;
    await api("DELETE", `/allowed/${encodeURIComponent(email)}`).catch((e) => alert(errMsg(e)));
    load();
  }

  if (error) return <Msg error={error} />;
  if (!d) return <Loader2 className="w-5 h-5 animate-spin text-foreground/50" />;
  const match = (s: string | null) => !q || (s ?? "").toLowerCase().includes(q.toLowerCase());

  return (
    <>
      <input className={`${inputCls} mb-5 max-w-sm`} placeholder="Buscar por e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />

      <Card title="Assinaturas Stripe">
        <Table head={["E-mail", "Status", "Valor", "Fim do teste", "Próx. cobrança", "Criada"]} empty="Nenhuma assinatura.">
          {d.stripe.filter((s) => match(s.email)).map((s) => {
            const st = STATUS[s.status] ?? { label: s.status, tone: "gray" as const };
            const trialEnd = s.trial_end && /^\d+$/.test(s.trial_end) ? s.trial_end : null;
            return (
              <tr key={s.id}>
                <Td>
                  <div className="font-medium">{s.email ?? "—"}</div>
                  {s.name && <div className="text-foreground/50 text-xs">{s.name}</div>}
                </Td>
                <Td>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {s.cancel_at_period_end && <div className="text-xs text-amber-600 mt-1">cancela no fim do período</div>}
                </Td>
                <Td>{brl(s.amount_cents)}</Td>
                <Td>{fmtDate(trialEnd, true)}</Td>
                <Td>{s.status === "canceled" ? "—" : fmtDate(s.current_period_end, true)}</Td>
                <Td>{fmtDate(s.created, true)}</Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card title="Acessos por código (temporários)">
        <Table head={["E-mail", "Código", "Resgatado em", "Expira em", "Situação"]} empty="Nenhum resgate.">
          {d.redemptions.filter((r) => match(r.email)).map((r) => (
            <tr key={`${r.code}-${r.email}`}>
              <Td className="font-medium">{r.email}</Td>
              <Td><Badge tone="blue">{r.code}</Badge></Td>
              <Td>{fmtDate(r.redeemed_at)}</Td>
              <Td>{fmtDate(r.expires_at)}</Td>
              <Td>{r.active ? <Badge tone="green">{daysLeft(r.expires_at)} dia(s) restantes</Badge> : <Badge tone="gray">Expirado</Badge>}</Td>
            </tr>
          ))}
        </Table>
        <p className="text-foreground/50 text-xs mt-3">Para estender ou revogar um acesso, use a aba Cupons.</p>
      </Card>

      <Card title="Hotmart e liberações manuais">
        <form onSubmit={grant} className="flex flex-wrap gap-2 mb-4">
          <input className={`${inputCls} flex-1 min-w-[220px]`} type="email" placeholder="e-mail para liberar sem prazo" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} required />
          <button className={btnPrimary}><Plus className="w-4 h-4" /> Liberar acesso</button>
        </form>
        <Msg error={msg.error} ok={msg.ok} />
        <Table head={["E-mail", "Origem", "Status", "Atualizado", ""]} empty="Nenhum registro.">
          {d.allowed.filter((a) => match(a.email)).map((a) => (
            <tr key={a.email}>
              <Td className="font-medium">{a.email}</Td>
              <Td>{a.source === "hotmart" ? "Hotmart" : a.source === "stripe" ? "Stripe" : "Manual"}</Td>
              <Td>{a.status === "active" ? <Badge tone="green">Ativo</Badge> : <Badge tone="gray">Revogado</Badge>}</Td>
              <Td>{fmtDate(a.updated_at)}</Td>
              <Td className="text-right">
                {a.status === "active" && <button className={btnDanger} onClick={() => revoke(a.email)}>Revogar</button>}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

/* -------------------------------- Cupons ------------------------------- */

interface Code {
  code: string;
  max_redemptions: number;
  duration_days: number;
  active: boolean;
  created_at: string;
  used: number;
  still_valid: number;
}

function CodeRow({ c, onChange, redemptions }: { c: Code; onChange: () => void; redemptions: Redemption[] }) {
  const [max, setMax] = useState(String(c.max_redemptions));
  const [days, setDays] = useState(String(c.duration_days));
  const [open, setOpen] = useState(false);
  const dirty = max !== String(c.max_redemptions) || days !== String(c.duration_days);

  async function patch(body: unknown) {
    await api("PATCH", `/codes/${encodeURIComponent(c.code)}`, body).catch((e) => alert(errMsg(e)));
    onChange();
  }
  async function remove() {
    if (!confirm(`Excluir o código ${c.code}?`)) return;
    await api("DELETE", `/codes/${encodeURIComponent(c.code)}`).catch((e) => alert(errMsg(e)));
    onChange();
  }
  async function extend(r: Redemption, addDays: number) {
    await api("PATCH", `/redemptions/${encodeURIComponent(r.code)}/${encodeURIComponent(r.email)}`, { addDays }).catch((e) => alert(errMsg(e)));
    onChange();
  }
  async function revoke(r: Redemption) {
    if (!confirm(`Revogar o acesso de ${r.email}?`)) return;
    await api("DELETE", `/redemptions/${encodeURIComponent(r.code)}/${encodeURIComponent(r.email)}`).catch((e) => alert(errMsg(e)));
    onChange();
  }

  return (
    <>
      <tr>
        <Td><span className="font-mono font-semibold tracking-wider">{c.code}</span></Td>
        <Td>
          <div className="flex items-center gap-1.5">
            <input className={`${inputCls} w-20`} type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} />
            <span className="text-foreground/50 text-xs whitespace-nowrap">{c.used} usados</span>
          </div>
        </Td>
        <Td>
          <div className="flex items-center gap-1.5">
            <input className={`${inputCls} w-20`} type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
            <span className="text-foreground/50 text-xs">dias</span>
          </div>
        </Td>
        <Td>{c.active ? <Badge tone="green">Ativo</Badge> : <Badge tone="gray">Desativado</Badge>}</Td>
        <Td>
          <div className="flex flex-wrap gap-1.5 justify-end">
            {dirty && <button className={btnPrimary} onClick={() => patch({ maxRedemptions: Number(max), durationDays: Number(days) })}>Salvar</button>}
            <button className={btnGhost} onClick={() => setOpen((o) => !o)}>Resgates ({c.used})</button>
            <button className={btnGhost} onClick={() => patch({ active: !c.active })}>{c.active ? "Desativar" : "Ativar"}</button>
            {c.used === 0 && <button className={btnDanger} onClick={remove} aria-label="Excluir"><Trash2 className="w-4 h-4" /></button>}
          </div>
        </Td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="px-2 pb-4">
            <div className="bg-foreground/5 rounded-xl p-3">
              <p className="text-foreground/50 text-xs mb-2">Alterar “dias” vale apenas para novos resgates. Para quem já resgatou, estenda abaixo.</p>
              <Table head={["E-mail", "Expira em", "Situação", ""]} empty="Ninguém resgatou ainda.">
                {redemptions.map((r) => (
                  <tr key={r.email}>
                    <Td className="font-medium">{r.email}</Td>
                    <Td>{fmtDate(r.expires_at)}</Td>
                    <Td>{r.active ? <Badge tone="green">{daysLeft(r.expires_at)} dia(s)</Badge> : <Badge tone="gray">Expirado</Badge>}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <button className={btnGhost} onClick={() => extend(r, 7)}>+7 dias</button>
                        <button className={btnGhost} onClick={() => extend(r, 30)}>+30 dias</button>
                        {r.active && <button className={btnDanger} onClick={() => revoke(r)}>Revogar</button>}
                      </div>
                    </Td>
                  </tr>
                ))}
              </Table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CodesTab() {
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [reds, setReds] = useState<Redemption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", maxRedemptions: "200", durationDays: "30" });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api<{ codes: Code[] }>("GET", "/codes"),
      api<Subscribers>("GET", "/subscribers"),
    ])
      .then(([c, s]) => {
        setCodes(c.codes);
        setReds(s.redemptions);
      })
      .catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api("POST", "/codes", {
        code: form.code,
        maxRedemptions: Number(form.maxRedemptions),
        durationDays: Number(form.durationDays),
      });
      setForm({ ...form, code: "" });
      load();
    } catch (err) {
      setMsg(errMsg(err));
    }
  }

  if (error) return <Msg error={error} />;
  if (!codes) return <Loader2 className="w-5 h-5 animate-spin text-foreground/50" />;

  return (
    <>
      <Card title="Novo código de acesso gratuito">
        <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Código</label>
            <input className={`${inputCls} uppercase tracking-wider`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="EX.: KORDI200" required />
          </div>
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Limite de usos</label>
            <input className={inputCls} type="number" min={1} value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Dias de acesso</label>
            <input className={inputCls} type="number" min={1} value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} required />
          </div>
          <button className={btnPrimary}><Plus className="w-4 h-4" /> Criar</button>
        </form>
        <Msg error={msg} />
      </Card>

      <Card title="Códigos">
        <Table head={["Código", "Limite de usos", "Duração", "Status", ""]} empty="Nenhum código criado.">
          {codes.map((c) => (
            <CodeRow key={c.code} c={c} onChange={load} redemptions={reds.filter((r) => r.code === c.code)} />
          ))}
        </Table>
      </Card>
    </>
  );
}

/* ---------------------------- Administradores -------------------------- */

interface AdminRow { id: number; email: string; name: string | null; role: "owner" | "admin"; active: boolean; last_login_at: string | null }

function UsersTab({ me }: { me: Admin }) {
  const [users, setUsers] = useState<AdminRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "admin" });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ users: AdminRow[] }>("GET", "/users").then((r) => setUsers(r.users)).catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api("POST", "/users", form);
      setForm({ email: "", name: "", password: "", role: "admin" });
      load();
    } catch (err) {
      setMsg(errMsg(err));
    }
  }
  async function patch(id: number, body: unknown) {
    await api("PATCH", `/users/${id}`, body).catch((e) => alert(errMsg(e)));
    load();
  }
  async function resetPassword(u: AdminRow) {
    const pw = prompt(`Nova senha para ${u.email} (mínimo 8 caracteres):`);
    if (pw) await patch(u.id, { password: pw });
  }
  async function remove(u: AdminRow) {
    if (!confirm(`Excluir o administrador ${u.email}?`)) return;
    await api("DELETE", `/users/${u.id}`).catch((e) => alert(errMsg(e)));
    load();
  }

  if (error) return <Msg error={error} />;
  if (!users) return <Loader2 className="w-5 h-5 animate-spin text-foreground/50" />;

  return (
    <>
      <Card title="Novo administrador">
        <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={inputCls} type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className={inputCls} placeholder="Nome (opcional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} type="password" autoComplete="new-password" placeholder="Senha (mín. 8 caracteres)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="admin">Administrador — acesso a tudo, exceto gerenciar admins</option>
            <option value="owner">Proprietário — acesso total, inclusive admins</option>
          </select>
          <button className={`${btnPrimary} sm:col-span-2`}><Plus className="w-4 h-4" /> Cadastrar</button>
        </form>
        <Msg error={msg} />
      </Card>

      <Card title="Administradores">
        <Table head={["Usuário", "Perfil", "Status", "Último acesso", ""]}>
          {users.map((u) => (
            <tr key={u.id}>
              <Td>
                <div className="font-medium">{u.email}{u.id === me.id && <span className="text-foreground/40 text-xs"> (você)</span>}</div>
                {u.name && <div className="text-foreground/50 text-xs">{u.name}</div>}
              </Td>
              <Td>
                <select className={`${inputCls} w-auto`} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>
                  <option value="admin">Administrador</option>
                  <option value="owner">Proprietário</option>
                </select>
              </Td>
              <Td>{u.active ? <Badge tone="green">Ativo</Badge> : <Badge tone="gray">Desativado</Badge>}</Td>
              <Td>{fmtDate(u.last_login_at)}</Td>
              <Td>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  <button className={btnGhost} onClick={() => resetPassword(u)}>Nova senha</button>
                  <button className={btnGhost} onClick={() => patch(u.id, { active: !u.active })}>{u.active ? "Desativar" : "Ativar"}</button>
                  {u.id !== me.id && <button className={btnDanger} onClick={() => remove(u)} aria-label="Excluir"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

/* ---------------------------- Minha senha ------------------------------ */

function PasswordTab() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg({});
    try {
      await api("POST", "/me/password", { currentPassword: cur, newPassword: next });
      setCur("");
      setNext("");
      setMsg({ ok: "Senha alterada." });
    } catch (err) {
      setMsg({ error: errMsg(err) });
    }
  }
  return (
    <Card title="Alterar minha senha">
      <form onSubmit={submit} className="max-w-sm space-y-3">
        <input className={inputCls} type="password" autoComplete="current-password" placeholder="Senha atual" value={cur} onChange={(e) => setCur(e.target.value)} required />
        <input className={inputCls} type="password" autoComplete="new-password" placeholder="Nova senha (mín. 8 caracteres)" value={next} onChange={(e) => setNext(e.target.value)} required />
        <button className={btnPrimary}>Salvar senha</button>
        <Msg error={msg.error} ok={msg.ok} />
      </form>
    </Card>
  );
}

/* -------------------------------- Página ------------------------------- */

type Tab = "overview" | "subscribers" | "codes" | "users" | "password";

export default function AdminPage() {
  const [admin, setAdmin] = useState<Admin | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    document.title = "Painel Kordi";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    api<{ admin: Admin }>("GET", "/me")
      .then((r) => setAdmin(r.admin))
      .catch(() => setAdmin(null));
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  async function logout() {
    await api("POST", "/logout").catch(() => {});
    setAdmin(null);
  }

  if (admin === undefined) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-foreground/50" />
      </div>
    );
  }
  if (!admin) return <Login onDone={setAdmin} />;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Visão geral" },
    { id: "subscribers", label: "Assinantes" },
    { id: "codes", label: "Cupons" },
    ...(admin.role === "owner" ? [{ id: "users" as Tab, label: "Administradores" }] : []),
    { id: "password", label: "Minha senha" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-foreground/10 bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-display font-bold text-lg">
            <ShieldCheck className="w-5 h-5 text-primary" /> Painel Kordi
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-foreground/60 text-sm">{admin.email}</span>
            <button className={btnGhost} onClick={() => setRefreshKey((k) => k + 1)} aria-label="Atualizar"><RefreshCw className="w-4 h-4" /></button>
            <button className={btnGhost} onClick={logout}><LogOut className="w-4 h-4" /> Sair</button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-foreground/60 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6" key={`${tab}-${refreshKey}`}>
        {tab === "overview" && <OverviewTab />}
        {tab === "subscribers" && <SubscribersTab />}
        {tab === "codes" && <CodesTab />}
        {tab === "users" && admin.role === "owner" && <UsersTab me={admin} />}
        {tab === "password" && <PasswordTab />}
      </main>
    </div>
  );
}

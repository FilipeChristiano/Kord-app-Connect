import { Router, type IRouter, type Request, type Response } from "express";
import {
  pool,
  ensureAccessCodeTables,
  ensureAllowedEmailsTable,
  upsertAllowedEmail,
  revokeAllowedEmail,
} from "../db";
import {
  ensureAdminTables,
  ensureBootstrapAdmin,
  hashPassword,
  verifyPassword,
  validatePassword,
  createSession,
  destroySession,
  getSessionToken,
  setSessionCookie,
  clearSessionCookie,
  requireAdmin,
  requireOwner,
  loginBlocked,
  registerLoginFailure,
  clearLoginFailures,
  type AdminUser,
} from "../adminAuth";
import { MONTHLY_AMOUNT_CENTS, TRIAL_DAYS } from "../plan";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^[A-Z0-9_-]{3,32}$/;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function posInt(v: unknown, max = 100000): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= max ? n : null;
}
function me(res: Response): AdminUser {
  return res.locals.admin as AdminUser;
}
function clientKey(req: Request, email: string): string {
  return `${req.ip ?? "?"}|${email}`;
}
function handler(
  fn: (req: Request, res: Response) => Promise<unknown>,
): (req: Request, res: Response) => void {
  return (req, res) => {
    fn(req, res).catch((err) => {
      console.error(`[admin] ${req.method} ${req.path}:`, err);
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
    });
  };
}

// ======================= sessão =======================

router.post(
  "/admin/login",
  handler(async (req, res) => {
    const email = str(req.body?.email).toLowerCase();
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) {
      return res.status(400).json({ error: "missing_credentials" });
    }

    const key = clientKey(req, email);
    if (loginBlocked(key)) {
      return res.status(429).json({ error: "too_many_attempts" });
    }

    await ensureBootstrapAdmin();
    const { rows } = await pool.query<
      AdminUser & { password_hash: string }
    >(
      `SELECT id, email, name, role, active, password_hash
         FROM admin_users WHERE email = $1`,
      [email],
    );
    const user = rows[0];
    // Compara sempre (mesmo sem usuário) para não vazar quais e-mails existem
    const ok = user
      ? await verifyPassword(password, user.password_hash)
      : (await verifyPassword(password, "scrypt$00$00"), false);

    if (!user || !user.active || !ok) {
      registerLoginFailure(key);
      return res.status(401).json({ error: "invalid_credentials" });
    }

    clearLoginFailures(key);
    const token = await createSession(user.id);
    await pool.query("UPDATE admin_users SET last_login_at = NOW() WHERE id = $1", [
      user.id,
    ]);
    setSessionCookie(req, res, token);
    return res.json({
      admin: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  }),
);

router.post(
  "/admin/logout",
  handler(async (req, res) => {
    const token = getSessionToken(req);
    if (token) {
      await ensureAdminTables();
      await destroySession(token);
    }
    clearSessionCookie(res);
    return res.json({ ok: true });
  }),
);

router.get("/admin/me", requireAdmin, (_req, res) => {
  const a = me(res);
  res.json({ admin: { id: a.id, email: a.email, name: a.name, role: a.role } });
});

router.post(
  "/admin/me/password",
  requireAdmin,
  handler(async (req, res) => {
    const current = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const next = req.body?.newPassword;
    const err = validatePassword(next);
    if (err) return res.status(400).json({ error: "weak_password", message: err });

    const { rows } = await pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM admin_users WHERE id = $1",
      [me(res).id],
    );
    if (!rows[0] || !(await verifyPassword(current, rows[0].password_hash))) {
      return res.status(403).json({ error: "wrong_password" });
    }
    await pool.query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [
      await hashPassword(next as string),
      me(res).id,
    ]);
    // Encerra as demais sessões deste usuário, mantendo a atual
    const token = getSessionToken(req);
    if (token) {
      const { createHash } = await import("node:crypto");
      await pool.query(
        "DELETE FROM admin_sessions WHERE admin_id = $1 AND token_hash <> $2",
        [me(res).id, createHash("sha256").update(token).digest("hex")],
      );
    }
    return res.json({ ok: true });
  }),
);

// Tudo abaixo exige sessão de admin
router.use("/admin", requireAdmin);

// ======================= visão geral =======================

router.get(
  "/admin/overview",
  handler(async (_req, res) => {
    await ensureAccessCodeTables();
    await ensureAllowedEmailsTable();

    let stripeCounts = { active: 0, trialing: 0, canceled: 0, past_due: 0 };
    try {
      const { rows } = await pool.query<{ status: string; n: string }>(
        `SELECT status::text AS status, COUNT(*) AS n
           FROM stripe.subscriptions GROUP BY status`,
      );
      for (const r of rows) {
        if (r.status === "active") stripeCounts.active = Number(r.n);
        else if (r.status === "trialing") stripeCounts.trialing = Number(r.n);
        else if (r.status === "canceled") stripeCounts.canceled = Number(r.n);
        else if (r.status === "past_due" || r.status === "unpaid")
          stripeCounts.past_due += Number(r.n);
      }
    } catch {
      /* schema stripe ainda não migrado */
    }

    const allowed = await pool.query<{ source: string; n: string }>(
      `SELECT COALESCE(source, 'manual') AS source, COUNT(*) AS n
         FROM allowed_emails WHERE status = 'active' GROUP BY 1`,
    );
    const codes = await pool.query<{ active: string; used: string }>(
      `SELECT
         (SELECT COUNT(*) FROM access_code_redemptions WHERE expires_at > NOW()) AS active,
         (SELECT COUNT(*) FROM access_code_redemptions) AS used`,
    );

    return res.json({
      plan: { amountCents: MONTHLY_AMOUNT_CENTS, trialDays: TRIAL_DAYS },
      stripe: stripeCounts,
      mrrCents: stripeCounts.active * MONTHLY_AMOUNT_CENTS,
      allowedBySource: Object.fromEntries(
        allowed.rows.map((r) => [r.source, Number(r.n)]),
      ),
      codeRedemptions: {
        active: Number(codes.rows[0]!.active),
        total: Number(codes.rows[0]!.used),
      },
    });
  }),
);

// ======================= assinantes =======================

router.get(
  "/admin/subscribers",
  handler(async (_req, res) => {
    await ensureAccessCodeTables();
    await ensureAllowedEmailsTable();

    let stripeRows: unknown[] = [];
    try {
      const { rows } = await pool.query(
        `SELECT s.id,
                c.email,
                c.name,
                s.status::text AS status,
                s.cancel_at_period_end,
                s.current_period_end,
                s.created,
                s.trial_end::text AS trial_end,
                COALESCE((s.items->'data'->0->'price'->>'unit_amount')::int, $1) AS amount_cents
           FROM stripe.subscriptions s
           LEFT JOIN stripe.customers c ON c.id = s.customer
          ORDER BY s.created DESC NULLS LAST
          LIMIT 1000`,
        [MONTHLY_AMOUNT_CENTS],
      );
      stripeRows = rows;
    } catch (err) {
      console.error("[admin] stripe subscribers query failed:", err);
    }

    const allowed = await pool.query(
      `SELECT email, source, status, updated_at
         FROM allowed_emails ORDER BY updated_at DESC LIMIT 1000`,
    );
    const redemptions = await pool.query(
      `SELECT code, email, redeemed_at, expires_at,
              (expires_at > NOW()) AS active
         FROM access_code_redemptions ORDER BY redeemed_at DESC LIMIT 1000`,
    );

    return res.json({
      stripe: stripeRows,
      allowed: allowed.rows,
      redemptions: redemptions.rows,
    });
  }),
);

// Liberação manual (sem prazo) / revogação por e-mail
router.post(
  "/admin/allowed",
  handler(async (req, res) => {
    const email = str(req.body?.email).toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "invalid_email" });
    await upsertAllowedEmail({ email, source: "manual", status: "active" });
    return res.json({ ok: true });
  }),
);

router.delete(
  "/admin/allowed/:email",
  handler(async (req, res) => {
    await revokeAllowedEmail(String(req.params.email));
    return res.json({ ok: true });
  }),
);

// ======================= cupons / códigos =======================

router.get(
  "/admin/codes",
  handler(async (_req, res) => {
    await ensureAccessCodeTables();
    const { rows } = await pool.query(
      `SELECT c.code, c.max_redemptions, c.duration_days, c.active, c.created_at,
              COUNT(r.email)::int AS used,
              COUNT(r.email) FILTER (WHERE r.expires_at > NOW())::int AS still_valid
         FROM access_codes c
         LEFT JOIN access_code_redemptions r ON r.code = c.code
        GROUP BY c.code
        ORDER BY c.created_at DESC`,
    );
    return res.json({ codes: rows });
  }),
);

router.post(
  "/admin/codes",
  handler(async (req, res) => {
    await ensureAccessCodeTables();
    const code = str(req.body?.code).toUpperCase();
    const max = posInt(req.body?.maxRedemptions);
    const days = posInt(req.body?.durationDays, 3650);
    if (!CODE_RE.test(code))
      return res.status(400).json({
        error: "invalid_code",
        message: "Use 3 a 32 caracteres: letras, números, - ou _.",
      });
    if (!max || !days) return res.status(400).json({ error: "invalid_numbers" });

    const ins = await pool.query(
      `INSERT INTO access_codes (code, max_redemptions, duration_days)
       VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING RETURNING code`,
      [code, max, days],
    );
    if (ins.rowCount === 0) return res.status(409).json({ error: "code_exists" });
    return res.json({ ok: true });
  }),
);

router.patch(
  "/admin/codes/:code",
  handler(async (req, res) => {
    await ensureAccessCodeTables();
    const code = String(req.params.code).toUpperCase();
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (req.body?.maxRedemptions !== undefined) {
      const n = posInt(req.body.maxRedemptions);
      if (!n) return res.status(400).json({ error: "invalid_numbers" });
      vals.push(n);
      sets.push(`max_redemptions = $${vals.length}`);
    }
    if (req.body?.durationDays !== undefined) {
      const n = posInt(req.body.durationDays, 3650);
      if (!n) return res.status(400).json({ error: "invalid_numbers" });
      vals.push(n);
      sets.push(`duration_days = $${vals.length}`);
    }
    if (typeof req.body?.active === "boolean") {
      vals.push(req.body.active);
      sets.push(`active = $${vals.length}`);
    }
    if (sets.length === 0) return res.status(400).json({ error: "nothing_to_update" });
    vals.push(code);
    const r = await pool.query(
      `UPDATE access_codes SET ${sets.join(", ")} WHERE code = $${vals.length}`,
      vals,
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true });
  }),
);

router.delete(
  "/admin/codes/:code",
  handler(async (req, res) => {
    await ensureAccessCodeTables();
    const code = String(req.params.code).toUpperCase();
    const used = await pool.query(
      "SELECT 1 FROM access_code_redemptions WHERE code = $1 LIMIT 1",
      [code],
    );
    if (used.rows.length > 0) {
      return res.status(409).json({
        error: "code_in_use",
        message: "Este código já foi resgatado. Desative-o em vez de excluir.",
      });
    }
    await pool.query("DELETE FROM access_codes WHERE code = $1", [code]);
    return res.json({ ok: true });
  }),
);

// Ajusta o prazo de um resgate (estende, encurta ou revoga)
router.patch(
  "/admin/redemptions/:code/:email",
  handler(async (req, res) => {
    await ensureAccessCodeTables();
    const days = Number(req.body?.addDays);
    if (!Number.isInteger(days) || days === 0 || Math.abs(days) > 3650) {
      return res.status(400).json({ error: "invalid_days" });
    }
    const r = await pool.query(
      `UPDATE access_code_redemptions
          SET expires_at = GREATEST(expires_at, NOW()) + make_interval(days => $3)
        WHERE code = $1 AND email = $2`,
      [String(req.params.code).toUpperCase(), String(req.params.email).toLowerCase(), days],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true });
  }),
);

// Revoga o acesso (expira agora; mantém o registro e a contagem de uso)
router.delete(
  "/admin/redemptions/:code/:email",
  handler(async (req, res) => {
    await ensureAccessCodeTables();
    await pool.query(
      `UPDATE access_code_redemptions SET expires_at = NOW()
        WHERE code = $1 AND email = $2`,
      [String(req.params.code).toUpperCase(), String(req.params.email).toLowerCase()],
    );
    return res.json({ ok: true });
  }),
);

// ======================= usuários admin (somente owner) =======================

router.get(
  "/admin/users",
  requireOwner,
  handler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, active, created_at, last_login_at
         FROM admin_users ORDER BY created_at`,
    );
    return res.json({ users: rows });
  }),
);

router.post(
  "/admin/users",
  requireOwner,
  handler(async (req, res) => {
    const email = str(req.body?.email).toLowerCase();
    const name = str(req.body?.name) || null;
    const role = req.body?.role === "owner" ? "owner" : "admin";
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "invalid_email" });
    const pwErr = validatePassword(req.body?.password);
    if (pwErr) return res.status(400).json({ error: "weak_password", message: pwErr });

    const ins = await pool.query(
      `INSERT INTO admin_users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id`,
      [email, name, await hashPassword(req.body.password as string), role],
    );
    if (ins.rowCount === 0) return res.status(409).json({ error: "email_exists" });
    return res.json({ ok: true });
  }),
);

async function otherActiveOwners(excludeId: number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    "SELECT COUNT(*) AS n FROM admin_users WHERE role = 'owner' AND active = TRUE AND id <> $1",
    [excludeId],
  );
  return Number(rows[0]!.n);
}

router.patch(
  "/admin/users/:id",
  requireOwner,
  handler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });

    const target = await pool.query<AdminUser>(
      "SELECT id, role, active FROM admin_users WHERE id = $1",
      [id],
    );
    if (!target.rows[0]) return res.status(404).json({ error: "not_found" });

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (typeof req.body?.name === "string") {
      vals.push(str(req.body.name) || null);
      sets.push(`name = $${vals.length}`);
    }
    if (req.body?.role === "owner" || req.body?.role === "admin") {
      if (
        req.body.role === "admin" &&
        target.rows[0].role === "owner" &&
        (await otherActiveOwners(id)) === 0
      ) {
        return res.status(409).json({ error: "last_owner" });
      }
      vals.push(req.body.role);
      sets.push(`role = $${vals.length}`);
    }
    if (typeof req.body?.active === "boolean") {
      if (
        req.body.active === false &&
        (id === me(res).id ||
          (target.rows[0].role === "owner" && (await otherActiveOwners(id)) === 0))
      ) {
        return res.status(409).json({ error: "cannot_deactivate" });
      }
      vals.push(req.body.active);
      sets.push(`active = $${vals.length}`);
    }
    if (req.body?.password !== undefined) {
      const pwErr = validatePassword(req.body.password);
      if (pwErr) return res.status(400).json({ error: "weak_password", message: pwErr });
      vals.push(await hashPassword(req.body.password as string));
      sets.push(`password_hash = $${vals.length}`);
    }
    if (sets.length === 0) return res.status(400).json({ error: "nothing_to_update" });

    vals.push(id);
    await pool.query(
      `UPDATE admin_users SET ${sets.join(", ")} WHERE id = $${vals.length}`,
      vals,
    );
    // Desativação ou troca de senha derrubam as sessões abertas desse usuário
    if (req.body?.active === false || req.body?.password !== undefined) {
      await pool.query("DELETE FROM admin_sessions WHERE admin_id = $1", [id]);
    }
    return res.json({ ok: true });
  }),
);

router.delete(
  "/admin/users/:id",
  requireOwner,
  handler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
    if (id === me(res).id) return res.status(409).json({ error: "cannot_delete_self" });

    const target = await pool.query<{ role: string }>(
      "SELECT role FROM admin_users WHERE id = $1",
      [id],
    );
    if (!target.rows[0]) return res.status(404).json({ error: "not_found" });
    if (target.rows[0].role === "owner" && (await otherActiveOwners(id)) === 0) {
      return res.status(409).json({ error: "last_owner" });
    }
    await pool.query("DELETE FROM admin_users WHERE id = $1", [id]);
    return res.json({ ok: true });
  }),
);

export default router;

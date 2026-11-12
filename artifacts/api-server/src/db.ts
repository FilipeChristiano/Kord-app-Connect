import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface AccessInfo {
  allowed: boolean;
  source: "stripe" | "hotmart" | "manual" | "code" | null;
}

let accessCodeTablesReady: Promise<void> | null = null;

export function ensureAccessCodeTables(): Promise<void> {
  if (!accessCodeTablesReady) {
    accessCodeTablesReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS access_codes (
           code TEXT PRIMARY KEY,
           max_redemptions INTEGER NOT NULL,
           duration_days INTEGER NOT NULL,
           active BOOLEAN NOT NULL DEFAULT TRUE,
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );
         CREATE TABLE IF NOT EXISTS access_code_redemptions (
           code TEXT NOT NULL REFERENCES access_codes(code),
           email TEXT NOT NULL,
           redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           expires_at TIMESTAMPTZ NOT NULL,
           PRIMARY KEY (code, email)
         );`,
      )
      .then(() => undefined)
      .catch((err) => {
        accessCodeTablesReady = null;
        throw err;
      });
  }
  return accessCodeTablesReady;
}

export type RedeemResult =
  | { ok: true; expiresAt: Date }
  | { ok: false; reason: "invalid_code" | "code_exhausted" | "already_redeemed" };

/**
 * Resgata um código de acesso temporário para o e-mail. Atômico: trava a
 * linha do código (FOR UPDATE) para o limite de resgates nunca estourar.
 */
export async function redeemAccessCode(
  rawCode: string,
  email: string,
): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase();
  const normalized = email.trim().toLowerCase();
  await ensureAccessCodeTables();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      max_redemptions: number;
      duration_days: number;
    }>(
      "SELECT max_redemptions, duration_days FROM access_codes WHERE code = $1 AND active = TRUE FOR UPDATE",
      [code],
    );
    const row = rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_code" };
    }

    const existing = await client.query(
      "SELECT 1 FROM access_code_redemptions WHERE code = $1 AND email = $2",
      [code, normalized],
    );
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "already_redeemed" };
    }

    const used = await client.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM access_code_redemptions WHERE code = $1",
      [code],
    );
    if (Number(used.rows[0]!.n) >= row.max_redemptions) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "code_exhausted" };
    }

    const ins = await client.query<{ expires_at: Date }>(
      `INSERT INTO access_code_redemptions (code, email, expires_at)
       VALUES ($1, $2, NOW() + make_interval(days => $3))
       RETURNING expires_at`,
      [code, normalized, row.duration_days],
    );
    await client.query("COMMIT");
    return { ok: true, expiresAt: ins.rows[0]!.expires_at };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function createAccessCode(params: {
  code: string;
  maxRedemptions: number;
  durationDays: number;
}): Promise<void> {
  await ensureAccessCodeTables();
  await pool.query(
    `INSERT INTO access_codes (code, max_redemptions, duration_days)
     VALUES ($1, $2, $3)
     ON CONFLICT (code) DO UPDATE SET
       max_redemptions = EXCLUDED.max_redemptions,
       duration_days = EXCLUDED.duration_days,
       active = TRUE`,
    [params.code.trim().toUpperCase(), params.maxRedemptions, params.durationDays],
  );
}

// A tabela não existe no schema do Drizzle (ainda não migrado) — criada aqui
// sob demanda, mesmo padrão usado para `welcome_emails` em email.ts.
let allowedEmailsTableReady: Promise<void> | null = null;

export function ensureAllowedEmailsTable(): Promise<void> {
  if (!allowedEmailsTableReady) {
    allowedEmailsTableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS allowed_emails (
           email TEXT PRIMARY KEY,
           source TEXT,
           transaction_id TEXT,
           product_id TEXT,
           status TEXT NOT NULL,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`,
      )
      .then(() => undefined)
      .catch((err) => {
        allowedEmailsTableReady = null;
        throw err;
      });
  }
  return allowedEmailsTableReady;
}

/**
 * Acesso liberado se:
 *  1. existe assinatura Stripe ativa (ou em trial) para o e-mail — os dados
 *     ficam no schema `stripe`, sincronizado automaticamente por webhooks; OU
 *  2. o e-mail consta como ativo em allowed_emails (compradores Hotmart
 *     antigos ou liberações manuais). Eventos da Stripe NUNCA mexem nessa
 *     tabela, então acessos Hotmart não são revogados por engano.
 */
export async function getAccessInfo(email: string): Promise<AccessInfo> {
  const normalized = email.trim().toLowerCase();

  // Acesso temporário por código promocional (ver redeemAccessCode)
  try {
    await ensureAccessCodeTables();
    const { rows } = await pool.query(
      `SELECT 1 FROM access_code_redemptions
        WHERE email = $1 AND expires_at > NOW()
        LIMIT 1`,
      [normalized],
    );
    if (rows.length > 0) return { allowed: true, source: "code" };
  } catch (err) {
    console.error("[access] access code check failed:", err);
  }

  try {
    const { rows } = await pool.query(
      `SELECT 1
         FROM stripe.subscriptions s
         JOIN stripe.customers c ON c.id = s.customer
        WHERE lower(c.email) = $1
          AND s.status IN ('active', 'trialing')
        LIMIT 1`,
      [normalized],
    );
    if (rows.length > 0) {
      return { allowed: true, source: "stripe" };
    }
  } catch (err) {
    // Schema stripe ainda não migrado (primeira subida) — segue para a
    // checagem legada em vez de derrubar o /api/me inteiro.
    console.error("[access] stripe subscription check failed:", err);
  }

  await ensureAllowedEmailsTable();
  const { rows } = await pool.query<{ status: string; source: string }>(
    "SELECT status, source FROM allowed_emails WHERE email = $1",
    [normalized],
  );
  if (rows.length > 0 && rows[0]!.status === "active") {
    const src = rows[0]!.source;
    return {
      allowed: true,
      source: src === "hotmart" ? "hotmart" : src === "stripe" ? "stripe" : "manual",
    };
  }

  return { allowed: false, source: null };
}

export async function isEmailAllowed(email: string): Promise<boolean> {
  return (await getAccessInfo(email)).allowed;
}

export async function upsertAllowedEmail(params: {
  email: string;
  source: string;
  transactionId?: string;
  productId?: string;
  status: "active" | "revoked";
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  await ensureAllowedEmailsTable();
  await pool.query(
    `INSERT INTO allowed_emails (email, source, transaction_id, product_id, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (email) DO UPDATE SET
       source = EXCLUDED.source,
       transaction_id = EXCLUDED.transaction_id,
       product_id = EXCLUDED.product_id,
       status = EXCLUDED.status,
       updated_at = NOW()`,
    [email, params.source, params.transactionId ?? null, params.productId ?? null, params.status],
  );
}

export async function revokeAllowedEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await ensureAllowedEmailsTable();
  await pool.query(
    "UPDATE allowed_emails SET status = 'revoked', updated_at = NOW() WHERE email = $1",
    [normalized],
  );
}

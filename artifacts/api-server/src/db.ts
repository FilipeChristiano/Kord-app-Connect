import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface AccessInfo {
  allowed: boolean;
  source: "stripe" | "hotmart" | "manual" | null;
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
  await pool.query(
    "UPDATE allowed_emails SET status = 'revoked', updated_at = NOW() WHERE email = $1",
    [normalized],
  );
}

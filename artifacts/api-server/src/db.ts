import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function isEmailAllowed(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const { rows } = await pool.query<{ status: string }>(
    "SELECT status FROM allowed_emails WHERE email = $1",
    [normalized],
  );
  return rows.length > 0 && rows[0]!.status === "active";
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

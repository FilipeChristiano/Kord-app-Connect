/**
 * Cria (ou atualiza) um código de acesso gratuito temporário.
 *
 * Uso (DATABASE_URL precisa apontar para o banco de PRODUÇÃO):
 *   cd artifacts/api-server
 *   npx tsx scripts/create-access-code.ts <CODIGO> <MAX_USOS> <DIAS_DE_ACESSO>
 *   ex.: npx tsx scripts/create-access-code.ts KORDI200 200 30
 */
import { createAccessCode, pool } from "../src/db";

const [code, max, days] = process.argv.slice(2);
if (!code || !Number(max) || !Number(days)) {
  console.error("Uso: create-access-code.ts <CODIGO> <MAX_USOS> <DIAS_DE_ACESSO>");
  process.exit(1);
}

await createAccessCode({
  code,
  maxRedemptions: Number(max),
  durationDays: Number(days),
});
console.log(
  `Código ${code.toUpperCase()} criado: ${max} usos, ${days} dias de acesso.`,
);
await pool.end();

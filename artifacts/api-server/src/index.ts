import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { ensurePlan } from "./plan";
import app from "./app";

/**
 * Inicializa a Stripe no startup:
 * 1. migrações criam o schema `stripe` (idempotente)
 * 2. webhook gerenciado é registrado na Stripe
 * 3. backfill sincroniza dados existentes (em segundo plano)
 */
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Stripe integration");
  }

  try {
    console.log("[stripe] running migrations...");
    await runMigrations({ databaseUrl });

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const webhookResult = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
    );
    console.log(
      "[stripe] webhook configured:",
      JSON.stringify(webhookResult?.url || "setup complete"),
    );

    // Garante que o produto/preço da assinatura existem na conta conectada
    // (idempotente — em produção cria o plano na conta live no 1º start)
    await ensurePlan();

    stripeSync
      .syncBackfill({ object: "all" })
      .then(() => console.log("[stripe] data synced"))
      .catch((err) => console.error("[stripe] backfill error:", err));
  } catch (error) {
    console.error("[stripe] failed to initialize:", error);
    throw error;
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Sem await no topo do arquivo: o build de produção empacota em CommonJS,
// que não suporta top-level await — usamos uma função assíncrona de partida.
initStripe()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((error) => {
    // Em desenvolvimento, a conexão da Stripe (sandbox) pode estar ausente ou
    // expirada — não derruba o servidor inteiro por isso: as demais rotas
    // (acesso via banco, transcrição, etc.) continuam funcionando e as rotas
    // da Stripe reportam o próprio erro. Em produção o start continua estrito.
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[startup] Stripe indisponível em desenvolvimento — servidor segue sem ela:",
        error instanceof Error ? error.message : error,
      );
      app.listen(port, () => {
        console.log(`Server listening on port ${port} (sem Stripe)`);
      });
      return;
    }
    console.error("[startup] failed to start server:", error);
    process.exit(1);
  });

import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
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

await initStripe();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

import { getUncachableStripeClient } from "./stripeClient";

/**
 * Cria o produto e o preço da assinatura mensal do Kordi na Stripe.
 *
 * Idempotente: se o produto já existir, não cria de novo.
 * Rodar com: pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */
const PRODUCT_NAME = "Kordi — Assinatura Mensal";
const MONTHLY_AMOUNT_CENTS = 2990; // R$ 29,90

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log("Verificando produto existente...");
    const existing = await stripe.products.search({
      query: `name:'${PRODUCT_NAME}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      const product = existing.data[0]!;
      console.log(`Produto já existe: ${product.id}`);
      const prices = await stripe.prices.list({ product: product.id, active: true });
      const monthly = prices.data.find((p) => p.recurring?.interval === "month");
      if (monthly) {
        console.log(`Preço mensal já existe: ${monthly.id} (${monthly.unit_amount} ${monthly.currency})`);
        return;
      }
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: MONTHLY_AMOUNT_CENTS,
        currency: "brl",
        recurring: { interval: "month" },
      });
      console.log(`Preço mensal criado: ${price.id}`);
      return;
    }

    const product = await stripe.products.create({
      name: PRODUCT_NAME,
      description:
        "Acesso completo ao Kordi: dicionário de acordes, cifras inteligentes, sofisticador, audio lab, metrônomo, pads e modo estudo.",
      metadata: { app: "kordi" },
    });
    console.log(`Produto criado: ${product.id}`);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: MONTHLY_AMOUNT_CENTS,
      currency: "brl",
      recurring: { interval: "month" },
    });
    console.log(`Preço mensal criado: R$ 29,90/mês (${price.id})`);

    console.log("Pronto! Os webhooks sincronizam esses dados para o banco automaticamente.");
  } catch (error) {
    console.error("Erro ao criar produtos:", (error as Error).message);
    process.exit(1);
  }
}

createProducts();

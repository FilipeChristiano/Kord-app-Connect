import { getUncachableStripeClient } from "./stripeClient";

/**
 * Utilitário manual: garante o produto e o preço da assinatura mensal do
 * Kordi na Stripe, com a MESMA reconciliação do servidor
 * (artifacts/api-server/src/plan.ts) — que já roda automaticamente no
 * startup. Mantenha os valores abaixo em sincronia com plan.ts.
 *
 * Rodar com: pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */
const PRODUCT_NAME = "Kordi — Assinatura Mensal";
const MONTHLY_AMOUNT_CENTS = 4990; // R$ 49,90
const CURRENCY = "brl";

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log("Verificando produto existente...");
    const existing = await stripe.products.search({
      query: `name:'${PRODUCT_NAME}' AND active:'true'`,
    });

    let productId: string;
    if (existing.data.length > 0) {
      const sorted = [...existing.data].sort((a, b) => {
        const aKordi = a.metadata?.app === "kordi" ? 0 : 1;
        const bKordi = b.metadata?.app === "kordi" ? 0 : 1;
        if (aKordi !== bKordi) return aKordi - bKordi;
        return a.created - b.created;
      });
      productId = sorted[0]!.id;
      console.log(`Produto já existe: ${productId}`);
    } else {
      const product = await stripe.products.create({
        name: PRODUCT_NAME,
        description:
          "Acesso completo ao Kordi: dicionário de acordes, cifras inteligentes, sofisticador, audio lab, metrônomo, pads e modo estudo.",
        metadata: { app: "kordi" },
      });
      productId = product.id;
      console.log(`Produto criado: ${productId}`);
    }

    const allPrices = [];
    for await (const price of stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
    })) {
      allPrices.push(price);
    }
    const monthly = allPrices.filter(
      (p) => p.recurring?.interval === "month" && p.currency === CURRENCY,
    );

    const correct = monthly.find((p) => p.unit_amount === MONTHLY_AMOUNT_CENTS);
    if (correct) {
      console.log(`Preço mensal correto já existe: ${correct.id} (${correct.unit_amount} ${CURRENCY})`);
    } else {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: MONTHLY_AMOUNT_CENTS,
        currency: CURRENCY,
        recurring: { interval: "month" },
      });
      console.log(`Preço mensal criado: R$ 49,90/mês (${price.id})`);
    }

    for (const p of monthly) {
      if (p.unit_amount !== MONTHLY_AMOUNT_CENTS) {
        await stripe.prices.update(p.id, { active: false });
        console.log(`Preço antigo desativado: ${p.id} (${p.unit_amount})`);
      }
    }

    console.log("Pronto! Os webhooks sincronizam esses dados para o banco automaticamente.");
  } catch (error) {
    console.error("Erro ao criar produtos:", (error as Error).message);
    process.exit(1);
  }
}

createProducts();

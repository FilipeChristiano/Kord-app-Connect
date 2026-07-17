import { getUncachableStripeClient } from "./stripeClient";

/**
 * Definição do plano de assinatura do Kordi — fonte única de verdade.
 * O servidor garante na inicialização que o produto e o preço existem na
 * conta Stripe conectada (dev: sandbox; produção: conta live), então a
 * publicação não exige nenhum passo manual na Stripe.
 */
export const PRODUCT_NAME = "Kordi — Assinatura Mensal";
export const MONTHLY_AMOUNT_CENTS = 3990; // R$ 39,90
export const TRIAL_DAYS = 7; // primeiros 7 dias grátis
const CURRENCY = "brl";
const PRODUCT_DESCRIPTION =
  "Acesso completo ao Kordi: dicionário de acordes, cifras inteligentes, sofisticador, audio lab, metrônomo, pads e modo estudo.";

/**
 * Idempotente:
 * - cria o produto se não existir;
 * - cria o preço mensal se não existir;
 * - se o preço mensal ativo tiver valor diferente do configurado, cria um
 *   novo preço com o valor certo e desativa o antigo (assinaturas já
 *   existentes continuam no preço antigo — comportamento padrão da Stripe).
 */
export async function ensurePlan(): Promise<void> {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.products.search({
    query: `name:'${PRODUCT_NAME}' AND active:'true'`,
  });

  let productId: string;
  if (existing.data.length > 0) {
    // Seleção determinística: prefere o produto com metadata.app === "kordi";
    // entre candidatos iguais, usa o mais antigo (menor `created`).
    const sorted = [...existing.data].sort((a, b) => {
      const aKordi = a.metadata?.app === "kordi" ? 0 : 1;
      const bKordi = b.metadata?.app === "kordi" ? 0 : 1;
      if (aKordi !== bKordi) return aKordi - bKordi;
      return a.created - b.created;
    });
    productId = sorted[0]!.id;
    if (existing.data.length > 1) {
      console.warn(
        `[stripe] atenção: ${existing.data.length} produtos ativos com o nome "${PRODUCT_NAME}"; usando ${productId}`,
      );
    }
  } else {
    const product = await stripe.products.create({
      name: PRODUCT_NAME,
      description: PRODUCT_DESCRIPTION,
      metadata: { app: "kordi" },
    });
    productId = product.id;
    console.log(`[stripe] produto criado: ${productId}`);
  }

  // Varre TODAS as páginas de preços ativos do produto (auto-paginação)
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
  if (!correct) {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: MONTHLY_AMOUNT_CENTS,
      currency: CURRENCY,
      recurring: { interval: "month" },
    });
    console.log(
      `[stripe] preço mensal criado: ${price.id} (${MONTHLY_AMOUNT_CENTS} ${CURRENCY})`,
    );
  }

  // Desativa preços mensais ativos com valor diferente do configurado
  for (const p of monthly) {
    if (p.unit_amount !== MONTHLY_AMOUNT_CENTS) {
      await stripe.prices.update(p.id, { active: false });
      console.log(`[stripe] preço antigo desativado: ${p.id} (${p.unit_amount})`);
    }
  }
}

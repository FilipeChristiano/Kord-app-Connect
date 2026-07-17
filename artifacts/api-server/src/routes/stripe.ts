import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { pool } from "../db";
import { getUncachableStripeClient } from "../stripeClient";
import { PRODUCT_NAME, TRIAL_DAYS } from "../plan";

const router: IRouter = Router();

/**
 * Resolve o e-mail do usuário logado (Clerk). Em desenvolvimento, aceita um
 * e-mail vindo do corpo da requisição para permitir testes sem login (a
 * prévia embutida bloqueia cookies do Clerk — mesmo padrão das outras rotas).
 */
async function resolveEmail(req: Request): Promise<string | null> {
  const auth = getAuth(req);
  if (auth?.userId) {
    const user = await clerkClient.users.getUser(auth.userId);
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    if (email) return email.trim().toLowerCase();
  }

  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    const bodyEmail = (req.body as { email?: unknown } | undefined)?.email;
    if (typeof bodyEmail === "string" && bodyEmail.includes("@")) {
      return bodyEmail.trim().toLowerCase();
    }
  }

  return null;
}

/**
 * Monta a URL base para redirecionamentos pós-checkout/portal.
 * Só aceita hosts que estejam na lista oficial de domínios do app
 * (REPLIT_DOMAINS) — nunca confia cegamente em cabeçalhos do cliente,
 * evitando redirecionamento aberto.
 */
function requestBaseUrl(req: Request): string {
  const allowedDomains = (process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  const forwardedHost =
    typeof req.headers["x-forwarded-host"] === "string"
      ? req.headers["x-forwarded-host"].split(",")[0]?.trim()
      : undefined;
  const requestHost = forwardedHost || req.headers.host || "";

  if (allowedDomains.includes(requestHost)) {
    return `https://${requestHost}`;
  }
  if (allowedDomains[0]) {
    return `https://${allowedDomains[0]}`;
  }
  // Sem REPLIT_DOMAINS (execução local): usa o host da requisição
  const proto = requestHost.includes("localhost") ? "http" : "https";
  return `${proto}://${requestHost}`;
}

async function findOrCreateCustomer(email: string) {
  const stripe = await getUncachableStripeClient();
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0]!;
  return stripe.customers.create({ email });
}

/**
 * Plano à venda: lê o produto/preço da base sincronizada (schema stripe).
 * Público — a página de venda mostra o preço antes mesmo do checkout.
 */
router.get("/stripe/plan", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id AS product_id,
              p.name,
              p.description,
              pr.id AS price_id,
              pr.unit_amount,
              pr.currency,
              pr.recurring->>'interval' AS interval
         FROM stripe.products p
         JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
          AND p.name = $1
          AND pr.recurring->>'interval' = 'month'
        ORDER BY pr.created DESC
        LIMIT 1`,
      [PRODUCT_NAME],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "plan_not_found" });
    }

    return res.json({ plan: { ...rows[0], trial_days: TRIAL_DAYS } });
  } catch (err) {
    console.error("[/api/stripe/plan] error:", err);
    return res.status(500).json({ error: "plan_lookup_failed" });
  }
});

/**
 * Cria a sessão de checkout (assinatura mensal, cartão).
 */
router.post("/stripe/checkout", async (req: Request, res: Response) => {
  try {
    // Compra pública (página de venda): sem login, a Stripe coleta o e-mail
    // no próprio checkout e o acesso é liberado quando a pessoa criar a
    // conta no Kordi com o mesmo e-mail (getAccessInfo casa por e-mail).
    const email = await resolveEmail(req);

    const { rows } = await pool.query<{ price_id: string }>(
      `SELECT pr.id AS price_id
         FROM stripe.products p
         JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
          AND p.name = $1
          AND pr.recurring->>'interval' = 'month'
        ORDER BY pr.created DESC
        LIMIT 1`,
      [PRODUCT_NAME],
    );
    const priceId = rows[0]?.price_id;
    if (!priceId) {
      return res.status(500).json({ error: "plan_not_configured" });
    }

    const stripe = await getUncachableStripeClient();
    const baseUrl = requestBaseUrl(req);

    if (!email) {
      // Comprador novo, sem conta: a Stripe coleta o e-mail no checkout.
      // Depois do pagamento, ele cria a conta com o mesmo e-mail e o
      // acesso libera sozinho.
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        subscription_data: { trial_period_days: TRIAL_DAYS },
        locale: "pt-BR",
        success_url: `${baseUrl}/sign-up?checkout=success`,
        cancel_url: `${baseUrl}/assinar?checkout=cancel`,
      });
      return res.json({ url: session.url });
    }

    const customer = await findOrCreateCustomer(email);

    // Evita assinatura duplicada: se já existe uma ativa (ou em teste
    // gratuito), não abre um novo checkout
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
    });
    const hasLiveSub = subs.data.some(
      (s) => s.status === "active" || s.status === "trialing",
    );
    if (hasLiveSub) {
      return res.status(409).json({ error: "already_subscribed" });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: { trial_period_days: TRIAL_DAYS },
      locale: "pt-BR",
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancel`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("[/api/stripe/checkout] error:", err);
    return res.status(500).json({ error: "checkout_failed" });
  }
});

/**
 * Portal do cliente da Stripe: gerenciar cartão / cancelar assinatura.
 */
router.post("/stripe/portal", async (req: Request, res: Response) => {
  try {
    const email = await resolveEmail(req);
    if (!email) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const stripe = await getUncachableStripeClient();
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customer = existing.data[0];
    if (!customer) {
      return res.status(404).json({ error: "no_customer" });
    }

    const baseUrl = requestBaseUrl(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${baseUrl}/`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("[/api/stripe/portal] error:", err);
    return res.status(500).json({ error: "portal_failed" });
  }
});

export default router;

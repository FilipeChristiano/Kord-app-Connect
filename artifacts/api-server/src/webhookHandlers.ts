import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { sendWelcomeEmail } from "./email";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    // Validate payload is a Buffer
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
        "Received type: " + typeof payload + ". " +
        "This usually means express.json() parsed the body before reaching this handler. " +
        "FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }

  /**
   * Regras de acesso do Kordi executadas depois do sync (a assinatura do
   * webhook já foi verificada pelo processWebhook acima).
   *
   * Reembolso total => cancela a assinatura ligada à cobrança, o que faz o
   * status virar "canceled" e o acesso cair automaticamente (a checagem de
   * acesso lê o status das assinaturas na base sincronizada).
   */
  static async applyAccessRules(payload: Buffer): Promise<void> {
    let event: { type?: string; data?: { object?: Record<string, unknown> } };
    try {
      event = JSON.parse(payload.toString("utf8"));
    } catch {
      return;
    }

    // Boas-vindas: checkout de assinatura concluído. Com teste grátis, a
    // Stripe manda payment_status "no_payment_required" (nada é cobrado no
    // ato) — também conta como sucesso.
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object as
        | {
            mode?: string;
            payment_status?: string;
            subscription?: string | null;
            customer?: string | null;
            customer_details?: { email?: string | null; name?: string | null };
          }
        | undefined;
      const paidOk =
        session?.payment_status === "paid" ||
        session?.payment_status === "no_payment_required";
      if (
        session?.mode === "subscription" &&
        paidOk &&
        session.customer_details?.email
      ) {
        await sendWelcomeEmail({
          email: session.customer_details.email,
          name: session.customer_details.name ?? null,
        });

        // Anti-abuso do teste grátis: se este e-mail já teve QUALQUER outra
        // assinatura antes (em qualquer customer com o mesmo e-mail), encerra
        // o período de teste na hora — a cobrança começa imediatamente.
        try {
          await WebhookHandlers.endTrialIfRepeat(
            session.customer_details.email,
            typeof session.subscription === "string" ? session.subscription : null,
          );
        } catch (err) {
          console.error("[stripe-webhook] trial dedupe failed:", err);
        }
      }
      return;
    }

    if (event.type !== "charge.refunded") return;

    const charge = event.data?.object as
      | { refunded?: boolean; invoice?: string | null }
      | undefined;

    // Só reage a reembolso TOTAL de uma cobrança de assinatura
    if (!charge?.refunded || !charge.invoice) return;

    try {
      const stripe = await getUncachableStripeClient();
      const invoice = await stripe.invoices.retrieve(charge.invoice);
      const subscriptionId =
        typeof (invoice as unknown as { subscription?: unknown }).subscription === "string"
          ? ((invoice as unknown as { subscription: string }).subscription)
          : (invoice.parent?.subscription_details?.subscription as string | undefined);

      if (!subscriptionId) return;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      if (sub.status !== "canceled") {
        await stripe.subscriptions.cancel(subscriptionId);
        console.log(
          `[stripe-webhook] full refund => canceled subscription ${subscriptionId}`
        );
      }
    } catch (err) {
      console.error("[stripe-webhook] refund access rule failed:", err);
    }
  }

  /**
   * Se o e-mail já teve outra assinatura (qualquer status) antes desta,
   * encerra o teste grátis imediatamente (trial_end: "now"). Impede que a
   * mesma pessoa repita o período grátis assinando de novo com o mesmo
   * e-mail depois de cancelar.
   */
  static async endTrialIfRepeat(
    email: string,
    newSubscriptionId: string | null,
  ): Promise<void> {
    if (!newSubscriptionId) return;
    const stripe = await getUncachableStripeClient();

    const newSub = await stripe.subscriptions.retrieve(newSubscriptionId);
    if (newSub.status !== "trialing") return;

    const customers = await stripe.customers.list({
      email: email.trim().toLowerCase(),
      limit: 100,
    });
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 100,
      });
      const hadPrevious = subs.data.some(
        (s) => s.id !== newSubscriptionId && s.created < newSub.created,
      );
      if (hadPrevious) {
        await stripe.subscriptions.update(newSubscriptionId, {
          trial_end: "now",
        });
        console.log(
          `[stripe-webhook] repeat subscriber ${email} => trial ended now on ${newSubscriptionId}`,
        );
        return;
      }
    }
  }
}

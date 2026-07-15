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

    // Boas-vindas: checkout de assinatura concluído com pagamento OK
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object as
        | {
            mode?: string;
            payment_status?: string;
            customer_details?: { email?: string | null; name?: string | null };
          }
        | undefined;
      if (
        session?.mode === "subscription" &&
        session.payment_status === "paid" &&
        session.customer_details?.email
      ) {
        await sendWelcomeEmail({
          email: session.customer_details.email,
          name: session.customer_details.name ?? null,
        });
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
}

import { Router, type IRouter, type Request, type Response } from "express";
import { upsertAllowedEmail, revokeAllowedEmail } from "../db";

const router: IRouter = Router();

const APPROVED_STATUSES = new Set([
  "PURCHASE_APPROVED",
]);

const REVOKED_STATUSES = new Set([
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
  "PURCHASE_CANCELED",
  "PURCHASE_EXPIRED",
  "SUBSCRIPTION_CANCELLATION",
]);

/**
 * Hotmart webhook endpoint.
 *
 * Hotmart sends POSTs with a HOTTOK header that matches the secret configured
 * in the Hotmart panel. We verify that header before doing anything else.
 *
 * Payload format (Hotmart v2):
 * {
 *   "event": "PURCHASE_APPROVED",
 *   "data": {
 *     "buyer": { "email": "...", "name": "..." },
 *     "purchase": { "transaction": "HP123", "status": "APPROVED" },
 *     "product": { "id": 12345, "name": "..." }
 *   }
 * }
 */
router.post("/webhooks/hotmart", async (req: Request, res: Response) => {
  const expectedToken = process.env.HOTMART_HOTTOK;

  if (!expectedToken) {
    console.error("[hotmart-webhook] HOTMART_HOTTOK env var not set — rejecting");
    return res.status(500).json({ error: "webhook_not_configured" });
  }

  const providedToken =
    (req.header("x-hotmart-hottok") ||
      req.header("X-HOTMART-HOTTOK") ||
      req.header("hottok") ||
      req.header("HOTTOK") ||
      "").trim();

  if (providedToken !== expectedToken) {
    console.warn("[hotmart-webhook] invalid HOTTOK");
    return res.status(401).json({ error: "invalid_token" });
  }

  const body = req.body as {
    event?: string;
    data?: {
      buyer?: { email?: string };
      purchase?: { transaction?: string };
      product?: { id?: number | string };
    };
  };

  const event = body?.event ?? "";
  const email = body?.data?.buyer?.email?.trim().toLowerCase();
  const transactionId = body?.data?.purchase?.transaction;
  const productId = body?.data?.product?.id?.toString();

  if (!email) {
    console.warn("[hotmart-webhook] missing buyer email in payload");
    return res.status(400).json({ error: "missing_email" });
  }

  try {
    if (APPROVED_STATUSES.has(event)) {
      await upsertAllowedEmail({
        email,
        source: "hotmart",
        transactionId,
        productId,
        status: "active",
      });
      console.log(`[hotmart-webhook] GRANTED access to ${email} (event: ${event})`);
      return res.json({ ok: true, action: "granted" });
    }

    if (REVOKED_STATUSES.has(event)) {
      await revokeAllowedEmail(email);
      console.log(`[hotmart-webhook] REVOKED access for ${email} (event: ${event})`);
      return res.json({ ok: true, action: "revoked" });
    }

    console.log(`[hotmart-webhook] ignored event ${event} for ${email}`);
    return res.json({ ok: true, action: "ignored", event });
  } catch (err) {
    console.error("[hotmart-webhook] db error:", err);
    return res.status(500).json({ error: "db_error" });
  }
});

export default router;

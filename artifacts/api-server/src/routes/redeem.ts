import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { redeemAccessCode } from "../db";
import { getVerifiedEmail } from "../verifiedEmail";

const router: IRouter = Router();

// Freio simples contra adivinhação de códigos: 10 tentativas / 10 min por usuário.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60_000;

function tooManyAttempts(userId: string): boolean {
  const now = Date.now();
  const entry = attempts.get(userId);
  if (!entry || entry.resetAt < now) {
    attempts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

router.post("/redeem-code", async (req: Request, res: Response) => {
  const userId = getAuth(req)?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  const code = (req.body as { code?: unknown } | undefined)?.code;
  if (typeof code !== "string" || code.trim().length < 3 || code.length > 64) {
    return res.status(400).json({ error: "invalid_code" });
  }

  if (tooManyAttempts(userId)) {
    return res.status(429).json({ error: "too_many_attempts" });
  }

  try {
    const email = await getVerifiedEmail(userId);
    if (!email) return res.status(403).json({ error: "no_verified_email" });

    const result = await redeemAccessCode(code, email);
    if (!result.ok) {
      const status = result.reason === "invalid_code" ? 404 : 409;
      return res.status(status).json({ error: result.reason });
    }
    return res.json({ ok: true, expiresAt: result.expiresAt });
  } catch (err) {
    console.error("[/api/redeem-code] error:", err);
    return res.status(500).json({ error: "redeem_failed" });
  }
});

export default router;

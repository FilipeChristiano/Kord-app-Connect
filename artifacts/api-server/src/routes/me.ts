import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { getAccessInfo } from "../db";
import { getVerifiedEmail } from "../verifiedEmail";

const router: IRouter = Router();

router.get("/me", async (req: Request, res: Response) => {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    return res.status(401).json({ authenticated: false, allowed: false });
  }

  try {
    // Só e-mail VERIFICADO conta para liberar acesso (posse comprovada).
    const primaryEmail = await getVerifiedEmail(userId);

    if (!primaryEmail) {
      return res.json({
        authenticated: true,
        allowed: false,
        email: null,
        reason: "no_verified_email",
      });
    }

    const user = await clerkClient.users.getUser(userId);
    const access = await getAccessInfo(primaryEmail);

    return res.json({
      authenticated: true,
      allowed: access.allowed,
      accessSource: access.source,
      email: primaryEmail,
      name: user.firstName ?? null,
    });
  } catch (err) {
    console.error("[/api/me] error:", err);
    return res.status(500).json({ authenticated: true, allowed: false, error: "lookup_failed" });
  }
});

export default router;

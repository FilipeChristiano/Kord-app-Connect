import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { getAccessInfo } from "../db";

const router: IRouter = Router();

router.get("/me", async (req: Request, res: Response) => {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    return res.status(401).json({ authenticated: false, allowed: false });
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const primaryEmail =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
      return res.json({
        authenticated: true,
        allowed: false,
        email: null,
        reason: "no_email",
      });
    }

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

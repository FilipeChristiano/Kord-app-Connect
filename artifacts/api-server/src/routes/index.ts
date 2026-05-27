import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import hotmartWebhookRouter from "./webhooks-hotmart";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(hotmartWebhookRouter);

export default router;

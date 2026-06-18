import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import hotmartWebhookRouter from "./webhooks-hotmart";
import transcribeRouter from "./transcribe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(hotmartWebhookRouter);
router.use(transcribeRouter);

export default router;

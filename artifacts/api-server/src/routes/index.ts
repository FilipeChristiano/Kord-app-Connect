import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import hotmartWebhookRouter from "./webhooks-hotmart";
import transcribeRouter from "./transcribe";
import chordsRouter from "./chords";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(hotmartWebhookRouter);
router.use(transcribeRouter);
router.use(chordsRouter);

export default router;

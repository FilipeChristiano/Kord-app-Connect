import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import hotmartWebhookRouter from "./webhooks-hotmart";
import transcribeRouter from "./transcribe";
import chordsRouter from "./chords";
import cifraRouter from "./cifra";
import ytAudioRouter from "./yt-audio";
import stemsRouter from "./stems";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(hotmartWebhookRouter);
router.use(transcribeRouter);
router.use(chordsRouter);
router.use(cifraRouter);
router.use(ytAudioRouter);
router.use(stemsRouter);

export default router;

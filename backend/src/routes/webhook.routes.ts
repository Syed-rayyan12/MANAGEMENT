import { Router } from 'express';
import { handleSquareWebhook } from '../controllers/invoice.controller';

const router = Router();

// Square webhook — no auth middleware (Square calls this directly)
// Signature verification is done inside the handler
router.post('/square', handleSquareWebhook);

export default router;

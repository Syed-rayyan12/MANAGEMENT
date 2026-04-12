import { Router } from 'express';
import { handlePayPalWebhook } from '../controllers/invoice.controller';

const router = Router();

// PayPal webhook — no auth middleware (PayPal calls this directly)
// Signature verification is done inside the handler
router.post('/paypal', handlePayPalWebhook);

export default router;

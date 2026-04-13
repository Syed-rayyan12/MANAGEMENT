import { Router } from 'express';
import {
  createInvoice,
  getInvoices,
  cancelInvoiceHandler,
} from '../controllers/invoice.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { validate, createInvoiceSchema } from '../utils/validators';

const router = Router();

// All invoice routes require authentication + TL/PM/EXECUTIVE role
router.use(authenticate);
router.use(authorizeRoles('TL', 'PM', 'EXECUTIVE'));

// ─── Create a new invoice (generates Square payment link) ──
router.post('/', validate(createInvoiceSchema), createInvoice);

// ─── Get all invoices (scoped by role/team) ────────────────
router.get('/', getInvoices);

// ─── Cancel an invoice ─────────────────────────────────────
router.post('/:id/cancel', cancelInvoiceHandler);

export default router;

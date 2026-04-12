import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAndSendInvoice, cancelInvoice, verifyWebhookSignature } from '../utils/paypal';

const prisma = new PrismaClient();

// ─── Create Invoice ───────────────────────────────

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { clientName, clientEmail, description, amount, teamId } = req.body;

    // Verify user belongs to the specified team (unless EXECUTIVE)
    if (user.role !== 'EXECUTIVE') {
      if (!user.teamIds || !user.teamIds.includes(teamId)) {
        res.status(403).json({
          success: false,
          message: 'You can only create invoices for your own team',
        });
        return;
      }
    }

    // Call PayPal to create and send the invoice
    const paypalResult = await createAndSendInvoice({
      clientName,
      clientEmail: clientEmail || undefined,
      description,
      amount: parseFloat(amount),
      currency: 'GBP',
    });

    // Save to database
    const invoice = await prisma.invoice.create({
      data: {
        clientName,
        clientEmail: clientEmail || null,
        description,
        amount: parseFloat(amount),
        currency: 'GBP',
        paypalInvoiceId: paypalResult.invoiceId,
        paymentLink: paypalResult.paymentLink,
        status: 'PENDING',
        createdById: user.id,
        teamId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        team: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
    });
  } catch (error: any) {
    console.error('Create invoice error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create invoice',
    });
  }
};

// ─── Get Invoices ─────────────────────────────────

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    // Build where clause based on role
    let where: any = {};

    if (user.role === 'EXECUTIVE') {
      // Executive sees all invoices
      where = {};
    } else {
      // TL and PM see invoices from their teams
      if (user.teamIds && user.teamIds.length > 0) {
        where = { teamId: { in: user.teamIds } };
      } else {
        // No teams — see only own invoices
        where = { createdById: user.id };
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        team: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error: any) {
    console.error('Get invoices error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
    });
  }
};

// ─── Cancel Invoice ───────────────────────────────

export const cancelInvoiceHandler = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });

    if (!invoice) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }

    // Only the creator or an EXECUTIVE can cancel
    if (invoice.createdById !== user.id && user.role !== 'EXECUTIVE') {
      // Also allow if user is in the same team (TL oversight)
      if (!user.teamIds?.includes(invoice.teamId)) {
        res.status(403).json({ success: false, message: 'Not authorized to cancel this invoice' });
        return;
      }
    }

    if (invoice.status !== 'PENDING') {
      res.status(400).json({ success: false, message: `Cannot cancel invoice with status: ${invoice.status}` });
      return;
    }

    // Cancel on PayPal
    if (invoice.paypalInvoiceId) {
      await cancelInvoice(invoice.paypalInvoiceId);
    }

    // Update in DB
    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        team: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    res.json({
      success: true,
      message: 'Invoice cancelled successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('Cancel invoice error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel invoice',
    });
  }
};

// ─── PayPal Webhook Handler ───────────────────────

export const handlePayPalWebhook = async (req: Request, res: Response) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    // Verify webhook signature if webhook ID is configured
    if (webhookId) {
      const isValid = await verifyWebhookSignature({
        authAlgo: req.headers['paypal-auth-algo'] as string,
        certUrl: req.headers['paypal-cert-url'] as string,
        transmissionId: req.headers['paypal-transmission-id'] as string,
        transmissionSig: req.headers['paypal-transmission-sig'] as string,
        transmissionTime: req.headers['paypal-transmission-time'] as string,
        webhookId,
        webhookEvent: req.body,
      });

      if (!isValid) {
        console.warn('PayPal webhook signature verification failed');
        res.status(401).json({ success: false, message: 'Invalid webhook signature' });
        return;
      }
    }

    const event = req.body;
    const eventType = event.event_type;
    const eventId = event.id;
    const resource = event.resource;

    // Extract PayPal invoice ID from the resource
    const paypalInvoiceId = resource?.id;

    if (!paypalInvoiceId) {
      // Not an invoice event we care about
      res.status(200).json({ success: true, message: 'Event acknowledged' });
      return;
    }

    // Find the invoice in our DB
    const invoice = await prisma.invoice.findUnique({
      where: { paypalInvoiceId },
    });

    if (!invoice) {
      // Invoice not in our system — acknowledge but skip
      res.status(200).json({ success: true, message: 'Invoice not found in system' });
      return;
    }

    // Idempotency check — skip if we've already processed this event
    if (invoice.lastWebhookEventId === eventId) {
      res.status(200).json({ success: true, message: 'Event already processed' });
      return;
    }

    // Map PayPal event types to our statuses
    let newStatus: 'PAID' | 'CANCELLED' | 'REFUNDED' | 'FAILED' | null = null;
    let paidAt: Date | null = null;

    switch (eventType) {
      case 'INVOICING.INVOICE.PAID':
        newStatus = 'PAID';
        paidAt = new Date();
        break;
      case 'INVOICING.INVOICE.CANCELLED':
        newStatus = 'CANCELLED';
        break;
      case 'INVOICING.INVOICE.REFUNDED':
        newStatus = 'REFUNDED';
        break;
      case 'INVOICING.INVOICE.UPDATED':
        // Check if the status in the resource indicates payment
        if (resource?.status === 'PAID') {
          newStatus = 'PAID';
          paidAt = new Date();
        } else if (resource?.status === 'CANCELLED') {
          newStatus = 'CANCELLED';
        }
        break;
      default:
        // Event type we don't handle
        res.status(200).json({ success: true, message: 'Event type not handled' });
        return;
    }

    if (newStatus) {
      await prisma.invoice.update({
        where: { paypalInvoiceId },
        data: {
          status: newStatus,
          paidAt: paidAt || undefined,
          lastWebhookEventId: eventId,
        },
      });
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    console.error('PayPal webhook error:', error.message);
    // Always return 200 to PayPal to prevent retries on our processing errors
    res.status(200).json({ success: true, message: 'Webhook received' });
  }
};

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createPaymentLink, deletePaymentLink, verifyWebhookSignature } from '../utils/square';

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

    // Call Square to create a payment link
    const squareResult = await createPaymentLink({
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
        squarePaymentLinkId: squareResult.paymentLinkId,
        squareOrderId: squareResult.orderId,
        paymentLink: squareResult.paymentLink,
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

    // Delete the payment link on Square (this also cancels the order)
    if (invoice.squarePaymentLinkId) {
      try {
        await deletePaymentLink(invoice.squarePaymentLinkId);
      } catch (error: any) {
        console.warn('Square delete payment link failed (continuing):', error.message);
      }
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

// ─── Square Webhook Handler ─────────────────────

export const handleSquareWebhook = async (req: Request, res: Response) => {
  try {
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    const notificationUrl = process.env.SQUARE_WEBHOOK_URL;

    // Verify webhook signature if signature key is configured
    if (signatureKey && notificationUrl) {
      const signature = req.headers['x-square-hmacsha256-signature'] as string;
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      if (!signature || !verifyWebhookSignature(signature, rawBody, notificationUrl, signatureKey)) {
        console.warn('Square webhook signature verification failed');
        res.status(401).json({ success: false, message: 'Invalid webhook signature' });
        return;
      }
    }

    const event = req.body;
    const eventType = event.type;
    const eventId = event.event_id;

    // We care about payment.completed and payment.updated events
    // Square fires these when someone pays via a checkout link
    const payment = event.data?.object?.payment;

    if (!payment?.order_id) {
      // Not a payment event with an order — acknowledge and skip
      res.status(200).json({ success: true, message: 'Event acknowledged' });
      return;
    }

    const squareOrderId = payment.order_id;

    // Find the invoice in our DB by the Square order ID
    const invoice = await prisma.invoice.findFirst({
      where: { squareOrderId },
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

    // Map Square event types to our statuses
    let newStatus: 'PAID' | 'CANCELLED' | 'REFUNDED' | 'FAILED' | null = null;
    let paidAt: Date | null = null;

    if (eventType === 'payment.completed' || eventType === 'payment.updated') {
      const paymentStatus = payment.status;
      if (paymentStatus === 'COMPLETED') {
        newStatus = 'PAID';
        paidAt = new Date();
      } else if (paymentStatus === 'FAILED') {
        newStatus = 'FAILED';
      } else if (paymentStatus === 'CANCELED' || paymentStatus === 'CANCELLED') {
        newStatus = 'CANCELLED';
      }
    } else if (eventType === 'refund.created' || eventType === 'refund.updated') {
      const refundStatus = event.data?.object?.refund?.status;
      if (refundStatus === 'COMPLETED') {
        newStatus = 'REFUNDED';
      }
    }

    if (newStatus) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: newStatus,
          paidAt: paidAt || undefined,
          lastWebhookEventId: eventId,
        },
      });
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    console.error('Square webhook error:', error.message);
    // Always return 200 to Square to prevent retries on our processing errors
    res.status(200).json({ success: true, message: 'Webhook received' });
  }
};

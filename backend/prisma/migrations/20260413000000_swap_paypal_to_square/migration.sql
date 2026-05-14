-- Swap PayPal fields for Square on invoices table

-- Drop the old PayPal unique index
DROP INDEX IF EXISTS "invoices_paypalInvoiceId_key";

-- Rename paypalInvoiceId -> squarePaymentLinkId
ALTER TABLE "invoices" RENAME COLUMN "paypalInvoiceId" TO "squarePaymentLinkId";

-- Add squareOrderId column
ALTER TABLE "invoices" ADD COLUMN "squareOrderId" TEXT;

-- Recreate unique index on the new column
CREATE UNIQUE INDEX "invoices_squarePaymentLinkId_key" ON "invoices"("squarePaymentLinkId");

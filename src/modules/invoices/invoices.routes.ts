import { FastifyInstance } from 'fastify';
import { InvoicesService } from './invoices.service.js';
import { createInvoiceSchema, updateInvoiceSchema, addItemSchema, listInvoicesQuerySchema } from './invoices.schema.js';

export default async function invoicesRoutes(fastify: FastifyInstance) {
  const service = new InvoicesService(fastify.supabase);

  fastify.get('/api/admin/invoices', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async (request, reply) => {
    const parsed = listInvoicesQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid query', errors: parsed.error.flatten() });
    return service.list(parsed.data);
  });

  fastify.get<{ Params: { id: string } }>('/api/admin/invoices/:id', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async (request, reply) => {
    try { return await service.getById(request.params.id); }
    catch { return reply.status(404).send({ message: 'Invoice not found' }); }
  });

  fastify.post('/api/admin/invoices', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async (request, reply) => {
    const parsed = createInvoiceSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    const invoice = await service.create(parsed.data, request.user.id);
    return reply.status(201).send(invoice);
  });

  fastify.put<{ Params: { id: string } }>('/api/admin/invoices/:id', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async (request, reply) => {
    const parsed = updateInvoiceSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    try {
      const updated = await service.update(request.params.id, parsed.data);
      if (parsed.data.status === 'sent' && updated.client_email) {
        fastify.notifications.sendInvoiceEmail(updated).catch((err) => fastify.log.error(err, 'Failed to send invoice email'));
      }
      return updated;
    } catch {
      return reply.status(404).send({ message: 'Invoice not found' });
    }
  });

  fastify.post<{ Params: { id: string } }>('/api/admin/invoices/:id/items', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async (request, reply) => {
    const parsed = addItemSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    const item = await service.addItem(request.params.id, parsed.data);
    return reply.status(201).send(item);
  });

  fastify.get<{ Params: { id: string } }>('/api/admin/invoices/:id/pdf', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async (request, reply) => {
    try {
      const invoice = await service.getById(request.params.id);
      const PDFDocument = (await import('pdfkit')).default;
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const logoPath = path.resolve(__dirname, '../../assets/logo.png');

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      const RED = '#E31E24';
      const DARK = '#1a1a1a';
      const GRAY = '#666666';
      const LIGHT_GRAY = '#f5f5f5';
      const LEFT = 50;
      const RIGHT = 545;
      const WIDTH = RIGHT - LEFT;

      // Use "Rs." rather than the ₹ (U+20B9) symbol: pdfkit's built-in
      // Helvetica has no rupee glyph and renders a stray "1"-like character.
      const fmt = (n: number) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      // --- Header with logo and INVOICE title ---
      try {
        doc.image(logoPath, LEFT, 40, { width: 150 });
      } catch {
        doc.fontSize(18).fillColor(RED).text('PRIME', LEFT, 45, { continued: true }).fillColor(DARK).text(' LOGISTIC SERVICES');
      }

      doc.fontSize(28).fillColor(DARK).text('INVOICE', RIGHT - 150, 45, { width: 150, align: 'right' });

      // Red accent line
      doc.moveTo(LEFT, 95).lineTo(RIGHT, 95).lineWidth(2).strokeColor(RED).stroke();

      // --- Invoice meta (left) + Company info (right) ---
      const metaY = 115;
      doc.fontSize(9).fillColor(GRAY);

      doc.text('Invoice Number', LEFT, metaY);
      doc.fontSize(11).fillColor(DARK).text(invoice.invoice_number, LEFT, metaY + 13);

      doc.fontSize(9).fillColor(GRAY).text('Invoice Date', LEFT, metaY + 35);
      doc.fontSize(10).fillColor(DARK).text(invoice.invoice_date, LEFT, metaY + 48);

      if (invoice.due_date) {
        doc.fontSize(9).fillColor(GRAY).text('Due Date', LEFT, metaY + 70);
        doc.fontSize(10).fillColor(DARK).text(invoice.due_date, LEFT, metaY + 83);
      }

      const statusText = (invoice.status || 'draft').toUpperCase();
      const statusColor = invoice.status === 'paid' ? '#16a34a' : invoice.status === 'overdue' ? '#ea580c' : invoice.status === 'cancelled' ? '#dc2626' : '#6b7280';
      doc.fontSize(9).fillColor(GRAY).text('Status', RIGHT - 150, metaY, { width: 150, align: 'right' });
      doc.fontSize(11).fillColor(statusColor).text(statusText, RIGHT - 150, metaY + 13, { width: 150, align: 'right' });

      doc.fontSize(9).fillColor(GRAY).text('From', RIGHT - 150, metaY + 35, { width: 150, align: 'right' });
      doc.fontSize(10).fillColor(DARK).text('Prime Logistic Services', RIGHT - 150, metaY + 48, { width: 150, align: 'right' });
      doc.fontSize(8).fillColor(GRAY).text('support@primelogisticservice.com', RIGHT - 150, metaY + 62, { width: 150, align: 'right' });

      // --- Bill To section ---
      const billY = metaY + 110;
      doc.roundedRect(LEFT, billY, WIDTH, 75, 4).fillColor(LIGHT_GRAY).fill();

      doc.fontSize(8).fillColor(RED).text('BILL TO', LEFT + 15, billY + 12);
      doc.fontSize(11).fillColor(DARK).text(invoice.client_name, LEFT + 15, billY + 25);

      const clientDetails = [
        invoice.client_address,
        [invoice.client_email, invoice.client_phone].filter(Boolean).join('  |  '),
        invoice.client_gstin ? `GSTIN: ${invoice.client_gstin}` : null,
      ].filter(Boolean);

      doc.fontSize(9).fillColor(GRAY);
      let detailY = billY + 40;
      for (const line of clientDetails) {
        doc.text(line!, LEFT + 15, detailY);
        detailY += 12;
      }

      // --- Items table ---
      const tableY = billY + 95;

      // Table header
      doc.roundedRect(LEFT, tableY, WIDTH, 28, 4).fillColor(DARK).fill();
      doc.fontSize(8).fillColor('#ffffff');
      doc.text('DESCRIPTION', LEFT + 15, tableY + 9, { width: 230 });
      doc.text('QTY', 295, tableY + 9, { width: 50, align: 'center' });
      doc.text('UNIT PRICE', 350, tableY + 9, { width: 85, align: 'right' });
      doc.text('AMOUNT', 445, tableY + 9, { width: 85, align: 'right' });

      // Table rows
      let rowY = tableY + 28;
      const items = invoice.invoice_items || [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rowHeight = 32;

        if (i % 2 === 0) {
          doc.rect(LEFT, rowY, WIDTH, rowHeight).fillColor('#fafafa').fill();
        }

        doc.fontSize(9).fillColor(DARK).text(item.description, LEFT + 15, rowY + 10, { width: 230 });
        doc.fillColor(GRAY).text(String(item.quantity), 295, rowY + 10, { width: 50, align: 'center' });
        doc.text(fmt(item.unit_price), 350, rowY + 10, { width: 85, align: 'right' });
        doc.fillColor(DARK).text(fmt(item.amount), 445, rowY + 10, { width: 85, align: 'right' });

        rowY += rowHeight;
      }

      // Bottom line of table
      doc.moveTo(LEFT, rowY).lineTo(RIGHT, rowY).lineWidth(0.5).strokeColor('#e5e5e5').stroke();

      // --- Totals section ---
      const totalsX = 350;
      const totalsWidth = RIGHT - totalsX;
      let totalsY = rowY + 15;

      doc.fontSize(9).fillColor(GRAY);
      doc.text('Subtotal', totalsX, totalsY, { width: 80 });
      doc.fillColor(DARK).text(fmt(invoice.subtotal), totalsX + 80, totalsY, { width: totalsWidth - 80, align: 'right' });
      totalsY += 18;

      if (invoice.tax_amount) {
        doc.fillColor(GRAY).text('Tax', totalsX, totalsY, { width: 80 });
        doc.fillColor(DARK).text(fmt(invoice.tax_amount), totalsX + 80, totalsY, { width: totalsWidth - 80, align: 'right' });
        totalsY += 18;
      }

      if (invoice.discount_amount) {
        doc.fillColor(GRAY).text('Discount', totalsX, totalsY, { width: 80 });
        doc.fillColor('#16a34a').text(`- ${fmt(invoice.discount_amount)}`, totalsX + 80, totalsY, { width: totalsWidth - 80, align: 'right' });
        totalsY += 18;
      }

      // Total with red background
      totalsY += 5;
      doc.roundedRect(totalsX, totalsY, totalsWidth, 32, 4).fillColor(RED).fill();
      doc.fontSize(10).fillColor('#ffffff').text('TOTAL DUE', totalsX + 12, totalsY + 10, { width: 80 });
      doc.fontSize(13).text(fmt(invoice.total_amount), totalsX + 80, totalsY + 8, { width: totalsWidth - 95, align: 'right' });

      // --- Notes ---
      if (invoice.notes) {
        const notesY = totalsY + 55;
        doc.fontSize(8).fillColor(RED).text('NOTES', LEFT, notesY);
        doc.fontSize(9).fillColor(GRAY).text(invoice.notes, LEFT, notesY + 14, { width: WIDTH * 0.6 });
      }

      // --- Footer ---
      const footerY = 770;
      doc.moveTo(LEFT, footerY).lineTo(RIGHT, footerY).lineWidth(0.5).strokeColor('#e5e5e5').stroke();
      doc.fontSize(8).fillColor(GRAY).text('Thank you for choosing Prime Logistic Services.', LEFT, footerY + 10, { width: WIDTH, align: 'center' });
      doc.text('support@primelogisticservice.com  |  +91 9739994318', LEFT, footerY + 22, { width: WIDTH, align: 'center' });

      doc.end();
      await new Promise<void>((resolve) => doc.on('end', resolve));
      const pdfBuffer = Buffer.concat(chunks);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`)
        .send(pdfBuffer);
    } catch {
      return reply.status(404).send({ message: 'Invoice not found' });
    }
  });

  fastify.post<{ Params: { id: string } }>('/api/admin/invoices/:id/reminder', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async (request, reply) => {
    try {
      const invoice = await service.getById(request.params.id);
      if (!['sent', 'overdue'].includes(invoice.status)) {
        return reply.status(400).send({ message: 'Reminders can only be sent for sent or overdue invoices' });
      }
      if (!invoice.client_email && !invoice.client_phone) {
        return reply.status(400).send({ message: 'No client email or phone to send reminder' });
      }

      const reminderContent = `Dear ${invoice.client_name},\n\nThis is a reminder for invoice ${invoice.invoice_number} with an outstanding amount of ₹${Number(invoice.total_amount).toLocaleString('en-IN')}.\n\nPlease process the payment at your earliest convenience.\n\nThank you,\nPrime Logistic Services`;

      if (invoice.client_email) {
        await fastify.notifications.send({
          type: 'email',
          recipient: invoice.client_email,
          subject: `Payment Reminder — ${invoice.invoice_number}`,
          content: reminderContent,
          relatedType: 'invoice',
          relatedId: invoice.id,
        });
      }

      if (invoice.client_phone) {
        await fastify.notifications.send({
          type: 'whatsapp',
          recipient: invoice.client_phone,
          content: reminderContent,
          relatedType: 'invoice',
          relatedId: invoice.id,
        });
      }

      return { message: 'Reminder sent successfully' };
    } catch {
      return reply.status(404).send({ message: 'Invoice not found' });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/api/admin/invoices/:id', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async (request, reply) => {
    try { await service.delete(request.params.id); return reply.status(204).send(); }
    catch { return reply.status(404).send({ message: 'Invoice not found' }); }
  });
}

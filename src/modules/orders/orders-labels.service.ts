import { SupabaseClient } from '@supabase/supabase-js';

interface LabelOrder {
  awb_number: string;
  partner_awb_number: string | null;
  shipment_type: string;
  sender_name: string | null;
  sender_phone: string | null;
  sender_address: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  receiver_address: string | null;
  origin_city: string | null;
  destination_city: string | null;
  weight: number | null;
}

/**
 * Generates a PDF of shipping/box labels for an order — one 4x6" label page per
 * box. Each label shows the company (Prime Logistic Services), the AWB, the
 * receiver (customer) name & address, the sender, the route, and a large
 * "BOX i OF N" marker so each physical box is numbered 1..N.
 */
export class OrdersLabelsService {
  constructor(private supabase: SupabaseClient) {}

  async getOrder(id: string): Promise<LabelOrder> {
    const { data, error } = await this.supabase
      .from('orders')
      .select(
        'awb_number, partner_awb_number, shipment_type, sender_name, sender_phone, sender_address, receiver_name, receiver_phone, receiver_address, origin_city, destination_city, weight'
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (error) throw new Error(error.message);
    return data as LabelOrder;
  }

  async generateLabels(id: string, boxCount: number): Promise<{ buffer: Buffer; awb: string }> {
    const order = await this.getOrder(id);

    const PDFDocument = (await import('pdfkit')).default;
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const logoPath = path.resolve(__dirname, '../../assets/logo.png');

    const RED = '#E31E24';
    const DARK = '#1a1a1a';
    const GRAY = '#666666';

    // 4 x 6 inch shipping label (points: 1in = 72pt)
    const W = 288;
    const H = 432;
    const M = 16; // side margin
    const INNER = W - M * 2;

    const doc = new PDFDocument({ size: [W, H], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    const drawLabel = (boxIndex: number) => {
      // --- Header band ---
      doc.rect(0, 0, W, 58).fill(RED);
      try {
        doc.image(logoPath, 14, 11, { width: 36, height: 36 });
      } catch {
        // logo optional — ignore if asset is missing
      }
      doc
        .fillColor('#ffffff')
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('PRIME LOGISTIC SERVICES', 58, 16, { width: W - 58 - M, lineBreak: false });
      doc
        .fontSize(8)
        .font('Helvetica')
        .text('Shipping Label', 58, 34, { width: W - 58 - M, lineBreak: false });

      let y = 72;

      // --- AWB ---
      doc.fillColor(GRAY).fontSize(7).font('Helvetica').text('AWB NUMBER', M, y);
      doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold').text(order.awb_number, M, y + 9);
      if (order.partner_awb_number) {
        doc
          .fillColor(GRAY)
          .fontSize(7)
          .font('Helvetica')
          .text(`Partner AWB: ${order.partner_awb_number}`, M, y + 26);
        y += 8;
      }
      y += 34;

      doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.75).strokeColor('#dddddd').stroke();
      y += 10;

      // --- Deliver to (customer) ---
      doc.fillColor(RED).fontSize(8).font('Helvetica-Bold').text('DELIVER TO', M, y);
      y += 12;
      doc
        .fillColor(DARK)
        .fontSize(13)
        .font('Helvetica-Bold')
        .text(order.receiver_name || '—', M, y, { width: INNER });
      y = doc.y + 2;
      if (order.receiver_address) {
        doc
          .fillColor(DARK)
          .fontSize(9)
          .font('Helvetica')
          .text(order.receiver_address, M, y, { width: INNER });
        y = doc.y + 1;
      }
      if (order.receiver_phone) {
        doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(`Ph: ${order.receiver_phone}`, M, y, { width: INNER });
        y = doc.y;
      }
      y += 8;

      doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.75).strokeColor('#dddddd').stroke();
      y += 10;

      // --- From (sender) ---
      doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold').text('FROM', M, y);
      y += 11;
      doc
        .fillColor(DARK)
        .fontSize(9)
        .font('Helvetica')
        .text(order.sender_name || '—', M, y, { width: INNER });
      y = doc.y;
      if (order.sender_address) {
        doc.fillColor(GRAY).fontSize(8).font('Helvetica').text(order.sender_address, M, y, { width: INNER });
        y = doc.y;
      }
      y += 8;

      // --- Route & weight ---
      const route = `${order.origin_city || '—'}  →  ${order.destination_city || '—'}`;
      doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold').text(route, M, y, { width: INNER });
      y = doc.y + 1;
      const meta = [cap(order.shipment_type), order.weight ? `${order.weight} kg` : null]
        .filter(Boolean)
        .join('  •  ');
      if (meta) {
        doc.fillColor(GRAY).fontSize(8).font('Helvetica').text(meta, M, y, { width: INNER });
      }

      // --- Box number (anchored to bottom) ---
      const boxBoxY = H - 66;
      doc.rect(M, boxBoxY, INNER, 50).lineWidth(1.5).strokeColor(DARK).stroke();
      doc
        .fillColor(DARK)
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(`BOX ${boxIndex} OF ${boxCount}`, M, boxBoxY + 15, { width: INNER, align: 'center' });
    };

    for (let i = 1; i <= boxCount; i++) {
      if (i > 1) doc.addPage({ size: [W, H], margin: 0 });
      drawLabel(i);
    }

    doc.end();
    await new Promise<void>((resolve) => doc.on('end', resolve));
    return { buffer: Buffer.concat(chunks), awb: order.awb_number };
  }
}

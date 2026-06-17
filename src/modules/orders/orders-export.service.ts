import { SupabaseClient } from '@supabase/supabase-js';

interface ExportOrder {
  awb_number: string;
  partner_awb_number: string | null;
  client_id: string | null;
  shipment_type: string;
  status: string;
  origin_city: string;
  destination_city: string;
  sender_name: string;
  receiver_name: string;
  weight: number | null;
  created_at: string;
}

interface ExportFilters {
  status?: string;
  shipment_type?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
  client_id?: string;
}

export class OrdersExportService {
  constructor(private supabase: SupabaseClient) {}

  async fetchOrders(filters: ExportFilters): Promise<{ orders: ExportOrder[]; clientNames: Map<string, string> }> {
    let q = this.supabase
      .from('orders')
      .select('awb_number, partner_awb_number, client_id, shipment_type, status, origin_city, destination_city, sender_name, receiver_name, weight, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (filters.status) q = q.eq('status', filters.status);
    if (filters.shipment_type) q = q.eq('shipment_type', filters.shipment_type);
    if (filters.client_id) q = q.eq('client_id', filters.client_id);
    if (filters.from_date) q = q.gte('created_at', filters.from_date);
    if (filters.to_date) q = q.lte('created_at', filters.to_date);
    if (filters.search) {
      q = q.or(`awb_number.ilike.%${filters.search}%,partner_awb_number.ilike.%${filters.search}%,sender_name.ilike.%${filters.search}%,receiver_name.ilike.%${filters.search}%`);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const orders = data ?? [];

    const clientIds = [...new Set(orders.map((o) => o.client_id).filter(Boolean))] as string[];
    const clientNames = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients } = await this.supabase.from('clients').select('id, name').in('id', clientIds);
      for (const c of clients ?? []) {
        clientNames.set(c.id, c.name);
      }
    }

    return { orders, clientNames };
  }

  async generateExcel(filters: ExportFilters): Promise<Buffer> {
    const { orders, clientNames } = await this.fetchOrders(filters);
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Orders');

    const RED = 'FFE31E24';
    const WHITE = 'FFFFFFFF';

    sheet.columns = [
      { header: 'AWB Number', key: 'awb_number', width: 20 },
      { header: 'Partner AWB', key: 'partner_awb', width: 20 },
      { header: 'Client', key: 'client', width: 20 },
      { header: 'Shipment Type', key: 'shipment_type', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Origin City', key: 'origin_city', width: 15 },
      { header: 'Destination City', key: 'destination_city', width: 15 },
      { header: 'Sender', key: 'sender_name', width: 20 },
      { header: 'Receiver', key: 'receiver_name', width: 20 },
      { header: 'Weight (kg)', key: 'weight', width: 12 },
      { header: 'Created Date', key: 'created_at', width: 18 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: WHITE } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    for (const order of orders) {
      sheet.addRow({
        awb_number: order.awb_number,
        partner_awb: order.partner_awb_number || '',
        client: order.client_id ? clientNames.get(order.client_id) || '' : '',
        shipment_type: order.shipment_type.charAt(0).toUpperCase() + order.shipment_type.slice(1),
        status: order.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        origin_city: order.origin_city,
        destination_city: order.destination_city,
        sender_name: order.sender_name,
        receiver_name: order.receiver_name,
        weight: order.weight ?? '',
        created_at: new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generatePdf(filters: ExportFilters): Promise<Buffer> {
    const { orders, clientNames } = await this.fetchOrders(filters);
    const PDFDocument = (await import('pdfkit')).default;

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const RED = '#E31E24';
    const DARK = '#1a1a1a';
    const GRAY = '#666666';
    const LEFT = 40;
    const PAGE_WIDTH = 842 - 80;

    const formatStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const filterParts: string[] = [];
    if (filters.status) filterParts.push(`Status: ${formatStatus(filters.status)}`);
    if (filters.shipment_type) filterParts.push(`Type: ${filters.shipment_type.charAt(0).toUpperCase() + filters.shipment_type.slice(1)}`);
    if (filters.from_date) filterParts.push(`From: ${formatDate(filters.from_date)}`);
    if (filters.to_date) filterParts.push(`To: ${formatDate(filters.to_date)}`);
    if (filters.search) filterParts.push(`Search: ${filters.search}`);

    const cols = [
      { header: 'AWB Number', width: 120, key: 'awb' },
      { header: 'Client', width: 110, key: 'client' },
      { header: 'Type', width: 80, key: 'type' },
      { header: 'Status', width: 100, key: 'status' },
      { header: 'Route', width: 180, key: 'route' },
      { header: 'Sender', width: 100, key: 'sender' },
      { header: 'Created', width: 80, key: 'created' },
    ];

    let pageNum = 0;

    const drawHeader = () => {
      pageNum++;
      doc.fontSize(16).fillColor(RED).text('PRIME LOGISTIC SERVICES', LEFT, 40, { lineBreak: false });
      doc.fontSize(10).fillColor(GRAY).text(`Orders Report — ${formatDate(new Date().toISOString())}`, LEFT, 60, { lineBreak: false });
      if (filterParts.length > 0) {
        doc.fontSize(8).fillColor(GRAY).text(`Filters: ${filterParts.join(' | ')}`, LEFT, 75, { lineBreak: false });
      }
      doc.fontSize(8).fillColor(GRAY).text(`${orders.length} orders`, LEFT + PAGE_WIDTH - 60, 60, { width: 60, align: 'right', lineBreak: false });

      doc.moveTo(LEFT, 90).lineTo(LEFT + PAGE_WIDTH, 90).lineWidth(2).strokeColor(RED).stroke();

      const headerY = 100;
      doc.rect(LEFT, headerY, PAGE_WIDTH, 20).fillColor(DARK).fill();
      doc.fontSize(7).fillColor('#ffffff');
      let x = LEFT + 8;
      for (const col of cols) {
        doc.text(col.header.toUpperCase(), x, headerY + 6, { width: col.width - 8, lineBreak: false });
        x += col.width;
      }

      return headerY + 20;
    };

    let y = drawHeader();

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const rowHeight = 18;

      if (y + rowHeight > 540) {
        doc.fontSize(7).fillColor(GRAY).text(`Page ${pageNum}`, LEFT, 545, { width: PAGE_WIDTH, align: 'center', lineBreak: false });
        doc.addPage();
        y = drawHeader();
      }

      if (i % 2 === 0) {
        doc.rect(LEFT, y, PAGE_WIDTH, rowHeight).fillColor('#fafafa').fill();
      }

      doc.fontSize(7).fillColor(DARK);
      let x = LEFT + 8;

      const values: Record<string, string> = {
        awb: order.awb_number,
        client: order.client_id ? clientNames.get(order.client_id) || '' : '',
        type: order.shipment_type.charAt(0).toUpperCase() + order.shipment_type.slice(1),
        status: formatStatus(order.status),
        route: `${order.origin_city} → ${order.destination_city}`,
        sender: order.sender_name,
        created: formatDate(order.created_at),
      };

      for (const col of cols) {
        doc.text(values[col.key], x, y + 5, { width: col.width - 8, lineBreak: false });
        x += col.width;
      }

      y += rowHeight;
    }

    doc.fontSize(7).fillColor(GRAY).text(`Page ${pageNum}`, LEFT, 545, { width: PAGE_WIDTH, align: 'center', lineBreak: false });

    doc.end();
    await new Promise<void>((resolve) => doc.on('end', resolve));
    return Buffer.concat(chunks);
  }
}

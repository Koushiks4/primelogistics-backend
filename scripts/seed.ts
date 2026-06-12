import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CITIES = [
  'Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune',
  'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Kochi', 'Chandigarh',
  'Goa', 'Indore', 'Nagpur', 'Coimbatore', 'Vizag', 'Mysore',
];

const INTERNATIONAL_CITIES = [
  'Dubai', 'Singapore', 'London', 'New York', 'Sydney', 'Tokyo',
  'Hong Kong', 'Kuala Lumpur', 'Bangkok', 'Toronto',
];

const PARTNERS = ['Delhivery', 'BlueDart', 'DTDC', 'Ekart', 'FedEx', 'DHL', 'Ecom Express'];

const STATUSES = ['booked', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'on_hold', 'returned', 'cancelled'] as const;
const STATUS_FLOW = ['booked', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'] as const;

const LEAD_SOURCES = ['manual', 'contact_us', 'shipment_enquiry', 'franchise_request'] as const;
const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: readonly T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 14) + 7, Math.floor(Math.random() * 60));
  return d.toISOString();
}

function randomPhone(): string {
  return `+91 ${9000000000 + Math.floor(Math.random() * 999999999)}`;
}

const FIRST_NAMES = ['Rahul', 'Priya', 'Arjun', 'Sneha', 'Vikram', 'Ananya', 'Rohan', 'Deepa', 'Karthik', 'Meera', 'Aditya', 'Kavya', 'Suresh', 'Lakshmi', 'Rajesh', 'Divya', 'Amit', 'Pooja', 'Sanjay', 'Neha'];
const LAST_NAMES = ['Sharma', 'Patel', 'Reddy', 'Kumar', 'Singh', 'Nair', 'Iyer', 'Gupta', 'Joshi', 'Verma', 'Das', 'Rao', 'Menon', 'Pillai', 'Agarwal', 'Malhotra', 'Choudhary', 'Bhat', 'Hegde', 'Desai'];

function randomName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function randomEmail(name: string): string {
  const clean = name.toLowerCase().replace(/\s+/g, '.');
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.co.in', 'business.com'];
  return `${clean}${Math.floor(Math.random() * 100)}@${pick(domains)}`;
}

function randomAddress(city: string): string {
  const streets = ['MG Road', 'Station Road', 'Gandhi Nagar', 'Ring Road', 'Park Street', 'Lake View', 'Industrial Area', 'Sector 5', 'Old Town', 'Commercial Street'];
  return `${Math.floor(Math.random() * 500) + 1}, ${pick(streets)}, ${city}`;
}

async function getAdminUserId(): Promise<string> {
  const { data } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single();
  if (!data) throw new Error('No admin user found. Create an admin user first.');
  return data.id;
}

async function seedOrders(adminId: string) {
  console.log('Seeding orders...');
  const orders = [];

  for (let i = 0; i < 50; i++) {
    const isInternational = Math.random() > 0.7;
    const originCity = pick(CITIES);
    const destinationCity = isInternational ? pick(INTERNATIONAL_CITIES) : pick(CITIES.filter(c => c !== originCity));
    const senderName = randomName();
    const receiverName = randomName();
    const hasPartner = Math.random() > 0.3;
    const createdAt = randomDate(90);

    // Determine status — weight toward common flows
    let status: typeof STATUSES[number];
    const roll = Math.random();
    if (roll < 0.35) status = 'delivered';
    else if (roll < 0.55) status = 'in_transit';
    else if (roll < 0.70) status = 'booked';
    else if (roll < 0.80) status = 'picked_up';
    else if (roll < 0.88) status = 'out_for_delivery';
    else if (roll < 0.93) status = 'on_hold';
    else if (roll < 0.97) status = 'returned';
    else status = 'cancelled';

    const { data: awb } = await supabase.rpc('generate_awb_number');

    orders.push({
      awb_number: awb,
      partner_name: hasPartner ? pick(PARTNERS) : null,
      partner_awb_number: hasPartner ? `${pick(PARTNERS).substring(0, 3).toUpperCase()}-${100000000 + Math.floor(Math.random() * 899999999)}` : null,
      shipment_type: isInternational ? 'international' : 'domestic',
      status,
      sender_name: senderName,
      sender_phone: randomPhone(),
      sender_email: randomEmail(senderName),
      sender_address: randomAddress(originCity),
      receiver_name: receiverName,
      receiver_phone: randomPhone(),
      receiver_email: randomEmail(receiverName),
      receiver_address: randomAddress(destinationCity),
      origin_city: originCity,
      destination_city: destinationCity,
      weight: Math.round((0.5 + Math.random() * 49.5) * 10) / 10,
      dimensions: Math.random() > 0.5 ? { length: 30 + Math.floor(Math.random() * 70), width: 20 + Math.floor(Math.random() * 50), height: 10 + Math.floor(Math.random() * 40), unit: 'cm' } : null,
      description: pick(['Electronics', 'Documents', 'Clothing', 'Machine Parts', 'Medical Supplies', 'Books', 'Furniture', 'Auto Parts', 'Food Products', 'Textiles']),
      special_instructions: Math.random() > 0.7 ? pick(['Handle with care', 'Fragile - glass inside', 'Keep upright', 'Temperature sensitive', 'Do not stack']) : null,
      created_by: adminId,
      created_at: createdAt,
    });
  }

  const { data: insertedOrders, error } = await supabase.from('orders').insert(orders).select('id, status, created_at');
  if (error) throw new Error(`Failed to seed orders: ${error.message}`);
  console.log(`  Created ${insertedOrders!.length} orders`);

  // Create status history for each order
  console.log('Seeding order status history...');
  const historyEntries = [];

  for (const order of insertedOrders!) {
    const statusIndex = STATUS_FLOW.indexOf(order.status as any);
    const isException = ['on_hold', 'returned', 'cancelled'].includes(order.status);
    const baseDate = new Date(order.created_at);

    // Always start with 'booked'
    historyEntries.push({
      order_id: order.id,
      status: 'booked',
      location: pick(CITIES),
      remarks: 'Order booked and AWB generated',
      updated_by: adminId,
      created_at: baseDate.toISOString(),
    });

    if (isException) {
      // For exception statuses, add booked → the exception
      historyEntries.push({
        order_id: order.id,
        status: order.status,
        location: pick(CITIES),
        remarks: order.status === 'on_hold' ? 'Shipment held due to address verification'
          : order.status === 'returned' ? 'Receiver not available, returning to origin'
          : 'Order cancelled by customer',
        updated_by: adminId,
        created_at: new Date(baseDate.getTime() + 3600000 * (1 + Math.floor(Math.random() * 24))).toISOString(),
      });
    } else if (statusIndex > 0) {
      // Walk through the status flow up to current status
      for (let s = 1; s <= statusIndex; s++) {
        const hoursLater = s * (6 + Math.floor(Math.random() * 18));
        historyEntries.push({
          order_id: order.id,
          status: STATUS_FLOW[s],
          location: s === statusIndex ? pick(CITIES) : pick(CITIES),
          remarks: STATUS_FLOW[s] === 'picked_up' ? 'Package collected from sender'
            : STATUS_FLOW[s] === 'in_transit' ? `Shipment in transit via ${pick(PARTNERS)} hub`
            : STATUS_FLOW[s] === 'out_for_delivery' ? 'Out for delivery to receiver'
            : 'Successfully delivered to receiver',
          updated_by: adminId,
          created_at: new Date(baseDate.getTime() + 3600000 * hoursLater).toISOString(),
        });
      }
    }
  }

  const { error: histError } = await supabase.from('order_status_history').insert(historyEntries);
  if (histError) throw new Error(`Failed to seed status history: ${histError.message}`);
  console.log(`  Created ${historyEntries.length} status history entries`);
}

async function seedLeads(adminId: string) {
  console.log('Seeding leads...');
  const leads = [];

  for (let i = 0; i < 30; i++) {
    const source = pick(LEAD_SOURCES);
    const name = randomName();
    const status = pick(LEAD_STATUSES);

    const base: Record<string, unknown> = {
      source,
      status,
      name,
      email: randomEmail(name),
      phone: randomPhone(),
      message: pick([
        'Looking for bulk shipping rates',
        'Need regular courier service for our business',
        'Interested in international shipping to Dubai',
        'Want to ship fragile items, need special packaging',
        'Need express delivery service for documents',
        'Looking for a logistics partner for e-commerce',
        'Enquiring about franchise opportunity in my city',
        'Need cold chain logistics for food products',
        null,
      ]),
      notes: status !== 'new' ? pick(['Follow up scheduled', 'Sent rate card via email', 'Meeting planned for next week', 'Customer comparing with competitors', null]) : null,
      assigned_to: Math.random() > 0.5 ? adminId : null,
      created_at: randomDate(60),
    };

    if (source === 'shipment_enquiry') {
      base.origin_city = pick(CITIES);
      base.destination_city = Math.random() > 0.5 ? pick(INTERNATIONAL_CITIES) : pick(CITIES);
      base.shipment_type = base.destination_city && INTERNATIONAL_CITIES.includes(base.destination_city as string) ? 'international' : 'domestic';
      base.approximate_weight = pick(['< 1 kg', '1-5 kg', '5-10 kg', '10-25 kg', '25-50 kg', '50+ kg']);
    }

    if (source === 'franchise_request') {
      base.city = pick(CITIES);
      base.investment_budget = pick(['5-10 Lakhs', '10-20 Lakhs', '20-50 Lakhs', '50+ Lakhs']);
      base.business_experience = pick(['No prior experience', '1-3 years in logistics', '5+ years in retail', 'Currently running a courier franchise', '10+ years in supply chain']);
    }

    leads.push(base);
  }

  const { error } = await supabase.from('leads').insert(leads);
  if (error) throw new Error(`Failed to seed leads: ${error.message}`);
  console.log(`  Created ${leads.length} leads`);
}

const CLIENT_COMPANIES = [
  { name: 'Acme Corp', email: 'billing@acmecorp.com', gstin: '29AABCU9603R1ZM' },
  { name: 'TechVista Solutions', email: 'accounts@techvista.in', gstin: '27AADCT1234R1ZP' },
  { name: 'GlobalTrade Inc', email: 'finance@globaltrade.com', gstin: '07AABCG5678R1Z2' },
  { name: 'FastRetail Pvt Ltd', email: 'billing@fastretail.co.in', gstin: '33AABCF9012R1ZK' },
  { name: 'MedSupply Co', email: 'accounts@medsupply.com', gstin: '06AABCM3456R1Z8' },
  { name: 'AutoParts Hub', email: 'finance@autopartshub.in', gstin: '24AABCA7890R1Z1' },
  { name: 'FreshFoods Ltd', email: 'billing@freshfoods.co.in', gstin: '19AABCF2345R1Z5' },
  { name: 'TexStyle Exports', email: 'accounts@texstyle.com', gstin: '36AABCT6789R1Z3' },
  { name: 'BuildMart Materials', email: 'finance@buildmart.in', gstin: '09AABCB0123R1Z7' },
  { name: 'EcoGreen Industries', email: 'billing@ecogreen.co.in', gstin: '32AABCE4567R1Z9' },
  { name: 'Sunrise Logistics', email: 'accounts@sunriselogistics.com', gstin: null },
  { name: 'Metro Distributors', email: 'billing@metrodist.in', gstin: '21AABCM8901R1Z4' },
  { name: 'Pinnacle Enterprises', email: 'finance@pinnacle.co.in', gstin: '08AABCP2345R1Z6' },
  { name: 'Zenith Pharma', email: 'accounts@zenithpharma.com', gstin: '27AABCZ6789R1Z0' },
  { name: 'Coastal Traders', email: 'billing@coastaltraders.in', gstin: null },
];

async function seedClients(adminId: string): Promise<Array<{ id: string; name: string; email: string | null; phone: string | null; address: string | null; gstin: string | null }>> {
  console.log('Seeding clients...');

  const clients = CLIENT_COMPANIES.map(c => ({
    name: c.name,
    email: c.email,
    phone: randomPhone(),
    address: randomAddress(pick(CITIES)),
    gstin: c.gstin,
    created_by: adminId,
  }));

  const { data, error } = await supabase.from('clients').insert(clients).select();
  if (error) throw new Error(`Failed to seed clients: ${error.message}`);
  console.log(`  Created ${data!.length} clients`);
  return data!;
}

async function seedInvoices(adminId: string, clients: Array<{ id: string; name: string; email: string | null; phone: string | null; address: string | null; gstin: string | null }>) {
  console.log('Seeding invoices...');

  const invoiceData = [];
  const allItems: { invoice_id: string; description: string; quantity: number; unit_price: number; amount: number }[] = [];

  const services = [
    { desc: 'Freight Charges - Domestic', min: 500, max: 5000 },
    { desc: 'Freight Charges - International', min: 3000, max: 25000 },
    { desc: 'Packaging & Handling', min: 100, max: 1000 },
    { desc: 'Insurance', min: 200, max: 2000 },
    { desc: 'Express Delivery Surcharge', min: 300, max: 3000 },
    { desc: 'Warehousing (per day)', min: 100, max: 500 },
    { desc: 'Customs Clearance', min: 1000, max: 5000 },
    { desc: 'Door Pickup Charges', min: 100, max: 500 },
    { desc: 'COD Handling Fee', min: 50, max: 200 },
    { desc: 'Documentation Charges', min: 200, max: 800 },
  ];

  for (let i = 0; i < 20; i++) {
    const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');
    const client = pick(clients);
    const status = pick(INVOICE_STATUSES);
    const invoiceDate = randomDate(60);
    const dueDate = new Date(new Date(invoiceDate).getTime() + 30 * 86400000).toISOString().split('T')[0];

    const itemCount = 1 + Math.floor(Math.random() * 4);
    const selectedServices = pickN(services, itemCount, itemCount);
    let subtotal = 0;
    const items = selectedServices.map(svc => {
      const qty = svc.desc.includes('per day') ? 1 + Math.floor(Math.random() * 10) : 1 + Math.floor(Math.random() * 3);
      const unitPrice = svc.min + Math.floor(Math.random() * (svc.max - svc.min));
      const amount = qty * unitPrice;
      subtotal += amount;
      return { description: svc.desc, quantity: qty, unit_price: unitPrice, amount };
    });

    const taxRate = pick([0.05, 0.12, 0.18]);
    const taxAmount = Math.round(subtotal * taxRate);
    const discountAmount = Math.random() > 0.7 ? Math.round(subtotal * 0.05) : 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    invoiceData.push({
      invoice_number: invoiceNumber,
      client_id: client.id,
      client_name: client.name,
      client_email: client.email,
      client_phone: client.phone,
      client_address: client.address,
      client_gstin: client.gstin,
      invoice_date: invoiceDate.split('T')[0],
      due_date: dueDate,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      status,
      notes: Math.random() > 0.6 ? pick(['Payment via NEFT', 'Quarterly billing client', 'Discount applied per agreement', 'Pending PO number', null]) : null,
      created_by: adminId,
      created_at: invoiceDate,
      _items: items,
    });
  }

  for (const inv of invoiceData) {
    const items = inv._items;
    delete (inv as any)._items;

    const { data: inserted, error } = await supabase.from('invoices').insert(inv).select('id').single();
    if (error) throw new Error(`Failed to seed invoice: ${error.message}`);

    const itemsWithId = items.map(item => ({ ...item, invoice_id: inserted!.id }));
    const { error: itemError } = await supabase.from('invoice_items').insert(itemsWithId);
    if (itemError) throw new Error(`Failed to seed invoice items: ${itemError.message}`);
  }

  console.log(`  Created ${invoiceData.length} invoices with line items`);
}

async function seedNotificationLogs(adminId: string) {
  console.log('Seeding notification logs...');

  const logs = [];
  for (let i = 0; i < 15; i++) {
    const type = pick(['email', 'whatsapp'] as const);
    logs.push({
      type,
      recipient: type === 'email' ? randomEmail(randomName()) : randomPhone(),
      subject: type === 'email' ? pick(['Shipment Booked', 'New Lead Notification', 'Invoice INV-2026-00001']) : null,
      content: pick([
        'Your shipment has been booked! Track at...',
        'A new lead has been submitted.',
        'Please find your invoice attached.',
      ]),
      status: pick(['sent', 'sent', 'sent', 'failed'] as const),
      related_type: pick(['order', 'lead', 'invoice']),
      error_message: Math.random() > 0.8 ? 'Connection timeout' : null,
      created_at: randomDate(30),
    });
  }

  const { error } = await supabase.from('notification_logs').insert(logs);
  if (error) throw new Error(`Failed to seed notification logs: ${error.message}`);
  console.log(`  Created ${logs.length} notification log entries`);
}

async function main() {
  console.log('\nPrime Logistics — Database Seed Script\n');

  const adminId = await getAdminUserId();
  console.log(`Using admin user: ${adminId}\n`);

  await seedOrders(adminId);
  await seedLeads(adminId);
  const clients = await seedClients(adminId);
  await seedInvoices(adminId, clients);
  await seedNotificationLogs(adminId);

  console.log('\nSeed complete!\n');
  console.log('Summary:');
  console.log('  - 50 orders (with status history for each)');
  console.log('  - 30 leads (across all 4 sources)');
  console.log('  - 15 clients');
  console.log('  - 20 invoices (linked to clients, with line items)');
  console.log('  - 15 notification log entries');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

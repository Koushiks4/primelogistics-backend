import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FastifyInstance } from 'fastify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') });

export interface TestContext {
  app: FastifyInstance;
  adminToken: string;
  staffToken: string;
  adminUser: { id: string; email: string; full_name: string; role: string };
  staffUser: { id: string; email: string; full_name: string; role: string };
  createdIds: {
    orders: string[];
    leads: string[];
    invoices: string[];
    clients: string[];
  };
  testRunStartTime: string;
}

export function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

export async function setupTestContext(): Promise<TestContext> {
  const { buildApp } = await import('../../../src/app.js');
  const app = await buildApp();
  await app.ready();

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    },
  });

  if (adminLogin.statusCode !== 200) {
    await app.close();
    throw new Error(
      `Admin login failed (${adminLogin.statusCode}): ${adminLogin.body}. ` +
      `Check TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env.test`
    );
  }

  const adminData = adminLogin.json();

  const staffLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: process.env.TEST_STAFF_EMAIL,
      password: process.env.TEST_STAFF_PASSWORD,
    },
  });

  if (staffLogin.statusCode !== 200) {
    await app.close();
    throw new Error(
      `Staff login failed (${staffLogin.statusCode}): ${staffLogin.body}. ` +
      `Check TEST_STAFF_EMAIL and TEST_STAFF_PASSWORD in .env.test`
    );
  }

  const staffData = staffLogin.json();

  return {
    app,
    adminToken: adminData.access_token,
    staffToken: staffData.access_token,
    adminUser: adminData.user,
    staffUser: staffData.user,
    createdIds: { orders: [], leads: [], invoices: [], clients: [] },
    testRunStartTime: new Date().toISOString(),
  };
}

export async function teardownTestContext(ctx: TestContext | undefined) {
  if (!ctx?.app) return;
  const supabase = ctx.app.supabase;

  if (ctx.createdIds.orders.length) {
    await supabase.from('order_status_history').delete().in('order_id', ctx.createdIds.orders);
    await supabase.from('orders').delete().in('id', ctx.createdIds.orders);
  }

  if (ctx.createdIds.clients.length) {
    await supabase.from('clients').delete().in('id', ctx.createdIds.clients);
  }

  if (ctx.createdIds.invoices.length) {
    await supabase.from('invoice_items').delete().in('invoice_id', ctx.createdIds.invoices);
    await supabase.from('invoices').delete().in('id', ctx.createdIds.invoices);
  }

  if (ctx.createdIds.leads.length) {
    await supabase.from('leads').delete().in('id', ctx.createdIds.leads);
  }

  await supabase.from('notification_logs').delete().gte('created_at', ctx.testRunStartTime);

  await ctx.app.close();
}

export const VALID_ORDER = {
  shipment_type: 'domestic' as const,
  sender_name: 'Integration Test Sender',
  sender_phone: '9876543210',
  sender_email: 'sender@test.com',
  sender_address: '123 Test Street, Bangalore',
  receiver_name: 'Integration Test Receiver',
  receiver_phone: '9876543211',
  receiver_email: 'receiver@test.com',
  receiver_address: '456 Test Avenue, Mumbai',
  origin_city: 'Bangalore',
  destination_city: 'Mumbai',
};

export const VALID_INVOICE = {
  client_name: 'Integration Test Client',
  client_email: 'testclient@example.com',
  client_phone: '9876543212',
  client_address: '789 Test Road, Delhi',
  invoice_date: '2026-06-12',
  due_date: '2026-07-12',
  subtotal: 5000,
  tax_amount: 900,
  discount_amount: 0,
  total_amount: 5900,
  items: [
    { description: 'Freight Charges', quantity: 1, unit_price: 3000, amount: 3000 },
    { description: 'Packaging', quantity: 2, unit_price: 1000, amount: 2000 },
  ],
};

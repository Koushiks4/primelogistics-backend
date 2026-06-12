import { z } from 'zod';
import { INVOICE_STATUSES } from '../../types.js';

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit_price: z.number().positive(),
  amount: z.number().positive(),
});

export const createInvoiceSchema = z.object({
  client_name: z.string().min(1),
  client_email: z.string().email().optional(),
  client_phone: z.string().optional(),
  client_address: z.string().optional(),
  client_gstin: z.string().optional(),
  invoice_date: z.string().min(1),
  due_date: z.string().optional(),
  subtotal: z.number().nonnegative(),
  tax_amount: z.number().nonnegative().default(0),
  discount_amount: z.number().nonnegative().default(0),
  total_amount: z.number().positive(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
});

export const updateInvoiceSchema = z.object({
  client_name: z.string().min(1).optional(),
  client_email: z.string().email().optional(),
  client_phone: z.string().optional(),
  client_address: z.string().optional(),
  client_gstin: z.string().optional(),
  invoice_date: z.string().optional(),
  due_date: z.string().nullable().optional(),
  subtotal: z.number().nonnegative().optional(),
  tax_amount: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
  total_amount: z.number().positive().optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  notes: z.string().optional(),
});

export const addItemSchema = invoiceItemSchema;

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(INVOICE_STATUSES).optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

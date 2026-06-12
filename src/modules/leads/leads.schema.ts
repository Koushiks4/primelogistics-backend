import { z } from 'zod';
import { LEAD_SOURCES, LEAD_STATUSES, SHIPMENT_TYPES } from '../../types.js';

export const createLeadSchema = z.object({
  source: z.enum(LEAD_SOURCES),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
  origin_city: z.string().optional(),
  destination_city: z.string().optional(),
  shipment_type: z.enum(SHIPMENT_TYPES).optional(),
  approximate_weight: z.string().optional(),
  city: z.string().optional(),
  investment_budget: z.string().optional(),
  business_experience: z.string().optional(),
});

export const updateLeadSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  notes: z.string().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  source: z.enum(LEAD_SOURCES).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;

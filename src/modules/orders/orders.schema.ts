import { z } from 'zod';
import { ORDER_STATUSES, SHIPMENT_TYPES } from '../../types.js';

export const createOrderSchema = z.object({
  awb_number: z.string().optional(),
  partner_name: z.string().optional(),
  partner_awb_number: z.string().optional(),
  shipment_type: z.enum(SHIPMENT_TYPES),
  sender_name: z.string().min(1),
  sender_phone: z.string().min(1),
  sender_email: z.string().email().optional(),
  sender_address: z.string().min(1),
  receiver_name: z.string().min(1),
  receiver_phone: z.string().min(1),
  receiver_email: z.string().email().optional(),
  receiver_address: z.string().min(1),
  origin_city: z.string().min(1),
  destination_city: z.string().min(1),
  weight: z.number().positive().optional(),
  dimensions: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
      unit: z.enum(['cm', 'in']),
    })
    .optional(),
  description: z.string().optional(),
  special_instructions: z.string().optional(),
});

export const updateOrderSchema = createOrderSchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  location: z.string().optional(),
  remarks: z.string().optional(),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(ORDER_STATUSES).optional(),
  shipment_type: z.enum(SHIPMENT_TYPES).optional(),
  search: z.string().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

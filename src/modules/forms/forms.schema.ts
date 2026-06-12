import { z } from 'zod';
import { SHIPMENT_TYPES } from '../../types.js';

export const contactUsSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  message: z.string().min(1),
});

export const shipmentEnquirySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  origin_city: z.string().min(1),
  destination_city: z.string().min(1),
  shipment_type: z.enum(SHIPMENT_TYPES),
  approximate_weight: z.string().optional(),
  message: z.string().optional(),
});

export const franchiseRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  city: z.string().min(1),
  investment_budget: z.string().min(1),
  business_experience: z.string().optional(),
  message: z.string().optional(),
});

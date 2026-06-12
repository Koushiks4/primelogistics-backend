export const ORDER_STATUSES = [
  'booked',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'on_hold',
  'returned',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SHIPMENT_TYPES = ['domestic', 'international'] as const;
export type ShipmentType = (typeof SHIPMENT_TYPES)[number];

export const LEAD_SOURCES = [
  'manual',
  'contact_us',
  'shipment_enquiry',
  'franchise_request',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'converted',
  'lost',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const NOTIFICATION_TYPES = ['email', 'whatsapp'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const USER_ROLES = ['admin', 'staff'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
  }
}

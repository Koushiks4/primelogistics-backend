import type { OrderStatus } from '../../types.js';

const STATUS_MAP: Record<string, OrderStatus> = {
  'OM': 'booked',
  'PP': 'picked_up',
  'IT': 'in_transit',
  'OO': 'out_for_delivery',
  'DL': 'delivered',
  'UD': 'delivered',
  'RT': 'returned',
  'CN': 'cancelled',
  'OP': 'on_hold',
};

export class DelhiveryService {
  private apiUrl: string;
  private apiToken: string;

  constructor() {
    this.apiUrl = process.env.DELHIVERY_API_URL || 'https://track.delhivery.com/api/v1/packages/json';
    this.apiToken = process.env.DELHIVERY_API_TOKEN || '';
  }

  mapStatusCode(code: string): OrderStatus | null {
    return STATUS_MAP[code.toUpperCase()] || null;
  }

  mapStatusLabel(label: string): OrderStatus | null {
    const normalized = label.toLowerCase().trim();
    if (normalized.includes('manifest')) return 'booked';
    if (normalized.includes('picked up') || normalized.includes('pickup')) return 'picked_up';
    if (normalized.includes('in transit') || normalized.includes('transit')) return 'in_transit';
    if (normalized.includes('out for delivery')) return 'out_for_delivery';
    if (normalized.includes('delivered')) return 'delivered';
    if (normalized.includes('rto') || normalized.includes('return')) return 'returned';
    if (normalized.includes('cancel')) return 'cancelled';
    if (normalized.includes('pending') || normalized.includes('hold')) return 'on_hold';
    return null;
  }

  async fetchTrackingStatus(waybill: string): Promise<{
    status: OrderStatus | null;
    location: string | null;
    remarks: string | null;
    rawResponse: any;
  }> {
    if (!this.apiToken) {
      throw new Error('DELHIVERY_API_TOKEN is not configured');
    }

    const url = `${this.apiUrl}/?waybill=${encodeURIComponent(waybill)}&token=${this.apiToken}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Delhivery API returned ${response.status}`);
    }

    const data = await response.json();
    const shipment = data?.ShipmentData?.[0]?.Shipment;

    if (!shipment) {
      return { status: null, location: null, remarks: null, rawResponse: data };
    }

    const statusInfo = shipment.Status;
    const statusCode = statusInfo?.StatusType || '';
    const statusLabel = statusInfo?.Status || '';

    const mappedStatus = this.mapStatusCode(statusCode) || this.mapStatusLabel(statusLabel);

    return {
      status: mappedStatus,
      location: statusInfo?.StatusLocation || null,
      remarks: statusInfo?.Instructions || statusLabel || null,
      rawResponse: data,
    };
  }
}

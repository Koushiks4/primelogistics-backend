import { SupabaseClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import type { UserRole } from '../../types.js';

interface DashboardQuery { from_date?: string; to_date?: string; client_id?: string; }

export class DashboardService {
  constructor(private supabase: SupabaseClient, private redis: Redis) {}

  async getStats(query: DashboardQuery, userRole: UserRole) {
    const cacheKey = `dashboard:${query.from_date || 'all'}:${query.to_date || 'all'}:${query.client_id || 'all'}:${userRole}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;

    const [orders, leads, revenue, clients] = await Promise.all([
      this.getOrderStats(query),
      this.getLeadStats(query),
      userRole === 'admin' ? this.getRevenueStats(query) : null,
      this.getClientStats(query),
    ]);

    const result: Record<string, unknown> = { orders, leads, clients };
    if (revenue) result.revenue = revenue;

    await this.redis.set(cacheKey, JSON.stringify(result), { ex: 300 });
    return result;
  }

  private async getOrderStats(query: DashboardQuery) {
    let q = this.supabase.from('orders').select('status, shipment_type', { count: 'exact' }).is('deleted_at', null);
    if (query.from_date) q = q.gte('created_at', query.from_date);
    if (query.to_date) q = q.lte('created_at', query.to_date);
    if (query.client_id) q = q.eq('client_id', query.client_id);
    const { data, count } = await q;
    const rows = data ?? [];
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      byType[row.shipment_type] = (byType[row.shipment_type] || 0) + 1;
    }
    return { total: count ?? 0, byStatus, byType };
  }

  private async getLeadStats(query: DashboardQuery) {
    let q = this.supabase.from('leads').select('source, status', { count: 'exact' });
    if (query.from_date) q = q.gte('created_at', query.from_date);
    if (query.to_date) q = q.lte('created_at', query.to_date);
    const { data, count } = await q;
    const rows = data ?? [];
    const bySource: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const row of rows) {
      bySource[row.source] = (bySource[row.source] || 0) + 1;
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    }
    return { total: count ?? 0, bySource, byStatus };
  }

  private async getRevenueStats(query: DashboardQuery) {
    let q = this.supabase.from('invoices').select('total_amount, status, client_id');
    if (query.from_date) q = q.gte('invoice_date', query.from_date);
    if (query.to_date) q = q.lte('invoice_date', query.to_date);
    if (query.client_id) q = q.eq('client_id', query.client_id);
    const { data } = await q;
    const rows = data ?? [];
    let invoiced = 0, paid = 0;
    for (const row of rows) {
      if (row.status !== 'cancelled') invoiced += Number(row.total_amount);
      if (row.status === 'paid') paid += Number(row.total_amount);
    }
    return { invoiced, paid, outstanding: invoiced - paid };
  }

  private async getClientStats(query: DashboardQuery) {
    let orderQ = this.supabase.from('orders').select('client_id').is('deleted_at', null).not('client_id', 'is', null);
    if (query.from_date) orderQ = orderQ.gte('created_at', query.from_date);
    if (query.to_date) orderQ = orderQ.lte('created_at', query.to_date);
    if (query.client_id) orderQ = orderQ.eq('client_id', query.client_id);
    const { data: orderRows } = await orderQ;

    const clientOrderCounts: Record<string, number> = {};
    for (const row of orderRows ?? []) {
      clientOrderCounts[row.client_id] = (clientOrderCounts[row.client_id] || 0) + 1;
    }
    const totalActive = Object.keys(clientOrderCounts).length;

    const sortedClientIds = Object.entries(clientOrderCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let topByOrders: { name: string; count: number }[] = [];
    if (sortedClientIds.length > 0) {
      const { data: clientNames } = await this.supabase
        .from('clients')
        .select('id, name')
        .in('id', sortedClientIds.map(([id]) => id));

      const nameMap = new Map((clientNames ?? []).map((c) => [c.id, c.name]));
      topByOrders = sortedClientIds.map(([id, count]) => ({
        name: nameMap.get(id) || 'Unknown',
        count,
      }));
    }

    let clientQ = this.supabase.from('clients').select('id', { count: 'exact' });
    if (query.from_date) clientQ = clientQ.gte('created_at', query.from_date);
    if (query.to_date) clientQ = clientQ.lte('created_at', query.to_date);
    const { count: newCount } = await clientQ;

    return { totalActive, newThisPeriod: newCount ?? 0, topByOrders };
  }
}

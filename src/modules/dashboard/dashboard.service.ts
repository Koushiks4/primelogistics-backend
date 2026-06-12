import { SupabaseClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import type { UserRole } from '../../types.js';

interface DashboardQuery { from_date?: string; to_date?: string; }

export class DashboardService {
  constructor(private supabase: SupabaseClient, private redis: Redis) {}

  async getStats(query: DashboardQuery, userRole: UserRole) {
    const cacheKey = `dashboard:${query.from_date || 'all'}:${query.to_date || 'all'}:${userRole}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;

    const [orders, leads, revenue] = await Promise.all([
      this.getOrderStats(query),
      this.getLeadStats(query),
      userRole === 'admin' ? this.getRevenueStats(query) : null,
    ]);

    const result: Record<string, unknown> = { orders, leads };
    if (revenue) result.revenue = revenue;

    await this.redis.set(cacheKey, JSON.stringify(result), { ex: 300 });
    return result;
  }

  private async getOrderStats(query: DashboardQuery) {
    let q = this.supabase.from('orders').select('status, shipment_type', { count: 'exact' }).is('deleted_at', null);
    if (query.from_date) q = q.gte('created_at', query.from_date);
    if (query.to_date) q = q.lte('created_at', query.to_date);
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
    let q = this.supabase.from('invoices').select('total_amount, status');
    if (query.from_date) q = q.gte('invoice_date', query.from_date);
    if (query.to_date) q = q.lte('invoice_date', query.to_date);
    const { data } = await q;
    const rows = data ?? [];
    let invoiced = 0, paid = 0;
    for (const row of rows) {
      if (row.status !== 'cancelled') invoiced += Number(row.total_amount);
      if (row.status === 'paid') paid += Number(row.total_amount);
    }
    return { invoiced, paid, outstanding: invoiced - paid };
  }
}

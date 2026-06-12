import Fastify, { FastifyInstance } from 'fastify';
import supabasePlugin from './plugins/supabase.js';
import redisPlugin from './plugins/redis.js';
import corsPlugin from './plugins/cors.js';
import authPlugin from './plugins/auth.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import authRoutes from './modules/auth/auth.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import leadsRoutes from './modules/leads/leads.routes.js';
import clientsRoutes from './modules/clients/clients.routes.js';
import formsRoutes from './modules/forms/forms.routes.js';
import trackingRoutes from './modules/tracking/tracking.routes.js';
import invoicesRoutes from './modules/invoices/invoices.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import { NotificationService } from './modules/notifications/notification.service.js';
import { EmailAdapter } from './modules/notifications/email.adapter.js';
import { WhatsAppAdapter } from './modules/notifications/whatsapp.adapter.js';
import partnerSyncPlugin from './modules/partners/partner-sync.plugin.js';
import webhookRoutes from './modules/partners/webhook.routes.js';
import partnerSyncRoutes from './modules/partners/partner-sync.routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    notifications: NotificationService;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Plugins
  await app.register(corsPlugin);
  await app.register(supabasePlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);
  await app.register(partnerSyncPlugin);

  // Notification service
  const notifications = new NotificationService(app.supabase);
  notifications.registerAdapter('email', new EmailAdapter());
  notifications.registerAdapter('whatsapp', new WhatsAppAdapter());
  app.decorate('notifications', notifications);

  // Health check
  app.get('/api/health', async () => ({ status: 'ok' }));

  // Public routes
  await app.register(authRoutes);
  await app.register(formsRoutes);
  await app.register(trackingRoutes);
  await app.register(webhookRoutes);

  // Admin routes
  await app.register(ordersRoutes);
  await app.register(leadsRoutes);
  await app.register(clientsRoutes);
  await app.register(invoicesRoutes);
  await app.register(usersRoutes);
  await app.register(dashboardRoutes);
  await app.register(partnerSyncRoutes);

  return app;
}

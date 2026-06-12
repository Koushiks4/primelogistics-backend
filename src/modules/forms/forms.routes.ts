import { FastifyInstance } from 'fastify';
import { LeadsService } from '../leads/leads.service.js';
import { contactUsSchema, shipmentEnquirySchema, franchiseRequestSchema } from './forms.schema.js';

export default async function formsRoutes(fastify: FastifyInstance) {
  const leadsService = new LeadsService(fastify.supabase);

  fastify.post('/api/forms/contact-us', { config: { rateLimit: true } }, async (request, reply) => {
    const parsed = contactUsSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    const lead = await leadsService.create({ ...parsed.data, source: 'contact_us' });
    fastify.notifications.sendNewLeadNotification(lead).catch((err) => fastify.log.error(err, 'Failed to send lead notification'));
    return reply.status(201).send({ message: 'Thank you for contacting us. We will get back to you soon.' });
  });

  fastify.post('/api/forms/shipment-enquiry', { config: { rateLimit: true } }, async (request, reply) => {
    const parsed = shipmentEnquirySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    const lead = await leadsService.create({ ...parsed.data, source: 'shipment_enquiry' });
    fastify.notifications.sendNewLeadNotification(lead).catch((err) => fastify.log.error(err, 'Failed to send lead notification'));
    return reply.status(201).send({ message: 'Your shipment enquiry has been received. We will contact you shortly.' });
  });

  fastify.post('/api/forms/franchise-request', { config: { rateLimit: true } }, async (request, reply) => {
    const parsed = franchiseRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    const lead = await leadsService.create({ ...parsed.data, source: 'franchise_request' });
    fastify.notifications.sendNewLeadNotification(lead).catch((err) => fastify.log.error(err, 'Failed to send lead notification'));
    return reply.status(201).send({ message: 'Your franchise request has been received. Our team will review and contact you.' });
  });
}

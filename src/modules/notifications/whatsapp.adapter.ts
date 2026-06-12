import type { NotificationAdapter, NotificationPayload } from './notification.service.js';

export class WhatsAppAdapter implements NotificationAdapter {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_WHATSAPP_FROM || '';
  }

  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    if (!this.accountSid || !this.authToken) return { success: false, error: 'Twilio credentials not configured' };
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const body = new URLSearchParams({ From: this.fromNumber, To: `whatsapp:${payload.recipient}`, Body: payload.content });
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!response.ok) { const error = await response.text(); return { success: false, error }; }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}

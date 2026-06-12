import type { NotificationAdapter, NotificationPayload } from './notification.service.js';

export class EmailAdapter implements NotificationAdapter {
  private apiKey: string;
  private fromEmail: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || '';
    this.fromEmail = process.env.NOTIFICATION_FROM_EMAIL || 'noreply@primelogisticservice.com';
  }

  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.fromEmail, to: [payload.recipient], subject: payload.subject || 'Prime Logistic Services', text: payload.content }),
      });
      if (!response.ok) { const error = await response.text(); return { success: false, error }; }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}

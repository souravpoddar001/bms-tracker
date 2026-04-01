import { EmailClient } from '@azure/communication-email';
import type { Tracker } from './types';
import { getSettings, updateSettings } from './db';

const RATE_LIMIT_MINUTES = 30;

/**
 * Send booking-found alert to all configured recipients.
 */
export async function sendBookingAlert(tracker: Tracker): Promise<boolean> {
  const settings = await getSettings();
  if (settings.notificationEmails.length === 0) {
    console.log('[Email] No notification emails configured');
    return false;
  }

  const subject = `Bookings Open: ${tracker.movieTitle} - ${tracker.formatLabel}`;
  const showsList = (tracker.showsFound || [])
    .map((s) => `  - ${s.venue} at ${s.time} (${s.screenAttr})`)
    .join('\n');

  const body = [
    `Bookings are now open for ${tracker.movieTitle}!`,
    '',
    `Format: ${tracker.formatLabel}`,
    `City: ${tracker.cityName}`,
    `Date: ${tracker.date}`,
    '',
    'Available shows:',
    showsList || '  (Check BookMyShow for details)',
    '',
    `Book now: ${tracker.bookingUrl || 'https://in.bookmyshow.com'}`,
  ].join('\n');

  const results = await Promise.all(
    settings.notificationEmails.map((email) => sendEmail(email, subject, body))
  );
  return results.some((r) => r);
}

/**
 * Send error notification when consecutive failures exceed threshold.
 */
export async function sendErrorAlert(tracker: Tracker): Promise<boolean> {
  const settings = await getSettings();
  if (settings.notificationEmails.length === 0) return false;

  const subject = `BMS Tracker Error: ${tracker.movieTitle}`;
  const body = [
    `The tracker for "${tracker.movieTitle}" (${tracker.formatLabel}) has failed ${tracker.consecutiveErrors} times in a row.`,
    '',
    `Last error: ${tracker.lastError || 'Unknown'}`,
    '',
    'The tracker will keep retrying. If this persists, BookMyShow may have changed their page structure.',
  ].join('\n');

  const results = await Promise.all(
    settings.notificationEmails.map((email) => sendEmail(email, subject, body))
  );
  return results.some((r) => r);
}

/**
 * Send a test email to all configured recipients (rate limited).
 */
export async function sendTestEmail(): Promise<{ success: boolean; rateLimited?: boolean; retryAfterMs?: number }> {
  const settings = await getSettings();
  if (settings.notificationEmails.length === 0) {
    return { success: false };
  }

  if (settings.lastTestEmailSent) {
    const elapsed = Date.now() - new Date(settings.lastTestEmailSent).getTime();
    const limitMs = RATE_LIMIT_MINUTES * 60 * 1000;
    if (elapsed < limitMs) {
      return { success: false, rateLimited: true, retryAfterMs: limitMs - elapsed };
    }
  }

  const results = await Promise.all(
    settings.notificationEmails.map((email) =>
      sendEmail(
        email,
        'BMS Tracker - Test Email',
        'This is a test email from your BMS Tracker app.\n\nIf you received this, email notifications are working correctly!'
      )
    )
  );

  const success = results.some((r) => r);
  if (success) {
    await updateSettings({ lastTestEmailSent: new Date().toISOString() });
  }
  return { success };
}

/**
 * Send an email via Azure Communication Services.
 */
async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const connectionString = process.env.AZURE_COMMUNICATION_ENDPOINT;
  const senderEmail = process.env.AZURE_SENDER_EMAIL;

  if (!connectionString || !senderEmail) {
    console.log('═══════════════════════════════════════');
    console.log(`[Email] To: ${to}`);
    console.log(`[Email] Subject: ${subject}`);
    console.log(`[Email] Body:\n${body}`);
    console.log('═══════════════════════════════════════');
    return false;
  }

  try {
    const client = new EmailClient(connectionString);
    const poller = await client.beginSend({
      senderAddress: senderEmail,
      content: { subject, plainText: body },
      recipients: { to: [{ address: to }] },
    });
    const result = await poller.pollUntilDone();
    console.log(`[Email] Sent to ${to}, status: ${result.status}`);
    return result.status === 'Succeeded';
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}:`, error);
    return false;
  }
}

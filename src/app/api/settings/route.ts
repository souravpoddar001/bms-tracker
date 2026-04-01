import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/settings — Returns settings with masked emails
export async function GET() {
  try {
    const settings = await db.getSettings();
    return NextResponse.json({
      maskedEmails: (settings.notificationEmails || []).map(maskEmail),
      emailCount: (settings.notificationEmails || []).length,
      lastTestEmailSent: settings.lastTestEmailSent,
    });
  } catch (error) {
    console.error('Failed to get settings:', error);
    return NextResponse.json({ maskedEmails: [], emailCount: 0, lastTestEmailSent: null });
  }
}

// PUT /api/settings — Add or remove emails
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { action, email } = body;

    const settings = await db.getSettings();

    if (action === 'add' && email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
      if (settings.notificationEmails.includes(email)) {
        return NextResponse.json({ error: 'Email already added' }, { status: 409 });
      }
      settings.notificationEmails.push(email);
    } else if (action === 'remove' && typeof body.index === 'number') {
      if (body.index >= 0 && body.index < settings.notificationEmails.length) {
        settings.notificationEmails.splice(body.index, 1);
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updated = await db.updateSettings({
      notificationEmails: settings.notificationEmails,
    });

    return NextResponse.json({
      maskedEmails: updated.notificationEmails.map(maskEmail),
      emailCount: updated.notificationEmails.length,
      lastTestEmailSent: updated.lastTestEmailSent,
    });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

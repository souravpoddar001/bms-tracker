import { NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email-service';

// POST /api/test-email — Send a test email (rate limited to once per 30 min)
export async function POST() {
  try {
    const result = await sendTestEmail();

    if (result.rateLimited) {
      const minutesLeft = Math.ceil((result.retryAfterMs || 0) / 60000);
      return NextResponse.json(
        { error: `Rate limited. Try again in ${minutesLeft} minute(s).`, retryAfterMs: result.retryAfterMs },
        { status: 429 }
      );
    }

    if (result.success) {
      return NextResponse.json({ message: 'Test email sent to all configured addresses' });
    } else {
      return NextResponse.json(
        { error: 'Failed to send test email. Check email configuration.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Test email failed:', error);
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 });
  }
}

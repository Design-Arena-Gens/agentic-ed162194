import { NextResponse } from 'next/server';
import { getQueue, ScheduledMessage } from '@/lib/queue';
import { sendTelegramMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function GET() {
  const queue = getQueue();
  const now = Date.now();
  const batchSize = 100;

  const due = await queue.claimDue(now, batchSize);
  const results: Array<{ id: string; ok: boolean; attempts: number; error?: string }> = [];

  for (const m of due) {
    try {
      const res = await sendTelegramMessage({ botToken: m.botToken, chatId: m.chatId, text: m.text });
      if (res.ok) {
        await queue.complete(m.id, m);
        results.push({ id: m.id, ok: true, attempts: m.attempts });
      } else {
        const nextTime = now + Math.min(5 * 60_000, Math.pow(2, Math.max(0, m.attempts)) * 1_000); // exp backoff up to 5min
        await queue.reschedule(m.id, m, nextTime);
        results.push({ id: m.id, ok: false, attempts: m.attempts + 1, error: res.description || 'Unknown Telegram error' });
      }
    } catch (e: any) {
      const nextTime = now + Math.min(5 * 60_000, Math.pow(2, Math.max(0, m.attempts)) * 1_000);
      await queue.reschedule(m.id, m, nextTime);
      results.push({ id: m.id, ok: false, attempts: m.attempts + 1, error: e?.message || 'Send failed' });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

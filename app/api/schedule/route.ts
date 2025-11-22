import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createMessage, getQueue } from '@/lib/queue';
import { getEnv } from '@/lib/env';

const BodySchema = z.object({
  botToken: z.string().min(10).optional(),
  chatIds: z.union([z.string(), z.array(z.string())]),
  text: z.string().min(1),
  delayMinutes: z.number().min(0).max(1440).default(10),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = BodySchema.parse({
      ...json,
      delayMinutes: typeof json.delayMinutes === 'string' ? parseInt(json.delayMinutes, 10) : json.delayMinutes,
    });

    const env = getEnv();
    const botToken = parsed.botToken || env.defaultBotToken;
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token is required (body.botToken or TELEGRAM_DEFAULT_BOT_TOKEN env)' }, { status: 400 });
    }

    const chatIdList = Array.isArray(parsed.chatIds)
      ? parsed.chatIds
      : parsed.chatIds.split(',').map((s: string) => s.trim()).filter(Boolean);

    const now = Date.now();
    const sendAtMs = now + (parsed.delayMinutes ?? 10) * 60_000;

    const messages = chatIdList.map(chatId => createMessage({ chatId, text: parsed.text, sendAtMs, botToken }));

    const queue = getQueue();
    await queue.enqueue(messages);

    return NextResponse.json({ ok: true, count: messages.length, sendAtMs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid request' }, { status: 400 });
  }
}

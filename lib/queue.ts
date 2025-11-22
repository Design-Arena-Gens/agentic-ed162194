import { Redis } from '@upstash/redis';
import { getEnv } from './env';

export type ScheduledMessage = {
  id: string;
  chatId: string;
  text: string;
  sendAtMs: number;
  botToken: string;
  attempts: number;
  createdAtMs: number;
};

export interface QueueProvider {
  enqueue(messages: ScheduledMessage[]): Promise<void>;
  claimDue(nowMs: number, limit: number): Promise<ScheduledMessage[]>;
  complete(id: string, payload: ScheduledMessage): Promise<void>;
  reschedule(id: string, payload: ScheduledMessage, newSendAtMs: number): Promise<void>;
}

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createMessage(params: Omit<ScheduledMessage, 'id' | 'attempts' | 'createdAtMs'>): ScheduledMessage {
  return {
    id: randomId(),
    attempts: 0,
    createdAtMs: Date.now(),
    ...params,
  };
}

class UpstashQueue implements QueueProvider {
  private redis: Redis;
  private keyZset = 'tg:schedule:zset:v1';
  private keySent = 'tg:sent:set:v1';
  private lockPrefix = 'tg:lock:';

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async enqueue(messages: ScheduledMessage[]): Promise<void> {
    if (messages.length === 0) return;
    const args: (string | number)[] = [];
    for (const m of messages) {
      args.push(m.sendAtMs, JSON.stringify(m));
    }
    // ZADD score1 member1 score2 member2 ...
    await this.redis.zadd(this.keyZset, ...args as any);
  }

  async claimDue(nowMs: number, limit: number): Promise<ScheduledMessage[]> {
    // Fetch due
    const due = await this.redis.zrangebyscore(this.keyZset, 0, nowMs, {
      byScore: true,
      limit: { offset: 0, count: limit },
    }) as string[];

    const claimed: ScheduledMessage[] = [];
    for (const raw of due) {
      const msg: ScheduledMessage = JSON.parse(raw);
      const lockKey = this.lockPrefix + msg.id;
      // Acquire a short lock to prevent duplicate processing
      const locked = await this.redis.set(lockKey, '1', { nx: true, ex: 300 });
      if (!locked) continue;
      // We only remove from zset after successful send to avoid message loss on crash
      claimed.push(msg);
    }
    return claimed;
  }

  async complete(id: string, payload: ScheduledMessage): Promise<void> {
    const raw = JSON.stringify(payload);
    // Remove from zset and add to sent set
    await this.redis.multi()
      .zrem(this.keyZset, raw)
      .sadd(this.keySent, id)
      .del(this.lockPrefix + id)
      .exec();
  }

  async reschedule(id: string, payload: ScheduledMessage, newSendAtMs: number): Promise<void> {
    const updated: ScheduledMessage = { ...payload, sendAtMs: newSendAtMs, attempts: payload.attempts + 1 };
    const prevRaw = JSON.stringify(payload);
    const newRaw = JSON.stringify(updated);
    await this.redis.multi()
      .zrem(this.keyZset, prevRaw)
      .zadd(this.keyZset, { score: newSendAtMs, member: newRaw })
      .del(this.lockPrefix + id)
      .exec();
  }
}

class InMemoryQueue implements QueueProvider {
  private items: ScheduledMessage[] = [];
  private locks = new Set<string>();
  private sent = new Set<string>();

  async enqueue(messages: ScheduledMessage[]): Promise<void> {
    this.items.push(...messages);
  }

  async claimDue(nowMs: number, limit: number): Promise<ScheduledMessage[]> {
    const due = this.items
      .filter(m => m.sendAtMs <= nowMs && !this.locks.has(m.id))
      .slice(0, limit);
    for (const m of due) this.locks.add(m.id);
    return due;
  }

  async complete(id: string, payload: ScheduledMessage): Promise<void> {
    this.items = this.items.filter(m => m.id !== id);
    this.locks.delete(id);
    this.sent.add(id);
  }

  async reschedule(id: string, payload: ScheduledMessage, newSendAtMs: number): Promise<void> {
    const idx = this.items.findIndex(m => m.id === id);
    if (idx >= 0) {
      this.items[idx] = { ...payload, sendAtMs: newSendAtMs, attempts: payload.attempts + 1 };
    } else {
      this.items.push({ ...payload, sendAtMs: newSendAtMs, attempts: payload.attempts + 1 });
    }
    this.locks.delete(id);
  }
}

let providerSingleton: QueueProvider | null = null;

export function getQueue(): QueueProvider {
  if (providerSingleton) return providerSingleton;
  const env = getEnv();
  if (env.upstashUrl && env.upstashToken) {
    providerSingleton = new UpstashQueue(new Redis({ url: env.upstashUrl, token: env.upstashToken }));
  } else {
    providerSingleton = new InMemoryQueue();
  }
  return providerSingleton;
}

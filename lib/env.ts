export function getEnv() {
  const {
    UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN,
    TELEGRAM_DEFAULT_BOT_TOKEN,
    VERCEL_URL,
  } = process.env;

  const siteUrl = VERCEL_URL
    ? `https://${VERCEL_URL}`
    : 'http://localhost:3000';

  return {
    upstashUrl: UPSTASH_REDIS_REST_URL,
    upstashToken: UPSTASH_REDIS_REST_TOKEN,
    defaultBotToken: TELEGRAM_DEFAULT_BOT_TOKEN,
    siteUrl,
  } as const;
}

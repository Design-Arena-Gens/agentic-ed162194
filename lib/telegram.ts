export type TelegramSendResult = {
  ok: boolean;
  description?: string;
};

export async function sendTelegramMessage(params: {
  botToken: string;
  chatId: string;
  text: string;
}): Promise<TelegramSendResult> {
  const { botToken, chatId, text } = params;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ chat_id: chatId, text })
  });

  const data = await res.json().catch(() => ({}));
  return { ok: !!data.ok, description: data.description };
}

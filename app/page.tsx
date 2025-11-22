"use client";
import { useState } from 'react';

export default function HomePage() {
  const [botToken, setBotToken] = useState("");
  const [chatIds, setChatIds] = useState("");
  const [text, setText] = useState("Hello! Welcome ??");
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, chatIds, text, delayMinutes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule');
      setResult(`Scheduled ${data.count} message(s). They will send in ${delayMinutes} minute(s).`);
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <header>
        <h1>Telegram Greeting Scheduler</h1>
        <span className="badge">10-min delayed greeter</span>
      </header>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div>
              <label>Bot Token</label>
              <input value={botToken} onChange={e=>setBotToken(e.target.value)} placeholder="123456789:AA..." required />
              <div className="help">Create a bot via @BotFather and paste the token.</div>
            </div>
            <div>
              <label>Chat IDs (comma separated)</label>
              <input value={chatIds} onChange={e=>setChatIds(e.target.value)} placeholder="123456789, -100987654321" required />
              <div className="help">Users must have started the bot to receive messages.</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label>Message</label>
            <textarea rows={4} value={text} onChange={e=>setText(e.target.value)} />
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <div>
              <label>Delay (minutes)</label>
              <input type="number" min={0} max={1440} value={delayMinutes} onChange={e=>setDelayMinutes(parseInt(e.target.value || '0', 10))} />
            </div>
            <div>
              <label>&nbsp;</label>
              <button disabled={loading} type="submit">{loading ? 'Scheduling?' : 'Schedule Greetings'}</button>
            </div>
          </div>

          {result && <p className="success" style={{ marginTop: 12 }}>{result}</p>}
          {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
        </form>
        <hr />
        <div className="help">
          The server runs a cron job every minute and sends any due messages. On Vercel, this is configured in <code>vercel.json</code>.
        </div>
      </div>
    </div>
  );
}

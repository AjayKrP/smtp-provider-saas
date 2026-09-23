'use client';

import { useState } from 'react';

export default function Home() {
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setStatus('Sending…');

    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });

    const body = await res.json();
    setStatus(res.ok ? 'Sent — check the inbox.' : (body.error ?? 'Failed'));
  }

  return (
    <main style={{ maxWidth: 420, margin: '10vh auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>SMTP test</h1>
      <form onSubmit={send}>
        <label htmlFor="to">Send a test message to</label>
        <input
          id="to"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@example.com"
          required
          style={{ display: 'block', width: '100%', padding: 8, margin: '8px 0' }}
        />
        <button type="submit">Send</button>
      </form>
      {status && <p>{status}</p>}
    </main>
  );
}

/**
 * RYZN AI Coach — Vercel Edge Function
 * Proxies requests to Groq API using the server-side environment variable.
 *
 * Deploy to Vercel and set environment variable:
 *   RYZN_API_KEY = your_groq_api_key
 *
 * The frontend calls POST /api/chat — the key never touches the browser.
 */

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Read API key from Vercel environment variable
  const apiKey = process.env.RYZN_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { messages } = body;
  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'Missing messages array.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Forward to Groq
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      'llama-3.3-70b-versatile',
        max_tokens: 200,
        messages,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return new Response(JSON.stringify({
        error: err?.error?.message || `Groq error ${groqRes.status}`,
      }), {
        status: groqRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data  = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upstream request failed: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

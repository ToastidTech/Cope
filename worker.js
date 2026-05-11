/**
 * Secure Cloudflare Worker for Cope PWA
 * -----------------------------------------------------------
 * Security layers:
 *   1. Rate limiting — 20 requests per IP per 10 minutes
 *   2. X-API-Key header — must match env.PWA_API_KEY
 *   3. Origin/Referer check — only Cope PWA domains allowed
 *
 * Deploy to: muddy-violet-2a0d.toastidtechllc.workers.dev
 *
 * Environment variables (add in Cloudflare Worker Settings > Variables):
 *   ANTHROPIC_API_KEY  — your Anthropic API key
 *   PWA_API_KEY        — shared secret (generate one, see below)
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
    };

    // ── Preflight ────────────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── Method guard ─────────────────────────────────────────────────────────
    if (request.method !== 'POST') {
      return json({ error: 'Method Not Allowed' }, 405);
    }

    // ── 1. Rate limit: 20 req/IP/10 min ─────────────────────────────────────
    const ip = getClientIP(request);
    const now = Date.now();

    // Persist rate limit state across requests in the same isolate
    if (!globalThis._rl) globalThis._rl = new Map();

    const entry = globalThis._rl.get(ip);
    const windowMs = 10 * 60 * 1000; // 10 minutes

    if (!entry || now > entry.resetAt) {
      globalThis._rl.set(ip, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count++;
      if (entry.count > 20) {
        return json(
          { error: 'Too Many Requests', retryAfter: Math.ceil((entry.resetAt - now) / 1000) },
          429,
          { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) }
        );
      }
    }

    // ── 2. X-API-Key check ───────────────────────────────────────────────────
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.PWA_API_KEY) {
      return json({ error: 'Unauthorized — missing or invalid X-API-Key' }, 401);
    }

    // ── 3. Origin/Referer check ─────────────────────────────────────────────
    const origin = request.headers.get('Origin') || request.headers.get('Referer') || '';
    const allowedOrigins = [
      'https://toastidtech.github.io',
      'https://toastidtechllc.github.io',
      'https://toastidtech.github.io/Cope',
      'https://toastidtechllc.github.io/Cope',
    ];
    // Allow requests with no Origin header (e.g. direct curl) but block mismatched origins
    const originAllowed = origin === '' || allowedOrigins.some(o => origin.startsWith(o));
    if (!originAllowed) {
      return json({ error: 'Forbidden — origin not allowed' }, 403);
    }

    // ── Forward to Anthropic ─────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getClientIP(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Real-IP') ||
    '127.0.0.1'
  );
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra }
  });
}
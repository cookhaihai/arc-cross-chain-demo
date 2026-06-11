// ═══════════════════════════════════════════════════════════════════════════
// Vercel Serverless Function — Circle Iris API proxy
//   Endpoint: GET /api/iris-proxy?sourceDomain={0-31}&txHash=0x...
//
// Purpose:
//   1. Real backend for this Track 4 submission (frontend + backend + diagram).
//   2. Lets us optionally hide the Circle Kit Key on the server (set as a
//      Vercel env var CIRCLE_KIT_KEY) — the key never reaches user browsers.
//   3. Centralized place for retry/cache/rate-limit logic in production.
//
// Frontend usage (replaces direct calls to iris-api-sandbox.circle.com):
//   const res = await fetch(`/api/iris-proxy?sourceDomain=${domain}&txHash=${hash}`);
//   const data = await res.json();
//
// Auto-deployed by Vercel from the /api/ directory — no config file needed.
// ═══════════════════════════════════════════════════════════════════════════

const IRIS_BASE = 'https://iris-api-sandbox.circle.com';

export default async function handler(req, res) {
  // CORS — allow the frontend (same Vercel deployment) and other consumers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const { sourceDomain, txHash } = req.query;

  // Input validation — fail fast on garbage queries
  if (!/^\d{1,3}$/.test(String(sourceDomain || ''))) {
    return res.status(400).json({
      error: 'Invalid sourceDomain — must be a CCTP domain ID (e.g. 0 for Ethereum, 3 for Arbitrum, 6 for Base, 26 for Arc).',
    });
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(String(txHash || ''))) {
    return res.status(400).json({
      error: 'Invalid txHash format — must be 0x followed by 64 hex characters.',
    });
  }

  const upstreamUrl = `${IRIS_BASE}/v2/messages/${sourceDomain}?transactionHash=${txHash}`;
  const headers = { 'User-Agent': 'arc-agentic-usdc/1.0 (vercel-proxy)' };

  // Optional server-side Kit Key — set CIRCLE_KIT_KEY in Vercel environment variables.
  // When set, the user's browser never sees the key.
  if (process.env.CIRCLE_KIT_KEY) {
    headers['Authorization'] = `Bearer ${process.env.CIRCLE_KIT_KEY}`;
  }

  try {
    const irisRes = await fetch(upstreamUrl, { headers });
    const text = await irisRes.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    // Forward Iris status code so the frontend can distinguish 404 (not yet ready)
    // from 5xx (Iris down) from 200 (attestation complete).
    res.setHeader('Cache-Control', 'no-store');
    res.status(irisRes.status).json(data);
  } catch (e) {
    res.status(502).json({
      error: 'Iris upstream error',
      message: e?.message || String(e),
    });
  }
}

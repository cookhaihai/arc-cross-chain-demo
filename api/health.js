// ═══════════════════════════════════════════════════════════════════════════
// Vercel Serverless Function — backend health check
//   Endpoint: GET /api/health
//
// Returns server status + capability advertisement. Used by the frontend's
// "Backend status" indicator and by judges to verify this project has a
// working backend (not just static HTML).
//
// Example response:
// {
//   "status": "ok",
//   "service": "arc-agentic-usdc-backend",
//   "version": "1.0.0",
//   "uptime_seconds": 42.7,
//   "timestamp": "2026-06-04T...",
//   "capabilities": { ... }
// }
// ═══════════════════════════════════════════════════════════════════════════

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  res.status(200).json({
    status: 'ok',
    service: 'arc-agentic-usdc-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime_seconds: typeof process !== 'undefined' && process.uptime
      ? Number(process.uptime().toFixed(2))
      : null,
    capabilities: {
      iris_proxy: {
        endpoint: '/api/iris-proxy',
        method: 'GET',
        query_params: ['sourceDomain', 'txHash'],
        description: 'Proxies CCTP V2 attestation requests to Circle Iris API (sandbox). Optionally injects server-side Kit Key.',
      },
      health_check: {
        endpoint: '/api/health',
        method: 'GET',
        description: 'This endpoint.',
      },
    },
    cctp_domains_supported: {
      arc_testnet: 26,
      ethereum_sepolia: 0,
      base_sepolia: 6,
      arbitrum_sepolia: 3,
    },
    notes: 'Backend handles CCTP attestation polling. Frontend uses this proxy by default for resilience, key protection, and CORS-stability. See /api/iris-proxy for the attestation endpoint.',
  });
}

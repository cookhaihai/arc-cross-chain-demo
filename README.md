# Arc Agentic USDC — AI Agent + Real CCTP V2 Fast Transfer

> **Stablecoins Commerce Stack Challenge submission · Track 4: Agentic Economy**

A working multi-chain USDC dApp where an **AI agent** plans and executes real on-chain transactions on behalf of the user. Built around Circle's CCTP V2 Fast Transfer and Gemini function calling.

🔗 **Live demo:** https://arc-cross-chain-demo.vercel.app
📂 **Repo:** https://github.com/cookhaihai/arc-cross-chain-demo
🛠 **Backend health check:** https://arc-cross-chain-demo.vercel.app/api/health

---

## TL;DR for judges

- 🤖 **AI agent** powered by Gemini 2.5 Flash with **6 on-chain tools** (`get_balances`, `bridge_usdc`, `send_usdc`, `get_wallet_info`, `get_pending_bridges`, `resume_mint`) — talk to it in natural language, it executes real testnet transactions
- ⚡ **CCTP V2 Fast Transfer** (`minFinalityThreshold = 1000`) — attestations in 10–30 seconds vs. 5–15 minutes for Standard
- 🌉 **Real burn-and-mint** across 4 testnets — Arc, Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia
- 🔁 **Automatic stuck-bridge recovery** — the agent detects bridges where burn succeeded but mint is pending, then completes them with one prompt. This is the agentic UX gap most demos skip.
- 🔑 **Agent never holds keys** — every transaction passes through the user's own wallet (EIP-6963 multi-wallet discovery: MetaMask, Rabby, OKX, Coinbase, Brave, etc.)
- 🌐 **Full bilingual UI** (English / 中文) including system prompt — agent responds natively in user's language
- 🏗 **Frontend + Backend split** — Vercel Serverless Functions proxy CCTP attestation calls, with graceful fallback to direct Iris API

Single static `index.html` + 2 Node.js Vercel Functions. No build step. ~3,400 lines total.

---

## Why this fits Track 4 — Agentic Economy

Track 4 asks for *"autonomous economic experiences where AI agents can research, negotiate, and execute transactions on behalf of users using onchain rails and programmable payment logic."*

This demo delivers the **agentic infrastructure layer** that any of the example use cases (subscription workflows, merchant settlement, loyalty routing, pay-per-inference) needs underneath:

1. **Real on-chain execution, not just chat** — every agent function call resolves to a real CCTP V2 contract interaction visible on a block explorer.
2. **Cross-chain reasoning** — multi-step prompts like *"Find the chain with the most USDC and move 50% to Arc"* — the agent reads balances across 4 chains, picks the best source, and bridges via CCTP V2.
3. **Edge-case autonomy** — when CCTP gets stuck (slow attestation, mint failure), the agent independently detects via `get_pending_bridges`, then completes the mint via `resume_mint`. **This is the reason agentic finance fails at scale, and this demo shows how to solve it.**
4. **Programmable payment logic** — built-in creator-fee monetization (Arc App Kit pattern) demonstrates how agent-executed payments can carry programmable revenue splits without breaking CCTP's burn-and-mint semantics.

The agent is built on **Gemini 2.5 Flash function calling** with 6 typed tools, each backed by Circle's CCTP V2 contracts and Iris API.

---

## Architecture

![Architecture diagram](./architecture.svg)

**Data flow:**

1. **User → Agent**: natural language prompt
2. **Agent → Gemini**: prompt + 6 tool schemas
3. **Gemini → Agent**: either text reply or `functionCall` with structured args
4. **Agent dispatches** the tool call locally; tools call:
   - `/api/iris-proxy` (our backend) for CCTP attestation polling
   - Public testnet RPCs directly for on-chain reads
   - User's wallet for signing every state-changing transaction
5. **Result → Gemini → user** in their language

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Static HTML + Tailwind via CDN + ethers.js v6 | No build, instant load, fully auditable in one file |
| AI agent | Gemini 2.5 Flash | Free tier, native function calling, low latency |
| Wallet discovery | EIP-6963 | Auto-detects every installed EVM wallet, not just MetaMask |
| Bridge protocol | CCTP V2 (direct contract calls) | Native burn-and-mint, no LP risk |
| Transfer mode | **Fast Transfer** (`minFinalityThreshold = 1000`) | 10–30s vs. 5–15min for Standard |
| Backend | Vercel Serverless Functions | `/api/iris-proxy` + `/api/health` |
| Attestation source | Circle Iris API (sandbox) — via our proxy | Server-side Kit Key option |
| State persistence | localStorage (client) | Settings + tx history |

### Backend architecture

The project includes a thin Node.js backend deployed as Vercel Serverless Functions:

```
api/iris-proxy.js    → GET /api/iris-proxy?sourceDomain={0-31}&txHash=0x...
                       Proxies CCTP V2 attestation polling to Circle Iris API.
                       Optionally injects a server-side Kit Key (Vercel env var
                       CIRCLE_KIT_KEY), so the user's browser never sees it.

api/health.js        → GET /api/health
                       Returns backend status + capability advertisement.
                       Try it: https://arc-cross-chain-demo.vercel.app/api/health
```

The frontend defaults to calling the backend proxy (same-origin, no CORS, optional server-side auth) and **falls back to direct Iris API calls if the proxy is unreachable** (e.g. running `index.html` locally without Vercel). This gives the demo three properties:

1. **Real frontend + backend split** — not just a static page with API calls
2. **Kit Key protection** — production deployments can set `CIRCLE_KIT_KEY` as a Vercel env var and the key never reaches user browsers
3. **Local-dev still works** — open `index.html` directly with `python3 -m http.server` and the fallback path keeps everything functional

---

## Circle products used

| Product | Where it's used | Why we chose it |
|---|---|---|
| **USDC** | Settlement asset across 4 testnets, including Arc where USDC is also native gas | Track 4 explicitly recommends USDC as the agent-settlement rail; using Arc makes the gas story unique |
| **CCTP V2** | Direct calls to `TokenMessengerV2` and `MessageTransmitterV2` contracts, **Fast Transfer mode** | Recommended Track 4 tool. Direct contract integration (no SDK wrapper) is more agent-friendly: every call is a single transaction with deterministic semantics, easy for the LLM to reason about |
| **Iris API** | Attestation polling via our backend proxy | Required for CCTP V2 mint step. Backend proxy lets us protect the Kit Key |

### Why we did **not** integrate Wallets / Gateway / Nanopayments

Honest assessment per Track 4's evaluation criteria:

- **Circle Wallets** — *deliberate non-integration*. Our security model is "agent never holds keys" — the agent calls tools, the user signs every transaction in their own wallet (MetaMask / Rabby / OKX via EIP-6963). Integrating Wallets would mean either (a) the agent holds keys (bad for agentic security) or (b) embedded wallets that complicate the user flow. We chose user-owned wallets for the agent UX.
- **Circle Gateway** — *not needed at the demo scale*. Gateway shines when you have treasury orchestration across many counterparties; a single-user agent demo doesn't surface that value. A production version of this dApp (multi-merchant settlement) would absolutely use Gateway.
- **Nanopayments** — *not the right use case*. Nanopayments are for high-frequency sub-cent flows (per-inference billing, streaming). Our demo focuses on user-initiated cross-chain transfers, not streaming.

A roadmap section below outlines how Gateway and Nanopayments would fit a future version.

---

## Circle Product Feedback

A required section for the submission. Honest feedback after building against Circle's stack:

### What worked well

1. **CCTP V2 design is excellent** — the burn-and-mint flow is conceptually clean and the Fast Transfer mode genuinely solves the UX problem of Standard mode on slow source chains (Sepolia 8–20 min → 10–30s). Direct contract integration was straightforward once we found testnet contract addresses.
2. **Iris API V2 endpoint is simple and well-shaped** — `GET /v2/messages/{domain}?transactionHash=...` returns exactly what we need. Status field is unambiguous.
3. **USDC contract behavior is identical across chains** — letting us treat all 4 testnets uniformly in our agent's tool schema.
4. **Fees API endpoint** (`/v2/burn/USDC/fees/{src}/{dst}`) makes Fast Transfer fee discovery clean — we query it live before each burn rather than hardcoding rates.
5. **Arc Testnet's stablecoin-native gas** is a real differentiator — paying gas in USDC removes the entire "bridge ETH first" UX problem. We default to Arc as the source chain because of this.

### What could be improved

1. **CCTP V2 testnet contract addresses are not on `developers.circle.com/cctp/references/contract-addresses`** — that page lists only mainnet. I had to find the testnet addresses by reading the *"Transfer USDC on Testnet from Ethereum to Avalanche"* tutorial and inferring (correctly) that they're shared across all V2 testnets via CREATE2. **Recommendation**: add an explicit "Testnet Contract Addresses" sub-section.
2. **CCTP domain IDs are scattered** — currently spread across the contract-addresses page, the technical guide, and various blog posts. **Recommendation**: a single domain-ID-by-chain table.
3. **Iris sandbox rate limits are unclear** — unauthenticated callers hit limits during testing but the limits aren't published. **Recommendation**: document the anonymous vs Kit Key tier limits.
4. **No first-party "what is `minFinalityThreshold`" explainer** — the choice between 1000 (Fast) and 2000 (Standard) is the single most important integration decision but takes reading the whitepaper to fully understand. **Recommendation**: a single page comparing modes with timing tables.
5. **Pharos CCTP was announced but RPC was unstable during the hackathon window** — we ended up disabling Pharos. **Recommendation**: list known RPC issues alongside the chain support announcement.

### Recommendations for developer experience

1. **Publish a single CCTP V2 cheat sheet** — one PDF with: all chain domains, all contract addresses (mainnet + testnet), Fast/Standard timing table, recommended `minFinalityThreshold` values, fee API endpoint, Iris polling endpoint with example response.
2. **Provide an official `@circle/cctp-sdk`** for browser/Node — even a tiny one. Today every team writes the same ABI fragments and polling loops.
3. **CCTP V2 needs a "transfer status" UI primitive** — a React component or framework-agnostic snippet that shows the burn→attest→mint pipeline with explorer links and Resume Mint behavior baked in.
4. **A first-party Iris webhook** (or SSE stream) instead of polling — would let dApps notify users the moment attestation is ready, no client-side polling required.
5. **Standardize the "stuck mint" recovery story** — every CCTP integrator builds something like our `resume_mint` flow. A reference implementation would help.

---

## AI Development Disclosure

This project was built with AI assistance, fully aligned with Track 4's Agentic Economy theme:

- **Development:** Claude (Anthropic) assisted with code generation, architecture review, and documentation.
- **Runtime:** Gemini 2.5 Flash powers the in-app AI Agent feature via function calling. Users provide their own API key (stored locally only).

All AI tools used hold valid commercial licenses.

---

## Quick start

### Run locally

```bash
git clone https://github.com/cookhaihai/arc-cross-chain-demo
cd arc-cross-chain-demo
python3 -m http.server 8000
# Open http://localhost:8000
```

The local mode skips the backend proxy and falls back to direct Iris API calls. Everything else works identically.

### Use the demo

1. Open https://arc-cross-chain-demo.vercel.app
2. Connect any EVM browser wallet (MetaMask, Rabby, OKX, Coinbase, Brave, etc. — auto-detected via EIP-6963)
3. **Get test USDC**: links to Circle's faucet are inside the demo (Bridge tab → Faucets)
4. **Get test gas**: same panel includes faucet links for each chain's native token
5. **Try the AI Agent**: tab → set your free Gemini API key → click an example prompt or type your own
6. **Try a real bridge**: Bridge tab → pick source/destination → enter amount → confirm
7. **Test Resume Mint**: if a bridge gets stuck (rare with Fast Transfer), go to History tab → click "Resume Mint" or ask the agent "do I have any stuck bridges? resume them."

---

## What's real vs. demo

| Feature | Status | Notes |
|---|---|---|
| Read USDC balances | ✅ Real (parallel `balanceOf` queries on 4 chains) | |
| Bridge USDC via CCTP V2 | ✅ Real (approve → burn → poll → mint) | Fast Transfer mode |
| Send USDC | ✅ Real (ERC-20 `transfer`) | |
| AI Agent (Gemini function calling) | ✅ Real | 6 tools, max 8 iterations per session |
| Monetization fee transfer | ✅ Real (separate USDC `transfer` before main tx) | Opt-in via UI |
| Gas estimation | ✅ Real (`getFeeData` × standard gas units) | |
| Transaction history | ✅ Real (localStorage of actual tx hashes) | Survives reload, per-account |
| Resume Mint recovery | ✅ Real (re-polls Iris, calls receiveMessage) | One of the demo's unique features |
| **Swap (USDC ↔ EURC / cirBTC)** | ⚠️ UI demo only — no real DEX yet public | Reserved for future integration |

---

## Security notes

- **The agent has no key access** — all transactions are signed by the user's connected wallet (MetaMask, Rabby, OKX, etc.). The agent's job ends at suggesting tool calls; the user authorizes each one.
- **Kit Key and Gemini API Key are stored only in browser localStorage**, never in code. Production deployments should set `CIRCLE_KIT_KEY` as a Vercel env var so the backend proxy injects it server-side and the browser never sees it.
- **Testnet only** — this codebase is not audited for mainnet use. All Circle products referenced are sandbox/testnet endpoints.

---

## Roadmap

- **Circle Wallets integration** — for non-crypto-native users who don't want a browser extension
- **Circle Gateway** — for multi-merchant settlement scenarios (would be the natural next step for a production version)
- **Nanopayments** — for agent-to-agent streaming payments (e.g. pay-per-inference flows where this agent calls another agent's API)
- **Real swap integration** — Uniswap V3 or Curve on Arc Testnet once available
- **Mainnet readiness audit** — before going beyond testnet
- **Two-row gas estimate** — separate source vs. destination network fee preview before signing
- **WalletConnect v2** — for mobile wallet support alongside EIP-6963 browser wallets

---

## License

MIT.

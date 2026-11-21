# NSE Pulse

A personal end-of-day desk for the Indian stock market. NSE Pulse downloads the daily NSE BhavCopy, then lets you scan every listed stock, keep watchlists and a portfolio, set alerts for the next session, and expose the same data to AI clients through an MCP server.

Data is end of day only. There are no live ticks.

## Features

- **Watchlists** with sector filters and the scanners each stock currently matches.
- **Portfolio** with cost basis, day and total profit or loss at the last close.
- **Market heatmap** by category, for All NSE, Nifty 500 or Nifty 50, sized by market cap or turnover.
- **Scanners** across about 3,500 symbols, with built-in screeners and a **scanner builder** for custom price, moving average, RSI and volume rules.
- **Alerts** raised by an end-of-day scan, for scanner matches and price rules.
- **Stock detail drawer** with candlestick and trend charts, indicators and price targets.
- **MCP server** at `/api/mcp` (JSON-RPC over HTTP) exposing quotes, history, scanners, watchlists and portfolio.
- Light and dark themes.

## Stack

React 19, Vite, Tailwind CSS 4, Recharts and D3 on the client. An Express server written in TypeScript (run with `tsx`) fetches and caches market data and serves the API.

## Getting started

Prerequisites: [Bun](https://bun.sh) (or Node.js 20+ with npm).

```bash
bun install
cp .env.example .env   # optional, see below
bun run dev
```

The app runs at http://localhost:3000. The first start downloads recent BhavCopy files, so give it a moment before the data appears.

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | No | Enables the grounded stock research panel in the detail drawer. Everything else works without it. |

### Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the API and the Vite dev server together |
| `bun run build` | Production build into `dist/` |
| `bun run start` | Serve the production build |
| `bun run lint` | Type-check with `tsc --noEmit` |
| `bun run test` | Run the unit tests (Node's built-in test runner) |

## Connecting an MCP client

Add this to Claude Desktop, Cursor or any client that supports streamable HTTP MCP servers:

```json
{
  "mcpServers": {
    "nse-pulse": {
      "url": "http://localhost:3000/api/mcp",
      "transport": "http"
    }
  }
}
```

The MCP page in the app lists every tool and resource and lets you run them.

## Project structure

```
server.ts          Express app, API routes, scheduled scan
server/            Market data fetch and cache, MCP handler, state store
src/               React app
src/components/    One file per page, plus charts and the stock drawer
src/shared/        Types and pure logic (indicators, scanners, heatmap, portfolio) with tests
PRODUCT.md         Product context used by design tooling
```

Your watchlists, portfolio and alerts are stored locally in `data/user_state.json`, which is git-ignored.

## License

MIT. See [LICENSE](LICENSE).

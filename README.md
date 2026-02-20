# CineConcerts MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that provides real-time access to CineConcerts film-concert event data. Search for Harry Potter, Godfather, Gladiator, and other film-concert experiences happening worldwide.

Works with **Claude**, **ChatGPT**, **Cursor**, and any MCP-compatible client.

## Hosted Server

A public instance is running and ready to use — no setup required:

```
https://cineconcerts.digital/mcp/
```

Health check: https://cineconcerts.digital/mcp/health

## Quick Start

### Claude Code

Add to your Claude Code config (`.claude.json` or via settings):

```json
{
  "mcpServers": {
    "cineconcerts": {
      "type": "http",
      "url": "https://cineconcerts.digital/mcp/"
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cineconcerts": {
      "url": "https://cineconcerts.digital/mcp/"
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "cineconcerts": {
      "url": "https://cineconcerts.digital/mcp/"
    }
  }
}
```

### ChatGPT (OpenAI Apps)

The server includes all required tool annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`) for OpenAI Apps SDK compatibility. Point the app at the hosted URL to register.

## Tools

### `search_shows`

Search for events by keyword — film title, city, venue, or any text.

```
Input:  { "query": "Harry Potter" }
Input:  { "query": "Prague" }
Input:  { "query": "Gladiator" }
```

### `find_nearby_shows`

Find events near a location using geocoding and geo-search.

```
Input:  { "location": "New York" }
Input:  { "location": "London", "radius_km": 200 }
Input:  { "location": "Tokyo Tower" }
```

Geocodes the location via [Nominatim](https://nominatim.openstreetmap.org/), then searches Algolia within the given radius (default 500km).

### `list_upcoming_shows`

Browse all upcoming events.

```
Input:  { "limit": 10 }
Input:  {}           // defaults to 20 results
```

Returns up to 60 events.

### `get_show_details`

Get full details for a specific show by its show code.

```
Input:  { "show_code": "HP3" }
Input:  { "show_code": "HP8" }
```

Returns all available fields: title, date, venue, city, country, state, poster image, ticket link, pre-sale status, and more.

## Response Format

Each event in the response includes:

| Field | Example |
|-------|---------|
| **Title** | Harry Potter and the Prisoner of Azkaban™ In Concert |
| **Date** | 03/06/2026 to 03/07/2026 |
| **Location** | Popejoy Hall, Albuquerque, New Mexico, United States |
| **Show Code** | HP3 |
| **Poster** | URL to event poster image |
| **Tickets** | Direct link to purchase tickets |

## Self-Hosting

### Prerequisites

- Node.js 18+
- An Algolia account with access to the `knack_events` index

### Setup

```bash
git clone https://github.com/aaldere1/cineconcerts-mcp.git
cd cineconcerts-mcp
npm install
```

Create a `.env` file:

```env
ALGOLIA_APP_ID=your_app_id
ALGOLIA_API_KEY=your_search_api_key
PORT=8421
HOST=127.0.0.1
```

### Development

```bash
npm run dev          # tsx watch mode with hot reload
```

### Production

```bash
npm run build        # compile TypeScript to dist/
npm start            # run compiled server
```

Or with PM2:

```bash
pm2 start dist/index.js --name cc-mcp
```

## Architecture

```
src/
├── index.ts              # Express server + Streamable HTTP transport
├── tools/
│   ├── search.ts         # search_shows — keyword search
│   ├── nearby.ts         # find_nearby_shows — geo search
│   ├── list.ts           # list_upcoming_shows — browse all
│   └── details.ts        # get_show_details — single show lookup
└── services/
    ├── algolia.ts        # Algolia client, queries, response formatting
    └── geocode.ts        # Nominatim geocoding for location search
```

### Stack

- **TypeScript** + **Express** — HTTP server
- **@modelcontextprotocol/sdk** — official MCP SDK with Streamable HTTP transport
- **algoliasearch** — Algolia client for the `knack_events` index
- **Zod** — input schema validation (required by MCP SDK)
- **Nominatim** — free geocoding for the `find_nearby_shows` tool

### Transport

Uses [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) (the current MCP transport standard):

- `POST /` — JSON-RPC messages (tool calls, initialization)
- `GET /` — SSE stream for server-to-client notifications
- `DELETE /` — session termination
- `GET /health` — health check endpoint

When deployed behind a reverse proxy (e.g. nginx at `/mcp/`), the public URL becomes `https://your-domain.com/mcp/`.

Sessions are managed via the `Mcp-Session-Id` header.

## Data Source

Event data comes from the **Algolia `knack_events` index**, the same index that powers [cineconcerts.com](https://www.cineconcerts.com), the CineConcerts mobile app, and the interactive concert map. The data is public and read-only.

Currently ~60 active events including:

- Harry Potter film series (all 8 films)
- The Godfather
- Gladiator
- Breakfast at Tiffany's
- Elf
- It's a Wonderful Life
- DreamWorks Animation
- Polar Express
- Rudy
- Brave
- and more

## License

MIT

## About CineConcerts

[CineConcerts](https://www.cineconcerts.com) produces film-concert experiences worldwide — a full symphony orchestra performs a film's entire score live to picture on a giant screen. Since 2016, CineConcerts has performed over 1,500 shows across 48 countries to over 3 million fans.
